import { ACTIONS, AUDIENCES, OPERATOR_LABELS, TRIGGERS, type Action, type Condition, type FactDefinition, type Trigger, type WorkflowDefinitionInput } from "./definition";

/*
 * Plain-language descriptions of a definition, for the graph, previews and
 * Claude proposals. Display only: nothing here is evaluated.
 */

export type NodeKind = "TRIGGER" | "CONDITION" | "ACTION" | "DELAY" | "APPROVAL" | "END";

export const AUDIENCE_LABELS: Record<(typeof AUDIENCES)[number], string> = {ASSIGNEE: "the assigned agent", MANAGERS: "the managers", ADMINISTRATORS: "the owners and administrators"};

export function minutesLabel(minutes: number) {
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? "" : "s"}`;
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function nodeKind(action: Pick<Action, "type">): NodeKind {
  if (action.type === "delay") return "DELAY";
  if (action.type === "approval.request" || action.type === "lead.reassign") return "APPROVAL";
  if (action.type === "end" || action.type === "pause") return "END";
  return "ACTION";
}

function factLabel(trigger: Trigger, field: string) {
  return ((TRIGGERS[trigger]?.facts ?? {}) as Record<string, FactDefinition>)[field]?.label ?? field;
}

export function describeCondition(condition: Condition | null | undefined, trigger: Trigger): string {
  if (!condition) return "Always";
  if ("mode" in condition) {
    const parts = condition.conditions.map(child => describeCondition(child, trigger));
    return parts.length === 1 ? parts[0] : parts.map(part => `(${part})`).join(condition.mode === "AND" ? " and " : " or ");
  }
  const label = factLabel(trigger, condition.field);
  if (condition.operator === "empty" || condition.operator === "not_empty") return `${label} ${OPERATOR_LABELS[condition.operator]}`;
  if (condition.operator === "within_minutes") return `${label} is within the last ${minutesLabel(Number(condition.value))}`;
  const value = typeof condition.value === "boolean" ? (condition.value ? "yes" : "no") : String(condition.value);
  return `${label} ${OPERATOR_LABELS[condition.operator]} ${value}`;
}

/** One line about what a step does. */
export function describeStep(step: Partial<Action> & Pick<Action, "type">): string {
  switch (step.type) {
    case "task.create": return `Create “${step.title ?? ""}”, due in ${minutesLabel(step.dueMinutes ?? 60)}${step.assignee === "UNASSIGNED" ? ", in the team queue" : ", for the assigned agent"}.`;
    case "notification.create": return `Notify ${AUDIENCE_LABELS[step.audience ?? "ASSIGNEE"]}: “${step.title ?? ""}”.`;
    case "lead.distribute": return "Assign the lead with the company's approved distribution rules.";
    case "lead.reassign": return `Ask for approval to reassign the lead${step.membershipId ? " to the chosen agent" : " with the distribution rules"}. Reason: ${step.reason ?? ""}`;
    case "lead.activity": return `Add an internal note: “${step.note ?? ""}”.`;
    case "viewing.followup": return `Create the viewing follow-up “${step.title ?? ""}”, due in ${minutesLabel(step.dueMinutes ?? 1440)}.`;
    case "ai.draft": return `Prepare an editable ${String(step.contentType ?? "message").toLowerCase().replaceAll("_", " ")} draft with Claude (never sent).`;
    case "ai.sales_review": return "Run the AI sales review and save it as an internal insight.";
    case "delay": return `Wait ${minutesLabel(step.minutes ?? 60)}, then recheck.`;
    case "approval.request": return `Wait for an authorized member to approve continuing. Reason: ${step.reason ?? ""}`;
    case "end": return "End the execution.";
    case "pause": return `Pause the workflow for review: ${step.reason ?? ""}`;
  }
}

export function describeTrigger(definition: Pick<WorkflowDefinitionInput, "trigger" | "schedule">) {
  const trigger = TRIGGERS[definition.trigger];
  if (!trigger) return definition.trigger;
  const schedule = definition.schedule;
  if (!schedule) return trigger.label;
  if (schedule.kind === "ONCE") return `Once at ${schedule.at}`;
  if (schedule.kind === "DAILY") return `Every day at ${schedule.time}`;
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `Every ${schedule.weekdays.map(day => names[day]).join(", ")} at ${schedule.time}`;
}

export const actionLabel = (type: Action["type"]) => ACTIONS[type]?.label ?? type;
