import { z } from "zod";

/*
 * The workflow definition format (docs/AUTOMATION_ENGINE.md#workflow-schema).
 * A definition is plain, versioned JSON: an allowlisted trigger, declarative
 * conditions over allowlisted facts and a list of allowlisted actions with
 * typed, bounded arguments. Nothing in it is code: there are no expressions,
 * selectors, URLs, scripts or SQL, and the engine never evaluates text.
 */

export const DEFINITION_SCHEMA_VERSION = 1;

export const LIMITS = {
  /** Steps in one workflow. */
  steps: 24,
  /** Nested condition groups. */
  conditionDepth: 3,
  /** Workflows started by events that a workflow created, counted from the original CRM event. */
  chainDepth: 3,
  /** Claude-backed steps in one execution. */
  aiStepsPerWorkflow: 3,
  /** The longest single delay, in minutes (30 days). */
  delayMinutes: 43_200,
  /** An execution older than this is cancelled. */
  executionDays: 90,
  /** Attempts of a failing step before the execution fails. */
  stepAttempts: 3,
  /** Executions started per company per day (UTC). */
  dailyExecutions: 1000,
  /** Claude calls made by workflows per company per day (UTC). */
  dailyAiCalls: 50,
  /** Steps run by one worker tick for one execution before it yields. */
  stepsPerTick: 10,
  /** A claimed job is reclaimable after this many seconds. */
  leaseSeconds: 120,
  /** Active workflows per company. */
  activeWorkflows: 50,
  /** Workflows per company (all statuses). */
  workflows: 200,
} as const;

// --- Facts -----------------------------------------------------------------------------------

export type FactKind = "string" | "number" | "boolean" | "date";
export interface FactDefinition { kind: FactKind; label: string; options?: readonly string[] }

const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "VIEWING_SCHEDULED", "VIEWING_COMPLETED", "NEGOTIATION", "WON", "LOST", "CONVERTED"] as const;
const LEAD_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
const LISTING_STATUSES = ["DRAFT", "PENDING_REVIEW", "APPROVED", "ACTIVE", "PAUSED", "CLOSED", "ARCHIVED", "UNDER_OFFER", "SOLD", "RENTED", "WITHDRAWN", "EXPIRED"] as const;

const EVENT_FACTS = {
  "event.origin": {kind: "string", label: "Event origin", options: ["CRM", "WEBSITE", "WORKFLOW", "SCHEDULE", "MANUAL", "PROVIDER"]},
  "event.occurredAt": {kind: "date", label: "Event time"},
} as const satisfies Record<string, FactDefinition>;
const LEAD_FACTS = {
  "lead.status": {kind: "string", label: "Lead status", options: LEAD_STATUSES},
  "lead.previousStatus": {kind: "string", label: "Previous lead status", options: LEAD_STATUSES},
  "lead.source": {kind: "string", label: "Lead source"},
  "lead.priority": {kind: "string", label: "Lead priority", options: LEAD_PRIORITIES},
  "lead.assignedAgentId": {kind: "string", label: "Assigned agent"},
  "lead.projectId": {kind: "string", label: "Project"},
  "lead.propertyId": {kind: "string", label: "Property"},
  "lead.budgetMax": {kind: "number", label: "Maximum budget (AED)"},
  "lead.archived": {kind: "boolean", label: "Lead archived"},
  "lead.contacted": {kind: "boolean", label: "Contacted since the event (note, call or status change by a person)"},
  "lead.followupCompleted": {kind: "boolean", label: "A follow-up was completed since the event"},
  "lead.createdAt": {kind: "date", label: "Lead created"},
} as const satisfies Record<string, FactDefinition>;
const TASK_FACTS = {
  "task.status": {kind: "string", label: "Task status", options: ["PENDING", "COMPLETED", "CANCELLED"]},
  "task.dueAt": {kind: "date", label: "Task due"},
  "task.assignedAgentId": {kind: "string", label: "Task assignee"},
  "task.kind": {kind: "string", label: "Task kind", options: ["FOLLOW_UP", "WORK_TASK"]},
} as const satisfies Record<string, FactDefinition>;
const VIEWING_FACTS = {
  "viewing.status": {kind: "string", label: "Viewing status", options: ["SCHEDULED", "COMPLETED", "CANCELLED"]},
  "viewing.outcome": {kind: "string", label: "Viewing outcome", options: ["POSITIVE", "NEUTRAL", "NEGATIVE", "NO_SHOW"]},
  "viewing.scheduledAt": {kind: "date", label: "Viewing time"},
} as const satisfies Record<string, FactDefinition>;
const LISTING_FACTS = {
  "listing.status": {kind: "string", label: "Listing status", options: LISTING_STATUSES},
  "listing.previousStatus": {kind: "string", label: "Previous listing status", options: LISTING_STATUSES},
  "listing.purpose": {kind: "string", label: "Listing purpose", options: ["SALE", "RENT"]},
  "listing.assignedAgentId": {kind: "string", label: "Listing agent"},
  "listing.price": {kind: "number", label: "Asking price (AED)"},
} as const satisfies Record<string, FactDefinition>;
/** Calls (6F.6): connection facts and what the agent recorded; never notes, numbers or transcripts. */
const CALL_FACTS = {
  "call.direction": {kind: "string", label: "Call direction", options: ["OUTBOUND", "INBOUND"]},
  "call.type": {kind: "string", label: "Call purpose", options: ["SERVICE", "FOLLOW_UP", "MARKETING", "INBOUND_ENQUIRY"]},
  "call.status": {kind: "string", label: "Call status", options: ["INITIATED", "RINGING", "IN_PROGRESS", "COMPLETED", "FAILED", "BUSY", "NO_ANSWER", "CANCELLED"]},
  "call.outcome": {kind: "string", label: "Call outcome", options: ["INTERESTED", "NOT_INTERESTED", "CALLBACK_REQUESTED", "VIEWING_REQUESTED", "NO_DECISION", "WRONG_NUMBER", "DO_NOT_CALL_REQUESTED", "OFFER_REJECTED"]},
  "call.durationSeconds": {kind: "number", label: "Call duration (seconds)"},
  "call.source": {kind: "string", label: "How the call was recorded", options: ["MANUAL", "PROVIDER"]},
  "call.agentId": {kind: "string", label: "Call agent"},
} as const satisfies Record<string, FactDefinition>;
const MEETING_FACTS = {
  "meeting.status": {kind: "string", label: "Meeting status", options: ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]},
  "meeting.provider": {kind: "string", label: "Meeting type", options: ["GOOGLE_MEET", "MICROSOFT_TEAMS", "ZOOM", "WEBEX", "IN_PERSON", "PHONE", "OTHER"]},
  "meeting.startsAt": {kind: "date", label: "Meeting start"},
  "meeting.organizerId": {kind: "string", label: "Meeting organizer"},
} as const satisfies Record<string, FactDefinition>;
const CONTACT_FACTS = {
  "contact.preferredLanguage": {kind: "string", label: "Preferred language"},
  "contact.hasEmail": {kind: "boolean", label: "Has an email address"},
  "contact.hasPhone": {kind: "boolean", label: "Has a phone number"},
} as const satisfies Record<string, FactDefinition>;

// --- Triggers --------------------------------------------------------------------------------

/** What an execution acts on; it decides which actions make sense. */
export type TargetType = "LEAD" | "CONTACT" | "VIEWING" | "LISTING" | "TASK" | "CALL" | "MEETING" | "NONE";

export interface TriggerDefinition {
  label: string;
  description: string;
  target: TargetType;
  facts: Record<string, FactDefinition>;
  /** Where the event comes from in EstateOS. */
  source: string;
}

export const TRIGGERS = {
  "lead.created": {label: "Lead created", description: "A lead is created in the CRM, imported or captured from a website form.", target: "LEAD", facts: {...EVENT_FACTS, ...LEAD_FACTS}, source: "CreateLead, CreateLeadForContact, website capture"},
  "lead.assigned": {label: "Lead assigned", description: "A lead is assigned or reassigned to an agent.", target: "LEAD", facts: {...EVENT_FACTS, ...LEAD_FACTS}, source: "AssignLead, CreateLead with an assignee"},
  "lead.unassigned": {label: "Lead moved to the unassigned queue", description: "A lead's agent is removed.", target: "LEAD", facts: {...EVENT_FACTS, ...LEAD_FACTS}, source: "UnassignLead"},
  "lead.status_changed": {label: "Lead status changed", description: "A lead moves to another status.", target: "LEAD", facts: {...EVENT_FACTS, ...LEAD_FACTS}, source: "ChangeLeadStatus"},
  "lead.followup_due": {label: "Lead follow-up due", description: "A lead's pending follow-up reaches its due time.", target: "LEAD", facts: {...EVENT_FACTS, ...LEAD_FACTS, ...TASK_FACTS}, source: "Worker scan of pending follow-ups"},
  "contact.created": {label: "Contact created", description: "A contact is added to the CRM.", target: "CONTACT", facts: {...EVENT_FACTS, ...CONTACT_FACTS}, source: "CreateContact"},
  "viewing.scheduled": {label: "Viewing scheduled", description: "A property viewing is scheduled for a lead.", target: "VIEWING", facts: {...EVENT_FACTS, ...LEAD_FACTS, ...VIEWING_FACTS}, source: "ScheduleLeadPropertyViewing"},
  "viewing.completed": {label: "Viewing completed", description: "A viewing is marked completed.", target: "VIEWING", facts: {...EVENT_FACTS, ...LEAD_FACTS, ...VIEWING_FACTS}, source: "UpdateLeadPropertyViewing"},
  "listing.created": {label: "Listing created", description: "A property listing is created.", target: "LISTING", facts: {...EVENT_FACTS, ...LISTING_FACTS}, source: "CreatePropertyListing"},
  "listing.status_changed": {label: "Listing status changed", description: "A listing moves to another status.", target: "LISTING", facts: {...EVENT_FACTS, ...LISTING_FACTS}, source: "SetPropertyListingStatus"},
  "website_form.submitted": {label: "Website form submitted", description: "A visitor submits a website or landing-page lead form.", target: "LEAD", facts: {...EVENT_FACTS, ...LEAD_FACTS}, source: "Website lead capture"},
  "task.created": {label: "Task created", description: "A follow-up or work task is created.", target: "TASK", facts: {...EVENT_FACTS, ...TASK_FACTS}, source: "ScheduleLeadFollowUp, workflow tasks"},
  "task.overdue": {label: "Task overdue", description: "A pending follow-up or work task passes its due time.", target: "TASK", facts: {...EVENT_FACTS, ...TASK_FACTS}, source: "Worker scan of pending tasks"},
  "task.completed": {label: "Task completed", description: "A follow-up or work task is completed.", target: "TASK", facts: {...EVENT_FACTS, ...TASK_FACTS}, source: "CompleteLeadFollowUp, CompleteWorkTask"},
  "call.started": {label: "Call started", description: "A provider call starts (placed from EstateOS or received on a company line).", target: "CALL", facts: {...EVENT_FACTS, ...LEAD_FACTS, ...CALL_FACTS}, source: "StartLeadCall, provider webhooks"},
  "call.completed": {label: "Call answered and ended", description: "An answered call ends, logged by the agent or reported by the provider.", target: "CALL", facts: {...EVENT_FACTS, ...LEAD_FACTS, ...CALL_FACTS}, source: "LogLeadCall, LogContactCall, provider webhooks"},
  "call.missed": {label: "Incoming call missed", description: "An incoming call ends unanswered. Unanswered outgoing attempts start nothing.", target: "CALL", facts: {...EVENT_FACTS, ...LEAD_FACTS, ...CALL_FACTS}, source: "LogLeadCall, LogContactCall, provider webhooks"},
  "call.failed": {label: "Call failed", description: "A call could not be connected or dropped.", target: "CALL", facts: {...EVENT_FACTS, ...LEAD_FACTS, ...CALL_FACTS}, source: "LogLeadCall, LogContactCall, provider webhooks"},
  "call.summary_ready": {label: "Call summary ready", description: "Claude finished a call summary (a draft for the agent to review).", target: "CALL", facts: {...EVENT_FACTS, ...LEAD_FACTS, ...CALL_FACTS}, source: "CreateCallAiSummary"},
  "meeting.scheduled": {label: "Meeting scheduled", description: "A meeting with a lead or contact is scheduled.", target: "MEETING", facts: {...EVENT_FACTS, ...LEAD_FACTS, ...MEETING_FACTS}, source: "CreateMeeting"},
  "meeting.completed": {label: "Meeting completed", description: "A meeting is marked as held.", target: "MEETING", facts: {...EVENT_FACTS, ...LEAD_FACTS, ...MEETING_FACTS}, source: "CompleteMeeting"},
  "workflow.manual": {label: "Run manually", description: "An authorized member runs the workflow, optionally for one lead.", target: "LEAD", facts: {...EVENT_FACTS, ...LEAD_FACTS}, source: "Run now"},
  "workflow.scheduled": {label: "On a schedule", description: "Runs once, daily or weekly in the company's timezone.", target: "NONE", facts: {...EVENT_FACTS}, source: "Worker scheduler"},
} as const satisfies Record<string, TriggerDefinition>;
export type Trigger = keyof typeof TRIGGERS;
export const TRIGGER_TYPES = Object.keys(TRIGGERS) as Trigger[];

export function factsFor(trigger: Trigger): Record<string, FactDefinition> {
  return TRIGGERS[trigger].facts;
}

// --- Conditions ------------------------------------------------------------------------------

export const OPERATORS = ["eq", "ne", "contains", "gt", "lt", "before", "after", "within_minutes", "empty", "not_empty"] as const;
export type Operator = (typeof OPERATORS)[number];
export const OPERATOR_LABELS: Record<Operator, string> = {
  eq: "equals", ne: "does not equal", contains: "contains", gt: "is greater than", lt: "is less than", before: "is before", after: "is after",
  within_minutes: "is within the last … minutes", empty: "is empty", not_empty: "is not empty",
};
/** Operators allowed per fact kind. */
export const OPERATORS_BY_KIND: Record<FactKind, readonly Operator[]> = {
  string: ["eq", "ne", "contains", "empty", "not_empty"],
  number: ["eq", "ne", "gt", "lt", "empty", "not_empty"],
  boolean: ["eq", "ne"],
  date: ["before", "after", "within_minutes", "empty", "not_empty"],
};

export type ConditionValue = string | number | boolean | null;
export type Condition = {field: string; operator: Operator; value: ConditionValue} | {mode: "AND" | "OR"; conditions: Condition[]};
const conditionValue = z.union([z.string().trim().max(160), z.number().finite().min(-1e12).max(1e12), z.boolean(), z.null()]);
export const conditionSchema: z.ZodType<Condition, Condition> = z.lazy(() => z.union([
  z.strictObject({field: z.string().regex(/^[a-z]+\.[A-Za-z]+$/, "Unknown field."), operator: z.enum(OPERATORS), value: conditionValue}),
  z.strictObject({mode: z.enum(["AND", "OR"]), conditions: z.array(conditionSchema).min(1).max(10)}),
]));

// --- Actions ---------------------------------------------------------------------------------

/** Who receives a notification: the record's assigned agent, the company's managers (OWNER, ADMIN, MANAGER) or administrators. */
export const AUDIENCES = ["ASSIGNEE", "MANAGERS", "ADMINISTRATORS"] as const;
/** A task goes to the record's assigned agent, or to the team queue (no assignee; managers see it). */
export const TASK_ASSIGNEES = ["ASSIGNEE", "UNASSIGNED"] as const;
/** Lead-sourced Content Studio drafts. (Client proposals need chosen listings, which a workflow cannot pick.) */
export const DRAFT_CONTENT_TYPES = ["WHATSAPP_MESSAGE", "EMAIL"] as const;

const stepId = z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/, "Step IDs use lowercase letters, numbers, hyphens and underscores.");
/** Plain text with at most a few allowlisted placeholders ({{lead.fullName}}); no markup, URLs or code. */
const message = (max: number) => z.string().trim().min(1).max(max)
  .refine(value => !/[<>]/.test(value), "Use plain text without < or >.")
  .refine(value => !/(https?:|www\.|javascript:|data:)/i.test(value), "Links are not allowed in workflow text.")
  .refine(value => [...value.matchAll(/\{\{\s*([^}]*)\s*\}\}/g)].every(match => PLACEHOLDERS.includes(match[1].trim() as Placeholder)), "Unknown placeholder.");
export const PLACEHOLDERS = ["lead.fullName", "lead.status", "listing.title", "workflow.name", "task.title"] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];
const minutes = z.number().int().min(1).max(LIMITS.delayMinutes);
const common = {id: stepId, when: conditionSchema.nullable().default(null)};

export const actionSchema = z.discriminatedUnion("type", [
  /** A follow-up on the lead (LeadFollowUp), or a work task for other records. */
  z.strictObject({...common, type: z.literal("task.create"), title: message(200), dueMinutes: minutes, assignee: z.enum(TASK_ASSIGNEES).default("ASSIGNEE")}),
  z.strictObject({...common, type: z.literal("notification.create"), audience: z.enum(AUDIENCES), title: message(120), message: message(400)}),
  /** Assigns an unassigned lead with the company's approved distribution rules. */
  z.strictObject({...common, type: z.literal("lead.distribute")}),
  /** Reassigns a lead (to a chosen member, or by the distribution rules) after a human approves it. */
  z.strictObject({...common, type: z.literal("lead.reassign"), membershipId: z.uuid().nullable().default(null), reason: message(300), expiresMinutes: z.number().int().min(15).max(10_080).default(1440)}),
  z.strictObject({...common, type: z.literal("lead.activity"), note: message(500)}),
  z.strictObject({...common, type: z.literal("viewing.followup"), title: message(200), dueMinutes: minutes}),
  /** An internal Content Studio draft for a person to review; never sent. */
  z.strictObject({...common, type: z.literal("ai.draft"), contentType: z.enum(DRAFT_CONTENT_TYPES), instructions: message(500)}),
  /** The existing AI Sales Intelligence analysis of the lead, saved as an internal insight. */
  z.strictObject({...common, type: z.literal("ai.sales_review")}),
  /** A Claude summary of the call (6F.4), as a draft for the agent; needs the company's Claude-analysis switch. */
  z.strictObject({...common, type: z.literal("call.summarize")}),
  z.strictObject({...common, type: z.literal("delay"), minutes}),
  /** Stops until an authorized member approves continuing. */
  z.strictObject({...common, type: z.literal("approval.request"), reason: message(300), expiresMinutes: z.number().int().min(15).max(10_080).default(1440)}),
  z.strictObject({...common, type: z.literal("end")}),
  z.strictObject({...common, type: z.literal("pause"), reason: message(300)}),
]);
export type Action = z.infer<typeof actionSchema>;
export type ActionType = Action["type"];
export const ACTION_TYPES = ["task.create", "notification.create", "lead.distribute", "lead.reassign", "lead.activity", "viewing.followup", "ai.draft", "ai.sales_review", "call.summarize", "delay", "approval.request", "end", "pause"] as const satisfies readonly ActionType[];

export type Risk = "LOW" | "MEDIUM";
export interface ActionDefinition {
  label: string;
  description: string;
  /** Server policy (never from Claude or the browser): MEDIUM actions always wait for a human decision. */
  risk: Risk;
  /** Target types the action works on. */
  targets: readonly TargetType[];
  /** Calls Claude (counts towards the AI limits). */
  ai: boolean;
}
export const ACTIONS: Record<ActionType, ActionDefinition> = {
  "task.create": {label: "Create a follow-up task", description: "A follow-up on the lead, or a work task for a listing or the team queue.", risk: "LOW", targets: ["LEAD", "VIEWING", "LISTING", "TASK", "CONTACT", "CALL", "MEETING", "NONE"], ai: false},
  "notification.create": {label: "Send an in-app notification", description: "To the assigned agent, the managers or the administrators. Never an email or message.", risk: "LOW", targets: ["LEAD", "VIEWING", "LISTING", "TASK", "CONTACT", "CALL", "MEETING", "NONE"], ai: false},
  "lead.distribute": {label: "Assign with the distribution rules", description: "Uses the company's approved lead distribution; only for unassigned leads.", risk: "LOW", targets: ["LEAD"], ai: false},
  "lead.reassign": {label: "Reassign the lead (needs approval)", description: "Waits for an authorized member to approve the exact change.", risk: "MEDIUM", targets: ["LEAD", "VIEWING"], ai: false},
  "lead.activity": {label: "Add a note to the lead", description: "An internal activity on the lead's timeline.", risk: "LOW", targets: ["LEAD", "VIEWING", "CALL", "MEETING"], ai: false},
  "viewing.followup": {label: "Create a viewing follow-up", description: "A follow-up task on the viewing's lead.", risk: "LOW", targets: ["VIEWING"], ai: false},
  "ai.draft": {label: "Prepare a message draft with Claude", description: "An internal WhatsApp or email draft in Content Studio for the agent to edit. Never sent.", risk: "LOW", targets: ["LEAD", "VIEWING", "CALL", "MEETING"], ai: true},
  "ai.sales_review": {label: "Run the AI sales review", description: "The existing lead qualification analysis, saved as an internal insight.", risk: "LOW", targets: ["LEAD", "VIEWING", "CALL", "MEETING"], ai: true},
  "call.summarize": {label: "Summarise the call with Claude", description: "A draft summary from the call's transcript or the agent's notes, for the agent to review. Needs Claude call analysis enabled.", risk: "LOW", targets: ["CALL"], ai: true},
  delay: {label: "Wait", description: "Waits, then rechecks the conditions of the next steps.", risk: "LOW", targets: ["LEAD", "CONTACT", "VIEWING", "LISTING", "TASK", "CALL", "MEETING", "NONE"], ai: false},
  "approval.request": {label: "Ask for approval to continue", description: "Stops until an authorized member approves.", risk: "LOW", targets: ["LEAD", "CONTACT", "VIEWING", "LISTING", "TASK", "CALL", "MEETING", "NONE"], ai: false},
  end: {label: "End", description: "Ends the execution.", risk: "LOW", targets: ["LEAD", "CONTACT", "VIEWING", "LISTING", "TASK", "CALL", "MEETING", "NONE"], ai: false},
  pause: {label: "Pause the workflow", description: "Stops this execution and pauses the workflow for review.", risk: "LOW", targets: ["LEAD", "CONTACT", "VIEWING", "LISTING", "TASK", "CALL", "MEETING", "NONE"], ai: false},
};
/** Whether a step waits for a human decision before its side effect. */
export const needsApproval = (action: Action) => ACTIONS[action.type].risk === "MEDIUM" || action.type === "approval.request";

// --- Schedules -------------------------------------------------------------------------------

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time like 09:30.");
const weekdays = z.array(z.number().int().min(0).max(6)).min(1).max(7).refine(days => new Set(days).size === days.length, "Each weekday once.");
export const timeZoneSchema = z.string().max(64).refine(value => {
  try { new Intl.DateTimeFormat("en", {timeZone: value}).format(); return true; } catch { return false; }
}, "Use a valid IANA timezone, for example Asia/Dubai.");
export const scheduleSchema = z.discriminatedUnion("kind", [
  z.strictObject({kind: z.literal("ONCE"), at: z.iso.datetime({offset: true})}),
  z.strictObject({kind: z.literal("DAILY"), time: clock}),
  z.strictObject({kind: z.literal("WEEKLY"), time: clock, weekdays}),
]);
export type Schedule = z.infer<typeof scheduleSchema>;
export const hoursSchema = z.strictObject({weekdays, start: clock, end: clock}).refine(hours => hours.start < hours.end, "Hours must end after they start, on the same day.");

// --- The definition --------------------------------------------------------------------------

export const workflowDefinitionSchema = z.strictObject({
  schemaVersion: z.literal(DEFINITION_SCHEMA_VERSION),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).default(""),
  trigger: z.enum(TRIGGER_TYPES as [Trigger, ...Trigger[]]),
  conditions: conditionSchema.nullable().default(null),
  steps: z.array(actionSchema).min(1).max(LIMITS.steps),
  /** Interprets schedules, business hours and quiet hours; stored times are UTC. */
  timeZone: timeZoneSchema.default("Asia/Dubai"),
  schedule: scheduleSchema.nullable().default(null),
  /** Steps run only within business hours; outside them they wait until the next allowed time. */
  businessHours: hoursSchema.nullable().default(null),
  /** No notifications or tasks during quiet hours (for example 22:00–07:00); they wait instead. */
  quietHours: z.strictObject({start: clock, end: clock}).nullable().default(null),
  errorPolicy: z.literal("RETRY_THEN_FAIL").default("RETRY_THEN_FAIL"),
}).superRefine((definition, context) => {
  for (const problem of definitionProblems(definition)) context.addIssue({code: "custom", message: problem});
});
export type WorkflowDefinition = z.output<typeof workflowDefinitionSchema>;
export type WorkflowDefinitionInput = z.input<typeof workflowDefinitionSchema>;

/** Structural rules beyond field types: facts per trigger, operators per kind, targets per action, limits. */
export function definitionProblems(definition: Omit<WorkflowDefinition, "errorPolicy"> & {errorPolicy?: string}): string[] {
  const problems: string[] = [];
  const trigger = TRIGGERS[definition.trigger];
  problems.push(...conditionProblems(definition.conditions, definition.trigger));
  const ids = new Set<string>();
  let ai = 0;
  definition.steps.forEach((step, index) => {
    if (ids.has(step.id)) problems.push(`Step ${index + 1}: each step needs a unique ID.`);
    ids.add(step.id);
    problems.push(...conditionProblems(step.when, definition.trigger).map(problem => `Step ${index + 1}: ${problem}`));
    if (!ACTIONS[step.type].targets.includes(trigger.target)) problems.push(`Step ${index + 1}: "${ACTIONS[step.type].label}" does not work with the "${trigger.label}" trigger.`);
    if (ACTIONS[step.type].ai) ai += 1;
    if ((step.type === "end" || step.type === "pause") && index !== definition.steps.length - 1 && !step.when) problems.push(`Step ${index + 1}: steps after an unconditional ${step.type} would never run.`);
    if (step.type === "call.summarize" && definition.trigger === "call.summary_ready") problems.push(`Step ${index + 1}: a summary-ready workflow cannot summarise the call again.`);
  });
  if (ai > LIMITS.aiStepsPerWorkflow) problems.push(`At most ${LIMITS.aiStepsPerWorkflow} Claude steps per workflow.`);
  if (definition.steps.every(step => step.type === "delay" || step.type === "end")) problems.push("Add at least one action besides waiting.");
  if ((definition.trigger === "workflow.scheduled") !== (definition.schedule !== null)) problems.push(definition.trigger === "workflow.scheduled" ? "Choose when the scheduled workflow runs." : "Only scheduled workflows have a schedule.");
  return problems;
}

/** Checks fields against the trigger's facts and values against each fact's kind and options. */
export function conditionProblems(condition: Condition | null, trigger: Trigger, depth = 0): string[] {
  if (!condition) return [];
  if ("mode" in condition) {
    if (depth >= LIMITS.conditionDepth) return [`Condition groups can nest at most ${LIMITS.conditionDepth} levels.`];
    return condition.conditions.flatMap(child => conditionProblems(child, trigger, depth + 1));
  }
  const fact = (TRIGGERS[trigger].facts as Record<string, FactDefinition>)[condition.field];
  if (!fact) return [`"${condition.field}" is not available for the "${TRIGGERS[trigger].label}" trigger.`];
  if (!OPERATORS_BY_KIND[fact.kind].includes(condition.operator)) return [`"${OPERATOR_LABELS[condition.operator]}" does not apply to ${fact.label.toLowerCase()}.`];
  if (condition.operator === "empty" || condition.operator === "not_empty") return condition.value === null ? [] : [`${fact.label}: an empty check takes no value.`];
  if (condition.operator === "within_minutes") return typeof condition.value === "number" && Number.isInteger(condition.value) && condition.value >= 1 && condition.value <= LIMITS.delayMinutes ? [] : [`${fact.label}: give a number of minutes.`];
  if (fact.kind === "date") return typeof condition.value === "string" && Number.isFinite(Date.parse(condition.value)) ? [] : [`${fact.label}: give a date and time.`];
  if (typeof condition.value !== fact.kind) return [`${fact.label} needs a ${fact.kind === "string" ? "text" : fact.kind} value.`];
  if (fact.options && condition.operator !== "contains" && !fact.options.includes(String(condition.value))) return [`${fact.label}: "${String(condition.value)}" is not one of ${fact.options.join(", ")}.`];
  return [];
}

export class WorkflowDefinitionError extends Error {
  constructor(readonly issues: string[]) { super(issues[0] ?? "The workflow is invalid."); }
}

/** Validates untrusted definitions (browser, Claude, stored JSON). Throws with readable issues. */
export function parseWorkflowDefinition(input: unknown): WorkflowDefinition {
  const result = workflowDefinitionSchema.safeParse(input);
  if (result.success) return result.data;
  throw new WorkflowDefinitionError(result.error.issues.slice(0, 12).map(issue => `${issue.path.length ? `${issue.path.join(".")}: ` : ""}${issue.message}`));
}

/** Stable JSON (sorted keys) for hashing and snapshots. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value ?? null);
}

/** Every record ID a definition refers to (members for reassignment); the server checks each belongs to the company. */
export function referencedMemberships(definition: WorkflowDefinition) {
  return [...new Set(definition.steps.flatMap(step => step.type === "lead.reassign" && step.membershipId ? [step.membershipId] : []))];
}
