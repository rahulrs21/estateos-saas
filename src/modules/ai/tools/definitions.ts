import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * The Copilot's complete, read-only tool registry. Each tool has:
 * - a JSON schema sent to Claude with `strict: true` (no numeric or length
 *   keywords, which strict mode does not support), and
 * - a Zod schema the server applies before executing anything, which adds the
 *   limits and is the authority. tests/ai-tools.test.ts keeps both in step.
 * Nothing here accepts an organization, user, role or membership: tools run
 * with the verified session's own scope.
 */

export const EMIRATES = ["ABU_DHABI", "DUBAI", "SHARJAH", "AJMAN", "UMM_AL_QUWAIN", "RAS_AL_KHAIMAH", "FUJAIRAH"] as const;
export const PROPERTY_TYPES = ["APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "PLOT", "COMMERCIAL", "OFFICE", "RETAIL", "WAREHOUSE"] as const;
export const PROJECT_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE", "COMPLETED"] as const;
export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "VIEWING_SCHEDULED", "VIEWING_COMPLETED", "NEGOTIATION", "WON", "LOST", "CONVERTED"] as const;
export const LEAD_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

const text = (max: number) => z.string().trim().min(1).max(max);
const uuid = z.string().trim().toLowerCase().regex(/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/, "Use an id returned by an EstateOS tool.");
const amount = z.number().finite().min(0).max(1e12);
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Use a valid date.");
const limit = (max: number, fallback: number) => z.number().int().min(1).max(max).default(fallback);
const minMax = (value: {minPrice?: number; maxPrice?: number}) => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice;

export const searchPropertiesInput = z.strictObject({
  emirate: z.enum(EMIRATES).optional(),
  community: text(120).optional(),
  propertyType: z.enum(PROPERTY_TYPES).optional(),
  bedrooms: z.number().int().min(0).max(20).optional(),
  minBedrooms: z.number().int().min(0).max(20).optional(),
  minPrice: amount.optional(),
  maxPrice: amount.optional(),
  purpose: z.enum(["SALE", "RENT"]).optional(),
  availability: z.enum(["AVAILABLE", "RESERVED", "ANY"]).default("AVAILABLE"),
  marketType: z.enum(["OFF_PLAN", "SECONDARY"]).optional(),
  projectId: uuid.optional(),
  projectName: text(120).optional(),
  limit: limit(20, 10),
}).refine(minMax, "minPrice cannot be greater than maxPrice.");

export const getPropertyDetailsInput = z.strictObject({
  propertyId: uuid.optional(),
  propertyReference: text(80).optional(),
}).refine(value => Boolean(value.propertyId) !== Boolean(value.propertyReference), "Provide exactly one of propertyId or propertyReference.");

export const searchProjectsInput = z.strictObject({
  name: text(120).optional(),
  developerName: text(120).optional(),
  emirate: z.enum(EMIRATES).optional(),
  community: text(120).optional(),
  projectStatus: z.enum(PROJECT_STATUSES).optional(),
  handoverFrom: calendarDate.optional(),
  handoverTo: calendarDate.optional(),
  minStartingPrice: amount.optional(),
  maxStartingPrice: amount.optional(),
  limit: limit(20, 10),
}).refine(value => !value.handoverFrom || !value.handoverTo || value.handoverFrom <= value.handoverTo, "handoverFrom must be on or before handoverTo.")
  .refine(value => value.minStartingPrice === undefined || value.maxStartingPrice === undefined || value.minStartingPrice <= value.maxStartingPrice, "minStartingPrice cannot be greater than maxStartingPrice.");

export const getProjectDetailsInput = z.strictObject({
  projectId: uuid.optional(),
  projectName: text(120).optional(),
}).refine(value => Boolean(value.projectId) !== Boolean(value.projectName), "Provide exactly one of projectId or projectName.");

export const searchLeadsInput = z.strictObject({
  search: text(120).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  transactionType: z.enum(["BUY", "RENT", "INVEST"]).optional(),
  followUp: z.enum(["ANY", "OVERDUE", "TODAY", "UPCOMING"]).default("ANY"),
  assignment: z.enum(["ANY", "MINE", "UNASSIGNED"]).default("ANY"),
  assignedAgentName: text(120).optional(),
  source: text(120).optional(),
  preferredLocation: text(120).optional(),
  minBudget: amount.optional(),
  maxBudget: amount.optional(),
  limit: limit(25, 10),
}).refine(value => value.minBudget === undefined || value.maxBudget === undefined || value.minBudget <= value.maxBudget, "minBudget cannot be greater than maxBudget.")
  .refine(value => !(value.assignedAgentName && value.assignment !== "ANY"), "Use either assignment or assignedAgentName, not both.");

export const getLeadDetailsInput = z.strictObject({leadId: uuid});
export const getDashboardSummaryInput = z.strictObject({});
export const getMatchingPropertiesForLeadInput = z.strictObject({leadId: uuid, limit: limit(20, 10)});
export const getLeadQualificationInput = z.strictObject({leadId: uuid});

type JsonSchema = Anthropic.Messages.Tool.InputSchema;
const str = (description: string) => ({type: "string", description});
const int = (description: string) => ({type: "integer", description});
const num = (description: string) => ({type: "number", description});
const oneOf = (values: readonly string[], description: string) => ({type: "string", enum: [...values], description});
const object = (properties: Record<string, unknown>, required: string[] = []): JsonSchema => ({type: "object", properties, required, additionalProperties: false});

export const AI_TOOL_DEFINITIONS = [
  {
    name: "searchProperties",
    description: "Search the company's property inventory the user is allowed to see. Without `purpose`, searches property units (default: AVAILABLE only) and reports each unit's reference price. With `purpose` SALE or RENT, searches ACTIVE listings instead and reports their asking prices (rents are annual unless the listing says monthly). Location text is matched against community, area, city and project names, and common abbreviations such as JVC, JLT and Downtown are understood. Returns at most `limit` results plus coverage information; an empty result means nothing matched in the data available to this user.",
    input_schema: object({
      emirate: oneOf(EMIRATES, "Emirate filter."),
      community: str("Location text: community, area or district, e.g. Dubai Marina, Business Bay, JVC."),
      propertyType: oneOf(PROPERTY_TYPES, "Property type."),
      bedrooms: int("Exact number of bedrooms; 0 means studio."),
      minBedrooms: int("Minimum bedrooms, for requests like 2+ bedrooms."),
      minPrice: num("Minimum price in AED (whole currency units, not fils)."),
      maxPrice: num("Maximum price in AED (whole currency units). For RENT this is annual rent."),
      purpose: oneOf(["SALE", "RENT"], "Set to search active sale or rental listings with asking prices."),
      availability: oneOf(["AVAILABLE", "RESERVED", "ANY"], "Unit inventory status filter when purpose is not set. Default AVAILABLE."),
      marketType: oneOf(["OFF_PLAN", "SECONDARY"], "Off-plan or secondary (ready) market."),
      projectId: str("Project id returned by searchProjects."),
      projectName: str("Project name text to match when the id is unknown."),
      limit: int("Maximum results to return, 1-20. Default 10."),
    }),
  },
  {
    name: "getPropertyDetails",
    description: "Get one property the user is allowed to see, by id or by property reference: type, location (respecting the record's map privacy setting), bedrooms, bathrooms, size, reference price, availability, project, and its active or recent listings with asking prices. Provide exactly one of propertyId or propertyReference.",
    input_schema: object({
      propertyId: str("Property id returned by another tool."),
      propertyReference: str("The property's reference code, e.g. EST-1042."),
    }),
  },
  {
    name: "searchProjects",
    description: "Search the company's developer projects: by name, developer, emirate, community or area, project status, expected handover date range and starting price (AED). Returns project summaries with available unit counts the user can see.",
    input_schema: object({
      name: str("Project name text."),
      developerName: str("Developer name text."),
      emirate: oneOf(EMIRATES, "Emirate filter."),
      community: str("Community, area or city text, e.g. Business Bay."),
      projectStatus: oneOf(PROJECT_STATUSES, "Project status."),
      handoverFrom: {type: "string", format: "date", description: "Expected handover on or after this date (YYYY-MM-DD)."},
      handoverTo: {type: "string", format: "date", description: "Expected handover on or before this date (YYYY-MM-DD)."},
      minStartingPrice: num("Minimum starting price in AED."),
      maxStartingPrice: num("Maximum starting price in AED."),
      limit: int("Maximum results, 1-20. Default 10."),
    }),
  },
  {
    name: "getProjectDetails",
    description: "Get one project by id or exact name: developer, location, description, status, handover dates, starting price, phases, payment plans, and a breakdown of available unit types the user can see. Provide exactly one of projectId or projectName.",
    input_schema: object({
      projectId: str("Project id returned by searchProjects."),
      projectName: str("Project name."),
    }),
  },
  {
    name: "searchLeads",
    description: "Search leads the user is permitted to see (agents: only leads assigned to them). Filters: name search, status, priority, transaction type, follow-up timing (OVERDUE, TODAY in Dubai time, UPCOMING), assignment (MINE or UNASSIGNED) or assigned agent name, lead source, preferred location and budget range in AED. Returns qualification summaries without phone numbers or email addresses.",
    input_schema: object({
      search: str("Lead or contact name text."),
      status: oneOf(LEAD_STATUSES, "Lead status."),
      priority: oneOf(LEAD_PRIORITIES, "Lead priority."),
      transactionType: oneOf(["BUY", "RENT", "INVEST"], "What the customer wants to do."),
      followUp: oneOf(["ANY", "OVERDUE", "TODAY", "UPCOMING"], "Next follow-up timing. Default ANY."),
      assignment: oneOf(["ANY", "MINE", "UNASSIGNED"], "Assignment filter. Default ANY."),
      assignedAgentName: str("Name or email text of the assigned agent (owners and administrators)."),
      source: str("Lead source text, e.g. Property Finder, website, referral."),
      preferredLocation: str("Text matched against the lead's preferred location."),
      minBudget: num("Leads whose budget reaches at least this AED amount."),
      maxBudget: num("Leads whose budget starts at or below this AED amount."),
      limit: int("Maximum results, 1-25. Default 10."),
    }),
  },
  {
    name: "getLeadDetails",
    description: "Get one permitted lead by id: status, priority, requirements (location, type, bedrooms, budget, buy/rent/invest), interested project and property, shortlist, viewings, follow-ups and recent activity types. Contact details and note text are not included.",
    input_schema: object({leadId: str("Lead id returned by searchLeads.")}, ["leadId"]),
  },
  {
    name: "getDashboardSummary",
    description: "Get the user's current CRM figures from live queries: total, new, qualified and won leads, overdue and upcoming follow-ups, and (where the role has inventory access) total, available and reserved properties and active listings. Agents receive their own assigned figures.",
    input_schema: object({}),
  },
  {
    name: "getMatchingPropertiesForLead",
    description: "Run EstateOS's existing lead-to-property matching for one permitted lead: available inventory with an active listing that fits the lead's location, type, bedrooms, transaction type and budget, with the reasons for each match.",
    input_schema: object({
      leadId: str("Lead id returned by searchLeads."),
      limit: int("Maximum matches to return, 1-20. Default 10."),
    }, ["leadId"]),
  },
  {
    name: "getLeadQualification",
    description: "Evaluate one permitted lead with EstateOS's rule-based qualification (Phase 6C): score 0-100 or insufficient data, priority label, each factor's points and evidence, missing information, the latest stored assessment and any human review, and follow-up suggestions (overdue follow-ups, unanswered enquiry, unconfirmed viewings and similar). The score is calculated by EstateOS rules; explain it, never change it.",
    input_schema: object({leadId: str("Lead id returned by searchLeads.")}, ["leadId"]),
  },
] as const;

export type AiToolName = (typeof AI_TOOL_DEFINITIONS)[number]["name"];

export const AI_TOOL_INPUT_SCHEMAS = {
  searchProperties: searchPropertiesInput,
  getPropertyDetails: getPropertyDetailsInput,
  searchProjects: searchProjectsInput,
  getProjectDetails: getProjectDetailsInput,
  searchLeads: searchLeadsInput,
  getLeadDetails: getLeadDetailsInput,
  getDashboardSummary: getDashboardSummaryInput,
  getMatchingPropertiesForLead: getMatchingPropertiesForLeadInput,
  getLeadQualification: getLeadQualificationInput,
} satisfies Record<AiToolName, z.ZodType>;

export type AiToolInputs = {[K in AiToolName]: z.output<(typeof AI_TOOL_INPUT_SCHEMAS)[K]>};

/**
 * Anthropic's strict mode caps, across all tools in one request, the number
 * of optional parameters and of union-typed (for example nullable) ones.
 */
export const STRICT_OPTIONAL_PARAMETER_LIMIT = 24;
export const STRICT_UNION_PARAMETER_LIMIT = 16;

/**
 * Tool definitions in Anthropic's format, with strict schema adherence.
 * To stay within the strict-mode limits, the first 24 optional parameters stay
 * optional and the rest are sent as required-but-nullable: Claude passes null
 * for those it does not use, and the executor drops nulls (withoutNullArguments)
 * before the Zod schema applies defaults. tests/ai-tools.test.ts checks the limits.
 */
export function anthropicTools(): Anthropic.Messages.Tool[] {
  let optional = 0;
  return AI_TOOL_DEFINITIONS.map(tool => {
    const schema = tool.input_schema as {properties: Record<string, {type: string; enum?: string[]; description?: string}>; required: string[]};
    const required = [...schema.required];
    const properties = Object.fromEntries(Object.entries(schema.properties).map(([name, property]) => {
      if (schema.required.includes(name)) return [name, property];
      if (optional < STRICT_OPTIONAL_PARAMETER_LIMIT) { optional += 1; return [name, property]; }
      required.push(name);
      const {description, ...value} = property;
      return [name, {anyOf: [value, {type: "null"}], description: `${description ?? ""} Null when not used.`.trim()}];
    }));
    return {
      name: tool.name,
      description: tool.description,
      input_schema: {type: "object", properties, required, additionalProperties: false},
      strict: true,
    };
  });
}

/** Treat null arguments as omitted. Only top-level nulls are dropped; nested values are left to validation. */
export function withoutNullArguments(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  return Object.fromEntries(Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== null));
}

export function isAiToolName(name: string): name is AiToolName {
  return Object.hasOwn(AI_TOOL_INPUT_SCHEMAS, name);
}

/** Short, non-sensitive progress labels shown in the chat while a tool runs. */
export const AI_TOOL_LABELS: Record<AiToolName, string> = {
  searchProperties: "Searching properties",
  getPropertyDetails: "Reading property details",
  searchProjects: "Searching projects",
  getProjectDetails: "Reading project details",
  searchLeads: "Searching leads",
  getLeadDetails: "Reading lead details",
  getDashboardSummary: "Loading dashboard figures",
  getMatchingPropertiesForLead: "Matching properties to the lead",
  getLeadQualification: "Evaluating lead qualification",
};
