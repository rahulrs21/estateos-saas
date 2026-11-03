"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACTIONS, AUDIENCES, DRAFT_CONTENT_TYPES, LIMITS, PLACEHOLDERS, TASK_ASSIGNEES, TRIGGERS, type Action, type ActionType, type Trigger } from "../definition";
import { AUDIENCE_LABELS } from "../describe";
import { ConditionEditor, selectClass } from "./condition-editor";

/*
 * Typed fields for each allowlisted action. Text fields accept plain text with
 * the listed placeholders only; the server rejects markup and links.
 */

export type EditableStep = Partial<Action> & Pick<Action, "type" | "id">;

/** A new step with safe defaults. */
export function newStep(type: ActionType, taken: string[]): EditableStep {
  const base = type.replace(/[^a-z]+/g, "-").replace(/-+$/, "");
  let id = base;
  for (let counter = 2; taken.includes(id); counter++) id = `${base}-${counter}`;
  switch (type) {
    case "task.create": return {id, type, title: "Follow up with {{lead.fullName}}", dueMinutes: 60, assignee: "ASSIGNEE", when: null};
    case "notification.create": return {id, type, audience: "ASSIGNEE", title: "{{workflow.name}}", message: "Please review {{lead.fullName}}.", when: null};
    case "lead.reassign": return {id, type, membershipId: null, reason: "No contact within the agreed time.", expiresMinutes: 1440, when: null};
    case "lead.activity": return {id, type, note: "Checked by {{workflow.name}}.", when: null};
    case "viewing.followup": return {id, type, title: "Follow up the viewing with {{lead.fullName}}", dueMinutes: 1440, when: null};
    case "ai.draft": return {id, type, contentType: "WHATSAPP_MESSAGE", instructions: "A short, friendly follow-up message.", when: null};
    case "delay": return {id, type, minutes: 60, when: null};
    case "approval.request": return {id, type, reason: "A manager should confirm before continuing.", expiresMinutes: 1440, when: null};
    case "pause": return {id, type, reason: "Needs review.", when: null};
    default: return {id, type, when: null} as EditableStep;
  }
}

/** Action types that work with the trigger's target. */
export const actionsFor = (trigger: Trigger) => (Object.keys(ACTIONS) as ActionType[]).filter(type => ACTIONS[type].targets.includes(TRIGGERS[trigger].target));

const UNITS = [{label: "minutes", factor: 1}, {label: "hours", factor: 60}, {label: "days", factor: 1440}];
function Duration({id, label, minutes, onChange, max = LIMITS.delayMinutes}: {id: string; label: string; minutes: number; onChange: (minutes: number) => void; max?: number}) {
  const unit = [...UNITS].reverse().find(item => minutes % item.factor === 0) ?? UNITS[0];
  return <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    <div className="flex gap-2">
      <Input id={id} type="number" min={1} value={minutes / unit.factor} onChange={event => onChange(Math.max(1, Math.min(max, Math.round(Number(event.target.value) * unit.factor) || 1)))} />
      <select aria-label={`${label} unit`} className={selectClass + " max-w-28"} value={unit.factor} onChange={event => onChange(Math.min(max, (minutes / unit.factor) * Number(event.target.value)))}>
        {UNITS.map(item => <option key={item.factor} value={item.factor}>{item.label}</option>)}
      </select>
    </div>
  </div>;
}

function Text({id, label, value, onChange, max, multiline}: {id: string; label: string; value: string | undefined; onChange: (value: string) => void; max: number; multiline?: boolean}) {
  return <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    {multiline
      ? <textarea id={id} className="min-h-20 w-full rounded-lg border bg-background px-2.5 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" maxLength={max} value={value ?? ""} onChange={event => onChange(event.target.value)} />
      : <Input id={id} maxLength={max} value={value ?? ""} onChange={event => onChange(event.target.value)} />}
  </div>;
}

export function StepEditor({step, trigger, agents, onChange}: {step: EditableStep; trigger: Trigger; agents: Array<{id: string; name: string}>; onChange: (step: EditableStep) => void}) {
  const set = (patch: Partial<Action>) => onChange({...step, ...patch} as EditableStep);
  const key = `step-${step.id}`;
  const fields = (() => {
    switch (step.type) {
      case "task.create": return <>
        <Text id={`${key}-title`} label="Task title" value={step.title} max={200} onChange={title => set({title})} />
        <Duration id={`${key}-due`} label="Due after" minutes={step.dueMinutes ?? 60} onChange={dueMinutes => set({dueMinutes})} />
        <div className="space-y-1.5"><Label htmlFor={`${key}-assignee`}>For</Label>
          <select id={`${key}-assignee`} className={selectClass} value={step.assignee ?? "ASSIGNEE"} onChange={event => set({assignee: event.target.value as (typeof TASK_ASSIGNEES)[number]})}>
            <option value="ASSIGNEE">The assigned agent (lead tasks always go to the lead&apos;s agent)</option><option value="UNASSIGNED">The team queue</option>
          </select></div>
      </>;
      case "notification.create": return <>
        <div className="space-y-1.5"><Label htmlFor={`${key}-audience`}>Notify</Label>
          <select id={`${key}-audience`} className={selectClass} value={step.audience ?? "ASSIGNEE"} onChange={event => set({audience: event.target.value as (typeof AUDIENCES)[number]})}>
            {AUDIENCES.map(audience => <option key={audience} value={audience}>{AUDIENCE_LABELS[audience]}</option>)}
          </select></div>
        <Text id={`${key}-title`} label="Title" value={step.title} max={120} onChange={title => set({title})} />
        <Text id={`${key}-message`} label="Message" value={step.message} max={400} multiline onChange={message => set({message})} />
        <p className="text-xs text-muted-foreground">In-app only. Workflows never send emails, WhatsApp messages or SMS.</p>
      </>;
      case "lead.reassign": return <>
        <div className="space-y-1.5"><Label htmlFor={`${key}-member`}>Reassign to</Label>
          <select id={`${key}-member`} className={selectClass} value={step.membershipId ?? ""} onChange={event => set({membershipId: event.target.value || null})}>
            <option value="">The next agent by the distribution rules</option>
            {agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select></div>
        <Text id={`${key}-reason`} label="Reason shown to the approver" value={step.reason} max={300} multiline onChange={reason => set({reason})} />
        <Duration id={`${key}-expires`} label="Approval expires after" minutes={step.expiresMinutes ?? 1440} max={10_080} onChange={expiresMinutes => set({expiresMinutes: Math.max(15, expiresMinutes)})} />
        <p className="text-xs text-muted-foreground">Medium risk: always waits for an authorized member to approve the exact change.</p>
      </>;
      case "lead.activity": return <Text id={`${key}-note`} label="Note" value={step.note} max={500} multiline onChange={note => set({note})} />;
      case "viewing.followup": return <>
        <Text id={`${key}-title`} label="Follow-up title" value={step.title} max={200} onChange={title => set({title})} />
        <Duration id={`${key}-due`} label="Due after" minutes={step.dueMinutes ?? 1440} onChange={dueMinutes => set({dueMinutes})} />
      </>;
      case "ai.draft": return <>
        <div className="space-y-1.5"><Label htmlFor={`${key}-type`}>Draft type</Label>
          <select id={`${key}-type`} className={selectClass} value={step.contentType ?? "WHATSAPP_MESSAGE"} onChange={event => set({contentType: event.target.value as (typeof DRAFT_CONTENT_TYPES)[number]})}>
            {DRAFT_CONTENT_TYPES.map(type => <option key={type} value={type}>{type.toLowerCase().replaceAll("_", " ")}</option>)}
          </select></div>
        <Text id={`${key}-instructions`} label="Instructions for Claude" value={step.instructions} max={500} multiline onChange={instructions => set({instructions})} />
        <p className="text-xs text-muted-foreground">Saved as an internal Content Studio draft for a person to edit. Never sent.</p>
      </>;
      case "delay": return <Duration id={`${key}-minutes`} label="Wait for" minutes={step.minutes ?? 60} onChange={minutes => set({minutes})} />;
      case "approval.request": return <>
        <Text id={`${key}-reason`} label="Reason shown to the approver" value={step.reason} max={300} multiline onChange={reason => set({reason})} />
        <Duration id={`${key}-expires`} label="Approval expires after" minutes={step.expiresMinutes ?? 1440} max={10_080} onChange={expiresMinutes => set({expiresMinutes: Math.max(15, expiresMinutes)})} />
      </>;
      case "pause": return <Text id={`${key}-reason`} label="Reason" value={step.reason} max={300} onChange={reason => set({reason})} />;
      default: return <p className="text-sm text-muted-foreground">{ACTIONS[step.type].description}</p>;
    }
  })();
  const text = ["task.create", "notification.create", "lead.activity", "viewing.followup", "lead.reassign", "approval.request"].includes(step.type);
  return <div className="space-y-4">
    <div>
      <h3 className="font-semibold">{ACTIONS[step.type].label}</h3>
      <p className="text-sm text-muted-foreground">{ACTIONS[step.type].description}</p>
    </div>
    <div className="space-y-1.5"><Label htmlFor={`${key}-id`}>Step ID</Label>
      <Input id={`${key}-id`} maxLength={40} value={step.id} onChange={event => set({id: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "")})} /></div>
    {fields}
    {text && <p className="text-xs text-muted-foreground">Placeholders: {PLACEHOLDERS.map(item => `{{${item}}}`).join(", ")}</p>}
    {step.type !== "end" && <div className="space-y-1.5">
      <p className="text-sm font-medium">Only when</p>
      <ConditionEditor id={`${key}-when`} value={step.when ?? null} trigger={trigger} emptyLabel="Always runs (rechecked with fresh data when the step is reached)." onChange={when => set({when})} />
    </div>}
  </div>;
}
