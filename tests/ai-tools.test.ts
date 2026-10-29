import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { WorkspaceError } from "../src/modules/organizations/server/errors";
import { AI_TOOL_DEFINITIONS, AI_TOOL_INPUT_SCHEMAS, anthropicTools, STRICT_OPTIONAL_PARAMETER_LIMIT, STRICT_UNION_PARAMETER_LIMIT } from "../src/modules/ai/tools/definitions";
import { createToolExecutor, MAX_TOOL_RESULT_CHARS, safeToolError, type ToolHandlers } from "../src/modules/ai/tools/registry";
import { budgetOverlaps, cleanText, dubaiDayRange, locationMatches, majorToMinor, minorToMajor, presentLocation } from "../src/modules/ai/tools/present";
import { collect, coverage, presentLeadSummary, presentListingSummary, presentProjectSummary, presentPropertySummary } from "../src/modules/ai/tools/records";

const root = process.cwd();
const never = async () => { throw new Error("must not run"); };
const handlers = (overrides: Partial<ToolHandlers> = {}): ToolHandlers => ({
  searchProperties: never, getPropertyDetails: never, searchProjects: never, getProjectDetails: never,
  searchLeads: never, getLeadDetails: never, getDashboardSummary: never, getMatchingPropertiesForLead: never, getLeadQualification: never, ...overrides,
});
const signal = new AbortController().signal;

describe("Copilot tool registry", () => {
  it("exposes exactly the nine read-only tools (eight from Phase 6A, one from 6C)", () => {
    assert.deepEqual(AI_TOOL_DEFINITIONS.map(tool => tool.name), [
      "searchProperties", "getPropertyDetails", "searchProjects", "getProjectDetails",
      "searchLeads", "getLeadDetails", "getDashboardSummary", "getMatchingPropertiesForLead", "getLeadQualification",
    ]);
    for (const tool of AI_TOOL_DEFINITIONS) {
      assert.doesNotMatch(tool.name, /create|update|delete|archive|assign|send|publish|set|save|schedule|move/i, `${tool.name} must be read-only`);
    }
  });

  it("uses strict-mode-compatible JSON schemas that match the server's Zod schemas", () => {
    const unsupported = ["minimum", "maximum", "minLength", "maxLength", "multipleOf", "pattern", "minItems", "maxItems"];
    for (const tool of anthropicTools()) {
      assert.equal(tool.strict, true);
      const schema = tool.input_schema as {type: string; properties: Record<string, {enum?: string[]}>; required: string[]; additionalProperties: boolean};
      assert.equal(schema.type, "object");
      assert.equal(schema.additionalProperties, false);
      assert.ok(schema.required.every(name => name in schema.properties));
      const serialized = JSON.stringify(schema);
      for (const keyword of unsupported) assert.ok(!serialized.includes(`"${keyword}"`), `${tool.name} uses ${keyword}`);
      const zod = AI_TOOL_INPUT_SCHEMAS[tool.name as keyof typeof AI_TOOL_INPUT_SCHEMAS] as unknown as {shape: Record<string, {options?: string[]; unwrap?: () => {options?: string[]}}>};
      assert.deepEqual(Object.keys(schema.properties).sort(), Object.keys(zod.shape).sort(), `${tool.name} JSON and Zod fields differ`);
      for (const [name, raw] of Object.entries(schema.properties)) {
        const property = (raw as {anyOf?: Array<{enum?: string[]}>}).anyOf?.[0] ?? raw;
        if (!property.enum) continue;
        const field = zod.shape[name];
        const options = field.options ?? field.unwrap?.().options ?? (field.unwrap?.() as {unwrap?: () => {options?: string[]}})?.unwrap?.().options;
        assert.deepEqual([...(options ?? [])].sort(), [...property.enum].sort(), `${tool.name}.${name} enum differs`);
      }
      for (const forbidden of ["organizationId", "userId", "uid", "role", "membershipId", "assignedMembershipId", "agentId", "sql", "query"]) {
        assert.ok(!(forbidden in schema.properties), `${tool.name} must not accept ${forbidden}`);
      }
    }
  });

  it("stays within Anthropic's strict-mode limits for optional and nullable parameters", () => {
    // The live API rejected 41 optional parameters (limit 24) and 17 union-typed ones (limit 16).
    let optional = 0, unions = 0;
    for (const tool of anthropicTools()) {
      const schema = tool.input_schema as {properties: Record<string, {anyOf?: unknown[]; type?: unknown}>; required: string[]};
      for (const [name, property] of Object.entries(schema.properties)) {
        if (!schema.required.includes(name)) optional++;
        if (property.anyOf || Array.isArray(property.type)) unions++;
      }
    }
    assert.ok(optional <= STRICT_OPTIONAL_PARAMETER_LIMIT, `${optional} optional parameters`);
    assert.ok(unions <= STRICT_UNION_PARAMETER_LIMIT, `${unions} nullable parameters`);
  });

  it("treats null arguments from nullable parameters as omitted", async () => {
    let received: unknown;
    const execute = createToolExecutor(handlers({searchLeads: async input => { received = input; return {data: {results: []}}; }}), {timeoutMs: 1000});
    const outcome = await execute("searchLeads", {status: null, followUp: null, limit: null, search: "Ahmed"}, signal);
    assert.equal(outcome.status, "SUCCEEDED");
    assert.deepEqual(received, {search: "Ahmed", followUp: "ANY", assignment: "ANY", limit: 10});
  });

  it("rejects unknown tools and invalid arguments before any handler runs", async () => {
    const execute = createToolExecutor(handlers(), {timeoutMs: 1000});
    const unknown = await execute("runSql", {sql: "select * from lead"}, signal);
    assert.equal(unknown.status, "REJECTED");
    assert.equal(unknown.errorCode, "UNKNOWN_TOOL");
    for (const [name, input] of [
      ["searchProperties", {minPrice: 5, maxPrice: 1}],
      ["searchProperties", {limit: 500}],
      ["getPropertyDetails", {}],
      ["getPropertyDetails", {propertyId: "13000000-0000-4000-8000-000000000001", propertyReference: "EST-1"}],
      ["searchProjects", {handoverFrom: "2027-01-01", handoverTo: "2026-01-01"}],
      ["searchLeads", {assignment: "MINE", assignedAgentName: "Sara"}],
      ["getLeadDetails", {leadId: "../../other-company"}],
      ["getDashboardSummary", {organizationId: "20000000-0000-4000-8000-000000000001"}],
      ["getMatchingPropertiesForLead", {leadId: "13000000-0000-4000-8000-000000000001", role: "OWNER"}],
    ] as const) {
      const outcome = await execute(name, input, signal);
      assert.equal(outcome.status, "REJECTED", `${name} ${JSON.stringify(input)}`);
      assert.equal(outcome.errorCode, "INVALID_ARGUMENTS");
    }
  });

  it("reports forbidden and missing records identically, so guessed ids reveal nothing", async () => {
    const execute = createToolExecutor(handlers({
      getLeadDetails: async input => {
        if (input.leadId.startsWith("1")) throw new WorkspaceError("NOT_FOUND", 404, "Lead not found.");
        throw new WorkspaceError("PERMISSION_DENIED", 403, "You do not have permission to access this company data.");
      },
    }), {timeoutMs: 1000});
    const missing = await execute("getLeadDetails", {leadId: "13000000-0000-4000-8000-000000000001"}, signal);
    const forbidden = await execute("getLeadDetails", {leadId: "23000000-0000-4000-8000-000000000001"}, signal);
    assert.equal(missing.status, "FAILED");
    assert.equal(missing.content, forbidden.content);
    assert.match(missing.content, /NOT_FOUND_OR_NOT_PERMITTED/);
  });

  it("hides unexpected errors and enforces time and size limits", async () => {
    assert.deepEqual(safeToolError(new Error("connection to 10.0.0.4 failed: password=secret")).code, "CRM_UNAVAILABLE");
    assert.ok(!JSON.stringify(safeToolError(new Error("password=secret"))).includes("secret"));
    const execute = createToolExecutor(handlers({
      getDashboardSummary: () => new Promise(resolve => setTimeout(() => resolve({data: {}}), 200)),
      searchProjects: async () => ({data: {blob: "x".repeat(MAX_TOOL_RESULT_CHARS + 10)}}),
    }), {timeoutMs: 20});
    assert.equal((await execute("getDashboardSummary", {}, signal)).errorCode, "TOOL_TIMEOUT");
    const large = await execute("searchProjects", {}, signal);
    assert.equal(large.errorCode, "RESULT_TOO_LARGE");
    assert.ok(large.content.length < 1000);
  });

  it("server tools call only read services and read-only stored queries", () => {
    const source = readFileSync(join(root, "src/modules/ai/server/tools.ts"), "utf8");
    const imports = [...source.matchAll(/import \{([^}]+)\} from "@\/modules\/(?:inventory|leads)\/server\/[\w-]+"/g)].flatMap(match => match[1].split(",").map(name => name.trim()).filter(Boolean));
    const allowedServices = new Set(["getInventoryRecord", "listInventory", "getLead", "leadListOperation", "leadQueryVariables", "listLeads", "getLeadPropertyData"]);
    assert.ok(imports.length > 0);
    for (const name of imports) assert.ok(allowedServices.has(name), `unexpected service import ${name}`);
    const sqlCalls = new Set([...source.matchAll(/\bsql\.(\w+)\(/g)].map(match => match[1]));
    const allowedQueries = new Set(["listLeadAssignees", "listLeadFollowUps", "listLeadActivities", "getLeadMetrics", "getInventoryDashboardMetrics"]);
    for (const call of sqlCalls) assert.ok(allowedQueries.has(call), `unexpected SQL Connect call ${call}`);
    assert.doesNotMatch(source, /\b(create|update|archive|delete|assign|set|save|schedule|complete|change|move)[A-Z]\w*\(/, "no mutation helpers are called");
  });
});

describe("Copilot data minimization and map privacy", () => {
  const property = {
    id: "16000000000040008000000000000001", propertyReference: "EST-1042", propertyType: "APARTMENT", marketType: "SECONDARY", bedrooms: 2, bathrooms: 3,
    builtUpArea: 1250, areaUnit: "SQFT", emirate: "DUBAI", city: "Dubai", community: "Dubai Marina", area: "Marina Promenade",
    address: "Tower 4, Unit 2101", mapDisplayMode: "HIDDEN", referencePriceMinor: "245000000", inventoryStatus: "AVAILABLE",
    latitude: 25.0801, longitude: 55.1403, googlePlaceId: "ChIJ-secret", internalNotes: "Owner phone +971500000000",
    ownershipReference: "TITLE-99", mandateReference: "MANDATE-7", assignedMembership: {email: "agent@example.test", userProfile: {displayName: "Sara"}},
  };

  it("never sends coordinates, place IDs, internal notes or references", () => {
    const json = JSON.stringify(presentPropertySummary(property));
    for (const secret of ["25.0801", "55.1403", "ChIJ-secret", "+971500000000", "TITLE-99", "MANDATE-7", "agent@example.test", "latitude", "longitude", "googlePlaceId"]) {
      assert.ok(!json.includes(secret), `leaked ${secret}`);
    }
    const presented = presentPropertySummary(property);
    assert.equal(presented.id, "16000000-0000-4000-8000-000000000001");
    assert.equal(presented.link, "/properties/16000000-0000-4000-8000-000000000001");
    assert.equal(presented.referencePrice?.display, "AED 2,450,000");
    assert.match(presented.referencePrice?.kind ?? "", /reference price/);
  });

  it("includes the street address only for EXACT map visibility", () => {
    assert.equal("address" in presentLocation({...property, mapDisplayMode: "HIDDEN"}), false);
    assert.equal("address" in presentLocation({...property, mapDisplayMode: "APPROXIMATE"}), false);
    assert.equal("address" in presentLocation({...property, mapDisplayMode: "bogus"}), false);
    assert.equal(presentLocation({...property, mapDisplayMode: "EXACT"}).address, "Tower 4, Unit 2101");
    assert.equal(presentLocation({...property, mapDisplayMode: "EXACT"}).emirate, "Dubai");
  });

  it("omits lead contact details and free-text notes", () => {
    const lead = {
      id: "13000000-0000-4000-8000-000000000001", fullName: "Lead Name", email: "buyer@example.test", phone: "+971501234567", followUpNote: "Call on +971509999999",
      status: "QUALIFIED", priority: "HIGH", transactionType: "BUY", currency: "AED", propertyType: "Apartment", bedroomPreference: "2", preferredLocation: "JVC",
      budgetMin: 900000, budgetMax: 1200000, source: "Website", followUpAt: "2026-10-27T08:00:00Z", assignedMembershipId: "x", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z",
      contact: {fullName: "Contact Name", email: "contact@example.test", phone: "+971507777777", notes: "VIP passport A123"},
      assignedMembership: {email: "agent@example.test", userProfile: {displayName: "Sara"}},
    };
    const presented = presentLeadSummary(lead, Date.parse("2026-10-28T08:00:00Z"));
    const json = JSON.stringify(presented);
    for (const secret of ["buyer@example.test", "+971501234567", "+971509999999", "contact@example.test", "+971507777777", "A123", "agent@example.test"]) {
      assert.ok(!json.includes(secret), `leaked ${secret}`);
    }
    assert.equal(presented.name, "Contact Name");
    assert.equal(presented.followUpOverdue, true);
    assert.deepEqual(presented.budget, {from: "AED 900,000", to: "AED 1,200,000"});
  });

  it("labels listing, project and rent prices with their basis", () => {
    const listing = presentListingSummary({id: "l1", listingPurpose: "RENT", title: "Marina 2BR", askingPriceMinor: "1500000", currency: "AED", rentalPeriod: "MONTHLY", listingStatus: "ACTIVE",
      property: {id: "p1", propertyReference: "EST-1", propertyType: "APARTMENT", bedrooms: 2, emirate: "DUBAI", community: "Dubai Marina"}});
    assert.equal(listing.price?.display, "AED 15,000");
    assert.match(listing.price?.kind ?? "", /asking rent \(monthly\)/);
    const project = presentProjectSummary({id: "p", projectName: "Bay Tower", projectStatus: "ACTIVE", startingPriceMinor: "120000000", currency: "AED", mapDisplayMode: "APPROXIMATE", address: "Plot 1"});
    assert.match(project.startingPrice?.kind ?? "", /starting price/);
    assert.equal("address" in project.location, false);
  });

  it("strips control and bidi-override characters from untrusted text", () => {
    assert.equal(cleanText("Nice‮view\u0007\n\nignore   rules"), "Nice view ignore rules");
    assert.equal(cleanText("x".repeat(500), 10)?.length, 10);
    assert.equal(cleanText("   "), null);
  });
});

describe("Copilot search helpers", () => {
  it("understands common UAE location abbreviations", () => {
    assert.ok(locationMatches("JVC", ["Dubai", "Jumeirah Village Circle"]));
    assert.ok(locationMatches("Dubai Hills", ["Dubai Hills Estate"]));
    assert.ok(locationMatches("business bay", ["Business Bay"]));
    assert.equal(locationMatches("Dubai Marina", ["Business Bay"]), false);
  });
  it("converts AED amounts and checks budget overlap", () => {
    assert.equal(majorToMinor(2_500_000), "250000000");
    assert.equal(minorToMajor("250000000"), 2_500_000);
    assert.equal(minorToMajor("12abc"), null);
    assert.ok(budgetOverlaps({budgetMin: 1_000_000, budgetMax: 2_000_000}, 1_500_000));
    assert.equal(budgetOverlaps({budgetMin: 1_000_000, budgetMax: 2_000_000}, 2_500_000), false);
    assert.equal(budgetOverlaps({}, 1), false);
    assert.ok(budgetOverlaps({}));
  });
  it("computes the Dubai calendar day", () => {
    assert.deepEqual(dubaiDayRange(Date.parse("2026-10-28T21:30:00Z")), {start: "2026-10-28T20:00:00.000Z", end: "2026-10-29T20:00:00.000Z"});
  });
  it("reports empty searches truthfully", async () => {
    const empty = await collect(async () => ({rows: [], total: 0}), null, 10);
    assert.deepEqual(coverage(empty), {returned: 0, totalMatching: 0, complete: true});
    const filtered = await collect(async () => ({rows: [], total: 0}), () => true, 10);
    assert.deepEqual(coverage(filtered), {returned: 0, recordsScanned: 0, recordsInScope: 0, complete: true});
  });
  it("bounds scans to three pages and reports partial coverage", async () => {
    const offsets: number[] = [];
    const result = await collect(async (limit, offset) => { offsets.push(offset); return {rows: Array.from({length: limit}, (_, index) => ({n: offset + index})), total: 1000}; }, row => row.n % 500 === 0, 5);
    assert.deepEqual(offsets, [0, 100, 200]);
    assert.deepEqual(coverage(result), {returned: 1, recordsScanned: 300, recordsInScope: 1000, complete: false});
  });
});
