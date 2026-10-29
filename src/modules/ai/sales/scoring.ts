/**
 * Rule-based lead qualification (docs/AI_LEAD_QUALIFICATION.md). Pure and
 * deterministic: the same inputs and configuration always give the same
 * score, so every stored assessment can be recomputed and audited.
 *
 * The input type is an allowlist of sales signals. It deliberately has no
 * name, contact details, nationality, language, religion, gender, age,
 * ethnicity, disability, source or free-text notes, so none of them can
 * influence a score. Claude never sets or changes a score.
 */

export const SCORING_RULE_VERSION = "lq-1";

export const LEAD_TIMELINES = ["IMMEDIATE", "WITHIN_3_MONTHS", "WITHIN_6_MONTHS", "WITHIN_12_MONTHS", "LATER", "UNDECIDED"] as const;
export const LEAD_READINESS = ["READY_TO_PROCEED", "EXPLORING", "NOT_READY"] as const;
export const AI_LEAD_PRIORITIES = ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT_DATA"] as const;
export type LeadTimeline = (typeof LEAD_TIMELINES)[number];
export type LeadReadiness = (typeof LEAD_READINESS)[number];
export type AiLeadPriority = (typeof AI_LEAD_PRIORITIES)[number];

export const FACTOR_KEYS = ["requirements", "inventoryFit", "timeline", "readiness", "recentInteraction", "viewings", "engagement"] as const;
export type FactorKey = (typeof FACTOR_KEYS)[number];

export interface ScoringConfig {
  /** Maximum points per factor. Factors that cannot be evaluated are left out of the total. */
  weights: Record<FactorKey, number>;
  /** Score at or above `high` is HIGH, at or above `medium` is MEDIUM, otherwise LOW. */
  thresholds: {high: number; medium: number};
  /** A score is shown only when at least this many points could be evaluated... */
  minimumEvaluatedWeight: number;
  /** ...and at least this many of the four requirement fields are recorded. */
  minimumRequirementFields: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {requirements: 25, inventoryFit: 20, timeline: 15, readiness: 10, recentInteraction: 15, viewings: 15, engagement: 10},
  thresholds: {high: 70, medium: 45},
  minimumEvaluatedWeight: 60,
  minimumRequirementFields: 2,
};

const CLOSED_STATUSES = new Set(["WON", "LOST", "CONVERTED"]);
const STAGE_PROGRESS: Record<string, number> = {NEW: 0, CONTACTED: 0.3, QUALIFIED: 0.6, VIEWING_SCHEDULED: 0.6, VIEWING_COMPLETED: 0.6, NEGOTIATION: 1};
const TIMELINE_FRACTION: Record<LeadTimeline, number> = {IMMEDIATE: 1, WITHIN_3_MONTHS: 0.8, WITHIN_6_MONTHS: 0.55, WITHIN_12_MONTHS: 0.3, LATER: 0.1, UNDECIDED: 0};
const READINESS_FRACTION: Record<LeadReadiness, number> = {READY_TO_PROCEED: 1, EXPLORING: 0.5, NOT_READY: 0};

export const TIMELINE_LABELS: Record<LeadTimeline, string> = {
  IMMEDIATE: "Immediately", WITHIN_3_MONTHS: "Within 3 months", WITHIN_6_MONTHS: "Within 6 months",
  WITHIN_12_MONTHS: "Within 12 months", LATER: "More than 12 months", UNDECIDED: "Undecided",
};
export const READINESS_LABELS: Record<LeadReadiness, string> = {READY_TO_PROCEED: "Ready to proceed", EXPLORING: "Exploring options", NOT_READY: "Not ready yet"};
export const PRIORITY_LABELS: Record<AiLeadPriority, string> = {HIGH: "High priority", MEDIUM: "Medium priority", LOW: "Low priority", INSUFFICIENT_DATA: "Insufficient data"};
export const FACTOR_LABELS: Record<FactorKey, string> = {
  requirements: "Requirement completeness", inventoryFit: "Budget and inventory fit", timeline: "Customer-stated timeline",
  readiness: "Customer-stated readiness", recentInteraction: "Recent interaction", viewings: "Viewings", engagement: "Engagement history",
};

/** Lead activity kinds that record staff work with the customer (creation, assignment and AI events are excluded). */
export const INTERACTION_KINDS = new Set([
  "LEAD_NOTE_ADDED", "LEAD_STATUS_CHANGED", "FOLLOW_UP_COMPLETED", "LEAD_PROPERTY_INTEREST_CHANGED",
  "LEAD_PROPERTY_VIEWING_SCHEDULED", "LEAD_PROPERTY_VIEWING_UPDATED", "LEAD_QUALIFICATION_UPDATED",
]);

export interface ScoringInput {
  /** ISO time the evaluation is made at. */
  now: string;
  lead: {
    status: string;
    archived: boolean;
    transactionType: "BUY" | "RENT" | "INVEST";
    preferredLocation: string | null;
    propertyType: string | null;
    bedroomPreference: string | null;
    budgetMin: number | null;
    budgetMax: number | null;
  };
  qualification: {timeline: LeadTimeline | null; readiness: LeadReadiness | null};
  /** Matches from the existing lead-to-property engine; `available: false` when the member has no inventory scope. */
  inventory: {available: boolean; matchCount: number; complete: boolean};
  /** Most recent interaction activity (see INTERACTION_KINDS), or null when none is recorded. */
  lastInteractionAt: string | null;
  viewings: {
    available: boolean;
    upcomingConfirmed: number; upcomingPending: number;
    completedPositive: number; completedNeutral: number; completedNegativeOrNoShow: number;
  };
  shortlist: {available: boolean; interested: number; saved: number};
}

export type FactorStatus = "EVALUATED" | "MISSING" | "NOT_AVAILABLE";

export interface ScoreFactor {
  key: FactorKey;
  label: string;
  status: FactorStatus;
  /** Points earned; null when the factor was not evaluated. */
  points: number | null;
  maxPoints: number;
  evidence: string;
}

export interface MissingItem { key: string; label: string }

export interface QualificationResult {
  ruleVersion: string;
  configHash: string;
  state: "SCORED" | "INSUFFICIENT_DATA" | "CLOSED";
  score: number | null;
  priority: AiLeadPriority;
  sufficientData: boolean;
  evaluatedWeight: number;
  factors: ScoreFactor[];
  missing: MissingItem[];
  evaluatedAt: string;
}

/** Small stable hash (FNV-1a) of the configuration, stored with each assessment. */
export function scoringConfigHash(config: ScoringConfig) {
  const text = JSON.stringify([FACTOR_KEYS.map(key => config.weights[key]), config.thresholds.high, config.thresholds.medium, config.minimumEvaluatedWeight, config.minimumRequirementFields]);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, "0");
}

/**
 * Optional JSON override (AI_LEAD_SCORING). Invalid values are reported as
 * problems and the defaults are kept, so a typo can never silently change scores.
 */
export function resolveScoringConfig(raw: string | undefined, problems: string[] = []): ScoringConfig {
  const config: ScoringConfig = structuredClone(DEFAULT_SCORING_CONFIG);
  if (!raw?.trim()) return config;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    problems.push("AI_LEAD_SCORING is not valid JSON.");
    return config;
  }
  const isInt = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
  const input = parsed as {weights?: Record<string, unknown>; thresholds?: Record<string, unknown>; minimumEvaluatedWeight?: unknown; minimumRequirementFields?: unknown};
  if (typeof parsed !== "object" || parsed === null) { problems.push("AI_LEAD_SCORING must be a JSON object."); return config; }
  for (const [key, value] of Object.entries(input.weights ?? {})) {
    if (!(FACTOR_KEYS as readonly string[]).includes(key)) problems.push(`AI_LEAD_SCORING has an unknown factor "${key}".`);
    else if (!isInt(value, 0, 100)) problems.push(`AI_LEAD_SCORING weight ${key} must be a whole number from 0 to 100.`);
    else config.weights[key as FactorKey] = value;
  }
  for (const key of ["high", "medium"] as const) {
    const value = input.thresholds?.[key];
    if (value === undefined) continue;
    if (!isInt(value, 1, 100)) problems.push(`AI_LEAD_SCORING threshold ${key} must be a whole number from 1 to 100.`);
    else config.thresholds[key] = value;
  }
  if (config.thresholds.medium >= config.thresholds.high) problems.push("AI_LEAD_SCORING thresholds: medium must be lower than high.");
  if (input.minimumEvaluatedWeight !== undefined) {
    if (!isInt(input.minimumEvaluatedWeight, 0, 100)) problems.push("AI_LEAD_SCORING minimumEvaluatedWeight must be a whole number from 0 to 100.");
    else config.minimumEvaluatedWeight = input.minimumEvaluatedWeight;
  }
  if (input.minimumRequirementFields !== undefined) {
    if (!isInt(input.minimumRequirementFields, 0, 4)) problems.push("AI_LEAD_SCORING minimumRequirementFields must be a whole number from 0 to 4.");
    else config.minimumRequirementFields = input.minimumRequirementFields;
  }
  if (FACTOR_KEYS.reduce((sum, key) => sum + config.weights[key], 0) <= 0) problems.push("AI_LEAD_SCORING weights must not all be zero.");
  return problems.length ? structuredClone(DEFAULT_SCORING_CONFIG) : config;
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const days = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000;
const filled = (value: string | null | undefined) => Boolean(value?.trim());

export function evaluateLead(input: ScoringInput, config: ScoringConfig = DEFAULT_SCORING_CONFIG): QualificationResult {
  const {lead, qualification, inventory, viewings, shortlist} = input;
  const w = config.weights;
  const factors: ScoreFactor[] = [];
  const missing: MissingItem[] = [];
  const add = (key: FactorKey, status: FactorStatus, fraction: number | null, evidence: string) => {
    factors.push({key, label: FACTOR_LABELS[key], status, maxPoints: w[key], points: status === "EVALUATED" && fraction !== null ? round1(w[key] * Math.max(0, Math.min(1, fraction))) : null, evidence});
  };

  // 1. Requirement completeness: location 6, property type 5, bedrooms 4, budget 10 (of 25).
  const hasBudget = lead.budgetMin != null || lead.budgetMax != null;
  const requirementParts = [
    {key: "preferredLocation", label: "Preferred location", present: filled(lead.preferredLocation), share: 6},
    {key: "propertyType", label: "Property type", present: filled(lead.propertyType), share: 5},
    {key: "bedroomPreference", label: "Bedrooms", present: filled(lead.bedroomPreference), share: 4},
    {key: "budget", label: "Budget", present: hasBudget, share: 10},
  ];
  const requirementFields = requirementParts.filter(part => part.present).length;
  for (const part of requirementParts) if (!part.present) missing.push({key: part.key, label: part.label});
  add("requirements", "EVALUATED", requirementParts.reduce((sum, part) => sum + (part.present ? part.share : 0), 0) / 25,
    requirementFields === 4 ? "Location, property type, bedrooms and budget are recorded." : `${requirementFields} of 4 requirement fields recorded (missing: ${requirementParts.filter(part => !part.present).map(part => part.label.toLowerCase()).join(", ")}).`);

  // 2. Budget and inventory fit, from the existing matching engine.
  if (!hasBudget) add("inventoryFit", "MISSING", null, "No budget is recorded, so fit with current inventory cannot be judged.");
  else if (!inventory.available) add("inventoryFit", "NOT_AVAILABLE", null, "Your role has no inventory access, so inventory fit was not evaluated.");
  else {
    const fraction = inventory.matchCount >= 3 ? 1 : inventory.matchCount >= 1 ? 0.7 : 0;
    const scope = inventory.complete ? "" : " (first page of candidates reviewed)";
    add("inventoryFit", "EVALUATED", fraction, inventory.matchCount
      ? `${inventory.matchCount} available propert${inventory.matchCount === 1 ? "y" : "ies"} with an active listing match the requirements and budget${scope}.`
      : `No available property with an active listing matches the requirements and budget${scope}.`);
  }

  // 3-4. Customer-stated timeline and readiness, as recorded by staff.
  if (qualification.timeline) add("timeline", "EVALUATED", TIMELINE_FRACTION[qualification.timeline], `Customer-stated timeline: ${TIMELINE_LABELS[qualification.timeline].toLowerCase()}.`);
  else { add("timeline", "MISSING", null, "No purchase or rental timeline is recorded."); missing.push({key: "timeline", label: "Timeline"}); }
  if (qualification.readiness) add("readiness", "EVALUATED", READINESS_FRACTION[qualification.readiness], `Customer-stated readiness: ${READINESS_LABELS[qualification.readiness].toLowerCase()}.`);
  else { add("readiness", "MISSING", null, "Readiness to proceed is not recorded."); missing.push({key: "readiness", label: "Readiness to proceed"}); }

  // 5. Recent interaction recorded in the CRM.
  if (!input.lastInteractionAt) add("recentInteraction", "EVALUATED", 0, "No interaction is recorded since the lead was created.");
  else {
    const age = Math.max(0, days(input.lastInteractionAt, input.now));
    const fraction = age <= 3 ? 1 : age <= 7 ? 0.7 : age <= 14 ? 0.4 : age <= 30 ? 0.2 : 0;
    add("recentInteraction", "EVALUATED", fraction, `Last recorded interaction ${age < 1 ? "today" : `${Math.floor(age)} day${Math.floor(age) === 1 ? "" : "s"} ago`}.`);
  }

  // 6. Viewings.
  if (!viewings.available) add("viewings", "NOT_AVAILABLE", null, "Viewings are not available to your role.");
  else if (viewings.upcomingConfirmed || viewings.completedPositive) add("viewings", "EVALUATED", 1, viewings.upcomingConfirmed ? `${viewings.upcomingConfirmed} upcoming confirmed viewing(s).` : `${viewings.completedPositive} completed viewing(s) with a positive outcome.`);
  else if (viewings.upcomingPending) add("viewings", "EVALUATED", 0.7, `${viewings.upcomingPending} upcoming viewing(s) awaiting customer confirmation.`);
  else if (viewings.completedNeutral) add("viewings", "EVALUATED", 0.5, `${viewings.completedNeutral} completed viewing(s) with a neutral outcome.`);
  else if (viewings.completedNegativeOrNoShow) add("viewings", "EVALUATED", 0.1, "Completed viewings had negative outcomes or no-shows.");
  else add("viewings", "EVALUATED", 0, "No viewing has been scheduled.");

  // 7. Engagement history: pipeline progress (60%) and shortlist interest (40%).
  const stage = STAGE_PROGRESS[lead.status] ?? 0;
  if (shortlist.available) {
    const interest = shortlist.interested ? 1 : shortlist.saved ? 0.5 : 0;
    add("engagement", "EVALUATED", 0.6 * stage + 0.4 * interest,
      `Stage ${lead.status.replaceAll("_", " ").toLowerCase()}; ${shortlist.interested} shortlisted propert${shortlist.interested === 1 ? "y" : "ies"} marked interested, ${shortlist.saved} saved.`);
  } else add("engagement", "EVALUATED", stage, `Stage ${lead.status.replaceAll("_", " ").toLowerCase()} (shortlist not available to your role).`);

  const evaluated = factors.filter(factor => factor.status === "EVALUATED");
  const evaluatedWeight = evaluated.reduce((sum, factor) => sum + factor.maxPoints, 0);
  const earned = evaluated.reduce((sum, factor) => sum + (factor.points ?? 0), 0);
  const base = {ruleVersion: SCORING_RULE_VERSION, configHash: scoringConfigHash(config), evaluatedWeight, factors, missing, evaluatedAt: input.now};

  if (lead.archived || CLOSED_STATUSES.has(lead.status)) {
    return {...base, state: "CLOSED", score: null, priority: "INSUFFICIENT_DATA", sufficientData: false};
  }
  const sufficientData = evaluatedWeight > 0 && evaluatedWeight >= config.minimumEvaluatedWeight && requirementFields >= config.minimumRequirementFields;
  if (!sufficientData) return {...base, state: "INSUFFICIENT_DATA", score: null, priority: "INSUFFICIENT_DATA", sufficientData};
  const score = Math.round((100 * earned) / evaluatedWeight);
  const priority: AiLeadPriority = score >= config.thresholds.high ? "HIGH" : score >= config.thresholds.medium ? "MEDIUM" : "LOW";
  return {...base, state: "SCORED", score, priority, sufficientData};
}
