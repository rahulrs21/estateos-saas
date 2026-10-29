import { INTERACTION_KINDS, type MissingItem } from "./scoring";

/**
 * Smart follow-up signals (docs/AI_SALES_INTELLIGENCE.md#follow-up-assistant).
 * Pure rules over records the member is already permitted to see. Every
 * suggestion is advisory: actions open a draft or a section for the member to
 * act on; nothing is sent, rescheduled, reassigned or changed automatically.
 */

export type SuggestionCode =
  | "OVERDUE_FOLLOW_UP" | "UNANSWERED_ENQUIRY" | "AWAITING_VIEWING_CONFIRMATION" | "VIEWING_OUTCOME_MISSING"
  | "POST_VIEWING_FOLLOW_UP" | "AWAITING_PROPERTY_INFORMATION" | "INCOMPLETE_QUALIFICATION" | "NO_NEXT_STEP";

export type SuggestionAction =
  | {kind: "WHATSAPP_DRAFT" | "EMAIL_DRAFT"; purpose: string; propertyId?: string}
  | {kind: "OPEN_SECTION"; section: "follow-up" | "viewings" | "requirements" | "qualification"};

export interface FollowUpSuggestion {
  code: SuggestionCode;
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  detail: string;
  actions: SuggestionAction[];
}

export interface FollowUpInput {
  now: string;
  lead: {status: string; archived: boolean; createdAt: string; followUpAt: string | null};
  followUps: Array<{title: string; dueAt: string; status: string}>;
  activities: Array<{kind: string; createdAt: string}>;
  /** null when the member's role has no inventory scope (viewings and shortlist are not readable). */
  viewings: Array<{id: string; propertyId: string; propertyReference: string; scheduledAt: string; status: string; customerConfirmation: string; outcome: string | null; hasFollowUp: boolean}> | null;
  shortlist: Array<{propertyId: string; propertyReference: string; status: string; updatedAt: string}> | null;
  missing: MissingItem[];
}

const CLOSED = new Set(["WON", "LOST", "CONVERTED"]);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const ago = (ms: number) => ms < DAY ? "today" : `${Math.floor(ms / DAY)} day${Math.floor(ms / DAY) === 1 ? "" : "s"} ago`;

export function lastInteractionAt(activities: FollowUpInput["activities"]) {
  return activities.filter(item => INTERACTION_KINDS.has(item.kind)).map(item => item.createdAt).sort().at(-1) ?? null;
}

export function followUpSuggestions(input: FollowUpInput): FollowUpSuggestion[] {
  if (input.lead.archived || CLOSED.has(input.lead.status)) return [];
  const now = Date.parse(input.now);
  const suggestions: FollowUpSuggestion[] = [];
  const lastInteraction = lastInteractionAt(input.activities);
  const interactedAfter = (time: string) => Boolean(lastInteraction && Date.parse(lastInteraction) > Date.parse(time));

  const overdue = input.followUps.filter(item => item.status === "PENDING" && Date.parse(item.dueAt) < now);
  const leadFollowUpOverdue = input.lead.followUpAt && Date.parse(input.lead.followUpAt) < now && !overdue.some(item => item.dueAt === input.lead.followUpAt);
  if (overdue.length || leadFollowUpOverdue) {
    const oldest = [...overdue.map(item => item.dueAt), ...(leadFollowUpOverdue ? [input.lead.followUpAt!] : [])].sort()[0];
    suggestions.push({
      code: "OVERDUE_FOLLOW_UP", severity: "HIGH",
      title: overdue.length > 1 ? `${plural(overdue.length, "follow-up")} overdue` : "Follow-up overdue",
      detail: `${overdue[0]?.title ? `"${overdue[0].title.slice(0, 80)}" was due` : "The next follow-up was due"} ${ago(now - Date.parse(oldest))}. Contact the customer, then complete or reschedule it yourself.`,
      actions: [{kind: "WHATSAPP_DRAFT", purpose: "ENQUIRY_FOLLOW_UP"}, {kind: "OPEN_SECTION", section: "follow-up"}],
    });
  }

  const age = now - Date.parse(input.lead.createdAt);
  if (input.lead.status === "NEW" && !lastInteraction && age > DAY) {
    suggestions.push({
      code: "UNANSWERED_ENQUIRY", severity: "HIGH", title: "Enquiry not yet answered",
      detail: `No contact is recorded since the enquiry arrived ${ago(age)}.`,
      actions: [{kind: "WHATSAPP_DRAFT", purpose: "NEW_LEAD_INTRODUCTION"}, {kind: "EMAIL_DRAFT", purpose: "ENQUIRY_RESPONSE"}],
    });
  }

  for (const viewing of input.viewings ?? []) {
    const at = Date.parse(viewing.scheduledAt);
    if (viewing.status === "SCHEDULED" && at > now && viewing.customerConfirmation === "PENDING") {
      suggestions.push({
        code: "AWAITING_VIEWING_CONFIRMATION", severity: at - now < 2 * DAY ? "HIGH" : "MEDIUM", title: `Viewing of ${viewing.propertyReference} not confirmed`,
        detail: `The customer has not confirmed the viewing on ${viewing.scheduledAt.slice(0, 10)}. Record the confirmation in Viewings once they reply.`,
        actions: [{kind: "WHATSAPP_DRAFT", purpose: "VIEWING_CONFIRMATION", propertyId: viewing.propertyId}, {kind: "OPEN_SECTION", section: "viewings"}],
      });
    } else if (viewing.status === "SCHEDULED" && at < now - 2 * HOUR) {
      suggestions.push({
        code: "VIEWING_OUTCOME_MISSING", severity: "MEDIUM", title: `Record the outcome of the ${viewing.propertyReference} viewing`,
        detail: `The viewing was scheduled ${ago(now - at)} and is still open. Only you can record whether it happened and how it went.`,
        actions: [{kind: "OPEN_SECTION", section: "viewings"}],
      });
    } else if (viewing.status === "COMPLETED" && now - at < 7 * DAY && !viewing.hasFollowUp && !interactedAfter(viewing.scheduledAt)) {
      suggestions.push({
        code: "POST_VIEWING_FOLLOW_UP", severity: viewing.outcome === "POSITIVE" ? "HIGH" : "MEDIUM", title: `Follow up after the ${viewing.propertyReference} viewing`,
        detail: `The viewing ${ago(now - at)} has no follow-up or later contact recorded.`,
        actions: [{kind: "WHATSAPP_DRAFT", purpose: "POST_VIEWING_FOLLOW_UP", propertyId: viewing.propertyId}, {kind: "OPEN_SECTION", section: "follow-up"}],
      });
    }
  }

  // Marking a property "interested" is itself recorded as activity, so only later contact of another kind counts as a reply.
  const lastContact = input.activities.filter(item => INTERACTION_KINDS.has(item.kind) && item.kind !== "LEAD_PROPERTY_INTEREST_CHANGED").map(item => item.createdAt).sort().at(-1);
  const awaiting = (input.shortlist ?? []).filter(item => item.status === "INTERESTED" && now - Date.parse(item.updatedAt) > DAY
    && (!lastContact || Date.parse(lastContact) < Date.parse(item.updatedAt)));
  if (awaiting.length) {
    suggestions.push({
      code: "AWAITING_PROPERTY_INFORMATION", severity: "MEDIUM", title: "Customer may be waiting for property details",
      detail: `${plural(awaiting.length, "shortlisted property")} marked interested (${awaiting.slice(0, 3).map(item => item.propertyReference).join(", ")}) with no contact recorded since.`,
      actions: [{kind: "WHATSAPP_DRAFT", purpose: "PROPERTY_RECOMMENDATION", propertyId: awaiting[0].propertyId}, {kind: "EMAIL_DRAFT", purpose: "PROPERTY_RECOMMENDATION", propertyId: awaiting[0].propertyId}],
    });
  }

  if (input.missing.length) {
    const qualificationMissing = input.missing.some(item => item.key === "timeline" || item.key === "readiness");
    suggestions.push({
      code: "INCOMPLETE_QUALIFICATION", severity: input.missing.length >= 3 ? "MEDIUM" : "LOW", title: "Complete the qualification",
      detail: `Ask the customer about: ${input.missing.map(item => item.label.toLowerCase()).join(", ")}.`,
      actions: [{kind: "OPEN_SECTION", section: qualificationMissing ? "qualification" : "requirements"}],
    });
  }

  const pendingFollowUp = input.followUps.some(item => item.status === "PENDING" && Date.parse(item.dueAt) >= now) || Boolean(input.lead.followUpAt && Date.parse(input.lead.followUpAt) >= now);
  const upcomingViewing = (input.viewings ?? []).some(item => item.status === "SCHEDULED" && Date.parse(item.scheduledAt) > now);
  if (!pendingFollowUp && !upcomingViewing && !suggestions.some(item => item.code === "OVERDUE_FOLLOW_UP")) {
    suggestions.push({
      code: "NO_NEXT_STEP", severity: "LOW", title: "No next step scheduled",
      detail: "There is no upcoming follow-up or viewing. Schedule the next contact so this lead does not go quiet.",
      actions: [{kind: "OPEN_SECTION", section: "follow-up"}],
    });
  }
  const order = {HIGH: 0, MEDIUM: 1, LOW: 2};
  return suggestions.sort((a, b) => order[a.severity] - order[b.severity]);
}
