import assert from "node:assert/strict";
import { test } from "node:test";
import { portalAdapters } from "../src/modules/portals/adapters";
import { buildFeedDryRun, buildPortalExport, mappingLookup, summarizeErrorCodes } from "../src/modules/portals/export";
import { feedDryRunSchema, savePortalConnectionSchema, setPortalFieldMappingSchema } from "../src/modules/portals/input-validation";
import { minorToDecimal, normalizeListing } from "../src/modules/portals/normalize";
import { classifyPortalFailure, nextRetryAt } from "../src/modules/portals/retry";
import { compact, escapeXml, toJson, toXml } from "../src/modules/portals/serialization";
import type { ExportListingRow, FieldMappingRow } from "../src/modules/portals/types";

const now = new Date("2026-10-26T08:00:00.000Z");
const agentHex = "10000000000040008000000000000009";
const agentId = "10000000-0000-4000-8000-000000000009";
const photo = (id: string, extra = {}) => ({id, mediaKind: "PROPERTY_PHOTO", fileName: `${id}.jpg`, contentType: "image/jpeg", isCover: false, sortOrder: 0, ...extra});

function row(overrides: Partial<ExportListingRow> = {}, property: Partial<ExportListingRow["property"]> = {}): ExportListingRow {
  return {
    id: "listing-1", listingReference: "L-100", listingPurpose: "SALE", marketType: "SECONDARY", title: "Two bedroom apartment with marina view",
    description: "A bright two bedroom apartment overlooking Dubai Marina with a large balcony, renovated kitchen and two parking spaces.",
    askingPriceMinor: "185000000", currency: "AED", rentalPeriod: null, listingStatus: "ACTIVE",
    advertisingPermitNumber: "7112345678", permitExpiryDate: "2027-03-01", permitVerificationUrl: null, updatedAt: "2026-10-20T10:00:00.000Z",
    assignedMembershipId: agentHex, assignedMembership: {id: agentHex, role: "AGENT", status: "ACTIVE", userProfile: {displayName: "Sara Agent"}},
    ...overrides,
    property: {
      id: "property-1", propertyReference: "P-100", propertyType: "APARTMENT", marketType: "SECONDARY", bedrooms: 2, bathrooms: 3,
      builtUpArea: 1350, plotArea: null, areaUnit: "SQFT", furnishedStatus: "UNFURNISHED", parkingSpaces: 2, view: "Marina",
      emirate: "DUBAI", community: "Dubai Marina", area: "Marina Promenade", floorNumber: 21, occupancyStatus: "VACANT",
      inventoryStatus: "AVAILABLE", archivedAt: null, project: {projectName: "Marina Heights"}, building: {name: "Tower A"},
      inventoryMedias_on_property: [photo("p1", {isCover: true}), photo("p2"), photo("p3"), photo("p4"), photo("p5")],
      ...property,
    },
  };
}
const codes = (value: ReturnType<typeof buildPortalExport>, severity = "ERROR") => value.issues.filter(issue => issue.severity === severity).map(issue => issue.code);
const exportOf = (value: ExportListingRow, overrides: FieldMappingRow[] = []) => buildPortalExport("PROPERTY_FINDER", value, overrides, now);

test("minor units convert to decimal strings without floating point", () => {
  assert.equal(minorToDecimal("185000000"), "1850000.00");
  assert.equal(minorToDecimal("5"), "0.05");
  assert.equal(minorToDecimal("99999999999999999999"), "999999999999999999.99");
  assert.throws(() => minorToDecimal("12.5"));
});

test("XML serialization escapes content, omits empty values and rejects unsafe element names", () => {
  assert.equal(escapeXml(`<a & "b" 'c'>\u0001`), "&lt;a &amp; &quot;b&quot; &apos;c&apos;&gt;");
  const xml = toXml("listings", "listing", [{title: "Villa <script>", price: {amount: "1.00", period: null}, media: [{reference: "m1"}, {reference: "m2"}], empty: undefined}]);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.ok(xml.includes("<title>Villa &lt;script&gt;</title>"));
  assert.ok(!xml.includes("<period>") && !xml.includes("<empty>"));
  assert.equal(xml.match(/<item>/g)?.length, 2);
  assert.throws(() => toXml("listings", "listing", [{"bad name": "x"}]));
  assert.throws(() => toXml("xmlRoot", "listing", []));
  assert.throws(() => toXml("listings", "listing", [{size: Number.NaN}]));
});

test("JSON serialization is compact, deterministic and drops null values", () => {
  assert.deepEqual(compact({a: null, b: [1, null, {c: undefined, d: 2}]}), {b: [1, {d: 2}]});
  assert.equal(toJson({b: 1, a: null}), `{\n  "b": 1\n}\n`);
  assert.equal(exportOf(row()).payloadHash, exportOf(row()).payloadHash);
  assert.notEqual(exportOf(row()).payloadHash, exportOf(row({title: "Changed title for this listing"})).payloadHash);
});

test("a complete listing is ready and produces matching JSON and XML", () => {
  const result = exportOf(row());
  assert.equal(result.ready, true, JSON.stringify(result.issues));
  assert.deepEqual(codes(result), []);
  const parsed = JSON.parse(result.json);
  assert.equal(parsed.schema, "estateos-draft-v1");
  assert.equal(parsed.propertyType, "apartment");
  assert.equal(parsed.price.amount, "1850000.00");
  assert.equal(parsed.media[0].cover, true);
  assert.ok(result.xml.includes("<reference>L-100</reference>"));
  assert.equal(result.xml.split("<item>").length - 1, parsed.media.length);
});

test("exports never carry private documents, unit numbers or internal property fields", () => {
  const sensitive = row({}, {
    inventoryMedias_on_property: [photo("p1"), {...photo("doc"), mediaKind: "DOCUMENT", fileName: "title-deed.pdf"}, {...photo("bro"), mediaKind: "BROCHURE", fileName: "brochure.pdf"}],
    ...({internalNotes: "SECRET-NOTE", ownershipReference: "SECRET-OWNER", mandateReference: "SECRET-MANDATE", unitNumber: "SECRET-UNIT"} as object),
  });
  const result = exportOf(sensitive);
  for (const output of [result.json, result.xml, JSON.stringify(result.normalized)]) {
    for (const secret of ["SECRET", "title-deed", "brochure.pdf", "agent@"]) assert.ok(!output.includes(secret), `${secret} leaked`);
  }
  assert.deepEqual(result.normalized.media.map(media => media.id), ["p1"]);
});

test("validation reports each missing or invalid required field", () => {
  const cases: [ExportListingRow, string][] = [
    [row({listingStatus: "DRAFT"}), "LISTING_NOT_ACTIVE"],
    [row({}, {inventoryStatus: "SOLD"}), "PROPERTY_UNAVAILABLE"],
    [row({}, {archivedAt: now.toISOString()}), "PROPERTY_ARCHIVED"],
    [row({listingPurpose: "RENT"}), "RENTAL_PERIOD_REQUIRED"],
    [row({askingPriceMinor: "0"}), "PRICE_REQUIRED"],
    [row({currency: "USD"}), "CURRENCY_UNSUPPORTED"],
    [row({}, {emirate: null}), "EMIRATE_REQUIRED"],
    [row({}, {community: "  "}), "COMMUNITY_REQUIRED"],
    [row({}, {bedrooms: null}), "BEDROOMS_REQUIRED"],
    [row({}, {builtUpArea: null}), "SIZE_REQUIRED"],
    [row({}, {propertyType: "PLOT", plotArea: null}), "SIZE_REQUIRED"],
    [row({}, {propertyType: "HOUSEBOAT"}), "PROPERTY_TYPE_UNMAPPED"],
    [row({}, {inventoryMedias_on_property: []}), "PHOTOS_REQUIRED"],
    [row({assignedMembershipId: null, assignedMembership: null}), "AGENT_REQUIRED"],
    [row({assignedMembership: {id: agentHex, role: "AGENT", status: "SUSPENDED", userProfile: null}}), "AGENT_INACTIVE"],
    [row({advertisingPermitNumber: null}), "PERMIT_REQUIRED"],
    [row({permitExpiryDate: "2026-10-25"}), "PERMIT_EXPIRED"],
    [row({description: null}), "DESCRIPTION_REQUIRED"],
  ];
  for (const [input, code] of cases) {
    const result = exportOf(input);
    assert.ok(codes(result).includes(code), `${code} expected, got ${codes(result).join(",")}`);
    assert.equal(result.ready, false);
  }
  // A permit expiring today (Dubai date) is still valid; a 0-bedroom studio is valid.
  assert.ok(!codes(exportOf(row({permitExpiryDate: "2026-10-26"}))).includes("PERMIT_EXPIRED"));
  assert.equal(exportOf(row({}, {bedrooms: 0})).ready, true);
});

test("warnings do not block export and non-Dubai permits are advisory", () => {
  const result = exportOf(row({advertisingPermitNumber: null}, {emirate: "SHARJAH", area: null, inventoryMedias_on_property: [photo("only")]}));
  assert.equal(result.ready, true, codes(result).join(","));
  for (const code of ["PERMIT_NOT_PROVIDED", "AREA_RECOMMENDED", "PHOTOS_RECOMMENDED", "COVER_PHOTO_RECOMMENDED", "AGENT_PORTAL_ID_MISSING"]) assert.ok(codes(result, "WARNING").includes(code), code);
});

test("company mappings override defaults only for their provider and match agent IDs in either UUID form", () => {
  const overrides: FieldMappingRow[] = [
    {provider: "PROPERTY_FINDER", fieldKey: "PROPERTY_TYPE", sourceValue: "APARTMENT", targetValue: "AP"},
    {provider: "BAYUT", fieldKey: "PROPERTY_TYPE", sourceValue: "APARTMENT", targetValue: "BAYUT-AP"},
    {provider: "PROPERTY_FINDER", fieldKey: "AGENT_ID", sourceValue: agentId, targetValue: "PF-AGENT-7"},
  ];
  const result = exportOf(row(), overrides);
  const parsed = JSON.parse(result.json);
  assert.equal(parsed.propertyType, "AP");
  assert.equal(parsed.agent.reference, "PF-AGENT-7");
  assert.ok(!codes(result, "WARNING").includes("AGENT_PORTAL_ID_MISSING"));
  assert.equal(JSON.parse(buildPortalExport("DUBIZZLE", row(), overrides, now).json).propertyType, "apartment");
  const lookup = mappingLookup("BAYUT", portalAdapters.BAYUT.defaultMappings, overrides);
  assert.equal(lookup("PROPERTY_TYPE", "APARTMENT"), "BAYUT-AP");
  assert.equal(lookup("PROPERTY_TYPE", "UNKNOWN"), undefined);
});

test("rental prices carry their period and every provider adapter is registered as unverified", () => {
  const parsed = JSON.parse(exportOf(row({listingPurpose: "RENT", rentalPeriod: "YEARLY", askingPriceMinor: "12000000"})).json);
  assert.deepEqual(parsed.price, {amount: "120000.00", currency: "AED", period: "yearly"});
  assert.deepEqual(Object.keys(portalAdapters).sort(), ["BAYUT", "DUBIZZLE", "PROPERTY_FINDER"]);
  for (const adapter of Object.values(portalAdapters)) assert.equal(adapter.specificationStatus, "UNVERIFIED");
  assert.throws(() => buildPortalExport("UNKNOWN_PORTAL", row(), [], now));
});

test("feed dry runs serialize only valid listings and summarize blocking codes", () => {
  const rows = [row(), row({id: "l2", listingReference: "L-200", currency: "USD"}), row({id: "l3", listingReference: "L-300", advertisingPermitNumber: null, currency: "USD"})];
  for (const format of ["JSON", "XML"] as const) {
    const result = buildFeedDryRun("BAYUT", format, rows, [], now);
    assert.deepEqual({listingCount: result.listingCount, validCount: result.validCount, invalidCount: result.invalidCount}, {listingCount: 3, validCount: 1, invalidCount: 2});
    assert.equal(result.errorSummary, "CURRENCY_UNSUPPORTED:2, PERMIT_REQUIRED:1");
    assert.ok(result.byteSize > 0);
  }
  assert.equal(buildFeedDryRun("BAYUT", "JSON", [], [], now).validCount, 0);
  assert.equal(summarizeErrorCodes([]), null);
  assert.equal(summarizeErrorCodes(Array.from({length: 500}, (_, index) => `CODE_${index}`), 50)!.length, 50);
});

test("portal inputs reject verified-only statuses, credentials and caller-supplied tenants", () => {
  assert.equal(savePortalConnectionSchema.safeParse({provider: "BAYUT", status: "PENDING_APPROVAL"}).success, true);
  for (const status of ["CONNECTED", "ERROR"]) assert.equal(savePortalConnectionSchema.safeParse({provider: "BAYUT", status}).success, false);
  for (const extra of [{apiKey: "secret"}, {password: "secret"}, {organizationId: agentId}]) {
    assert.equal(savePortalConnectionSchema.safeParse({provider: "BAYUT", status: "DISABLED", ...extra}).success, false);
  }
  assert.equal(savePortalConnectionSchema.safeParse({provider: "ZILLOW", status: "DISABLED"}).success, false);
  assert.equal(setPortalFieldMappingSchema.safeParse({provider: "BAYUT", fieldKey: "AGENT_ID", sourceValue: "not-a-uuid", targetValue: "A1"}).success, false);
  assert.equal(setPortalFieldMappingSchema.parse({provider: "BAYUT", fieldKey: "AGENT_ID", sourceValue: agentId.toUpperCase(), targetValue: "A1"}).sourceValue, agentId);
  assert.equal(setPortalFieldMappingSchema.safeParse({provider: "BAYUT", fieldKey: "UNKNOWN", sourceValue: "a", targetValue: "b"}).success, false);
  assert.equal(feedDryRunSchema.safeParse({provider: "BAYUT", format: "CSV"}).success, false);
});

test("retry policy backs off for transient failures and stops for permanent or authentication failures", () => {
  assert.equal(classifyPortalFailure({httpStatus: 503}), "RETRYABLE");
  assert.equal(classifyPortalFailure({httpStatus: 429}), "RETRYABLE");
  assert.equal(classifyPortalFailure({code: "ETIMEDOUT"}), "RETRYABLE");
  assert.equal(classifyPortalFailure({httpStatus: 401}), "AUTHENTICATION");
  assert.equal(classifyPortalFailure({httpStatus: 422}), "PERMANENT");
  assert.equal(nextRetryAt(now, 1, {httpStatus: 503})!.getTime() - now.getTime(), 60_000);
  assert.equal(nextRetryAt(now, 3, {httpStatus: 503})!.getTime() - now.getTime(), 240_000);
  assert.equal(nextRetryAt(now, 1, {httpStatus: 503}, undefined, 1)!.getTime() - now.getTime(), 72_000);
  assert.equal(nextRetryAt(now, 5, {httpStatus: 503}, {baseDelaySeconds: 60, maxDelaySeconds: 300, maxAttempts: 6})!.getTime() - now.getTime(), 300_000);
  assert.equal(nextRetryAt(now, 6, {httpStatus: 503}), null);
  assert.equal(nextRetryAt(now, 1, {httpStatus: 400}), null);
  assert.equal(nextRetryAt(now, 1, {httpStatus: 403}), null);
});

test("normalization trims text and keeps standalone properties without a project", () => {
  const normalized = normalizeListing(row({description: "  "}, {project: null, building: null, community: " Al Barsha "}));
  assert.equal(normalized.description, null);
  assert.equal(normalized.location.project, null);
  assert.equal(normalized.location.community, "Al Barsha");
  assert.equal(normalized.agent?.membershipId, agentId);
});
