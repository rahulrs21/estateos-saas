"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { automationsSend, errorIssues, errorMessage } from "../client";
import { ACTIONS, LIMITS, TRIGGERS, TRIGGER_TYPES, workflowDefinitionSchema, type ActionType, type Schedule, type Trigger, type WorkflowDefinitionInput } from "../definition";
import { ConditionEditor, selectClass } from "./condition-editor";
import { StepEditor, actionsFor, newStep, type EditableStep } from "./step-editor";
import { WorkflowGraph, type GraphSelection } from "./workflow-graph";
import { WorkflowTester } from "./workflow-tester";

/*
 * The visual workflow editor (docs/WORKFLOW_BUILDER.md#editor). It edits the
 * structured definition only; the same schema the server uses validates it
 * live, and the server validates it again on save. Saving never activates:
 * a saved change is a new draft version that needs review and approval.
 */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function issuesOf(definition: WorkflowDefinitionInput) {
  const result = workflowDefinitionSchema.safeParse(definition);
  if (result.success) return {issues: [] as string[], steps: [] as number[], parsed: result.data};
  const issues = result.error.issues.slice(0, 12).map(issue => `${issue.path.length ? `${issue.path.join(".")}: ` : ""}${issue.message}`);
  const steps = [...new Set(result.error.issues.flatMap(issue => {
    if (issue.path[0] === "steps" && typeof issue.path[1] === "number") return [issue.path[1]];
    const match = /^Step (\d+):/.exec(issue.message);
    return match ? [Number(match[1]) - 1] : [];
  }))];
  return {issues, steps, parsed: null};
}

function Days({id, value, onChange}: {id: string; value: number[]; onChange: (days: number[]) => void}) {
  return <div className="flex flex-wrap gap-1" role="group" aria-labelledby={id}>
    {DAYS.map((day, index) => <label key={day} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
      <input type="checkbox" checked={value.includes(index)} onChange={event => onChange(event.target.checked ? [...value, index].sort() : value.filter(item => item !== index))} />{day}
    </label>)}
  </div>;
}

function TriggerPanel({definition, onChange}: {definition: WorkflowDefinitionInput; onChange: (definition: WorkflowDefinitionInput) => void}) {
  const set = (patch: Partial<WorkflowDefinitionInput>) => onChange({...definition, ...patch});
  const schedule = definition.schedule ?? null;
  return <div className="space-y-4">
    <div className="space-y-1.5"><Label htmlFor="wf-name">Name</Label><Input id="wf-name" maxLength={120} value={definition.name} onChange={event => set({name: event.target.value})} /></div>
    <div className="space-y-1.5"><Label htmlFor="wf-description">Description</Label>
      <textarea id="wf-description" className="min-h-16 w-full rounded-lg border bg-background px-2.5 py-2 text-sm" maxLength={2000} value={definition.description ?? ""} onChange={event => set({description: event.target.value})} /></div>
    <div className="space-y-1.5"><Label htmlFor="wf-trigger">Trigger</Label>
      <select id="wf-trigger" className={selectClass} value={definition.trigger} onChange={event => {
        const trigger = event.target.value as Trigger;
        // Conditions refer to the previous trigger's facts; start them again.
        set({trigger, conditions: null, schedule: trigger === "workflow.scheduled" ? {kind: "DAILY", time: "09:00"} : null, steps: definition.steps.map(step => ({...step, when: null}))});
      }}>
        {TRIGGER_TYPES.map(type => <option key={type} value={type}>{TRIGGERS[type].label}</option>)}
      </select>
      <p className="text-xs text-muted-foreground">{TRIGGERS[definition.trigger].description}</p></div>
    {definition.trigger === "workflow.scheduled" && schedule && <fieldset className="space-y-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Schedule</legend>
      <select aria-label="Repeat" className={selectClass} value={schedule.kind} onChange={event => {
        const kind = event.target.value as Schedule["kind"];
        set({schedule: kind === "ONCE" ? {kind, at: new Date(Date.now() + 86_400_000).toISOString()} : kind === "DAILY" ? {kind, time: "09:00"} : {kind, time: "09:00", weekdays: [1]}});
      }}><option value="ONCE">Once</option><option value="DAILY">Every day</option><option value="WEEKLY">Every week</option></select>
      {schedule.kind === "ONCE"
        ? <Input type="datetime-local" aria-label="Run at (UTC)" value={schedule.at.slice(0, 16)} onChange={event => event.target.value && set({schedule: {kind: "ONCE", at: new Date(`${event.target.value}:00Z`).toISOString()}})} />
        : <Input type="time" aria-label="Local time" value={schedule.time} onChange={event => set({schedule: {...schedule, time: event.target.value}})} />}
      {schedule.kind === "WEEKLY" && <><span id="wf-schedule-days" className="sr-only">Weekdays</span><Days id="wf-schedule-days" value={schedule.weekdays} onChange={weekdays => set({schedule: {...schedule, weekdays}})} /></>}
    </fieldset>}
    <div className="space-y-1.5"><Label htmlFor="wf-timezone">Timezone</Label>
      <Input id="wf-timezone" maxLength={64} value={definition.timeZone ?? "Asia/Dubai"} onChange={event => set({timeZone: event.target.value})} />
      <p className="text-xs text-muted-foreground">Schedules and hours use this IANA timezone; stored times are UTC.</p></div>
    <fieldset className="space-y-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Business hours</legend>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!definition.businessHours} onChange={event => set({businessHours: event.target.checked ? {weekdays: [1, 2, 3, 4, 5], start: "09:00", end: "18:00"} : null})} />Run actions only within business hours</label>
      {definition.businessHours && <>
        <span id="wf-business-days" className="sr-only">Business days</span>
        <Days id="wf-business-days" value={definition.businessHours.weekdays} onChange={weekdays => set({businessHours: {...definition.businessHours!, weekdays}})} />
        <div className="flex gap-2"><Input type="time" aria-label="Opens" value={definition.businessHours.start} onChange={event => set({businessHours: {...definition.businessHours!, start: event.target.value}})} />
          <Input type="time" aria-label="Closes" value={definition.businessHours.end} onChange={event => set({businessHours: {...definition.businessHours!, end: event.target.value}})} /></div>
      </>}
    </fieldset>
    <fieldset className="space-y-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Quiet hours</legend>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!definition.quietHours} onChange={event => set({quietHours: event.target.checked ? {start: "21:00", end: "08:00"} : null})} />Hold notifications and tasks overnight</label>
      {definition.quietHours && <div className="flex gap-2">
        <Input type="time" aria-label="Quiet from" value={definition.quietHours.start} onChange={event => set({quietHours: {...definition.quietHours!, start: event.target.value}})} />
        <Input type="time" aria-label="Quiet until" value={definition.quietHours.end} onChange={event => set({quietHours: {...definition.quietHours!, end: event.target.value}})} /></div>}
    </fieldset>
  </div>;
}

export function WorkflowEditor({organizationId, initial, workflowId, revision, currentVersionNumber, agents}: {
  organizationId: string; initial: WorkflowDefinitionInput; workflowId?: string; revision?: number; currentVersionNumber?: number; agents: Array<{id: string; name: string}>;
}) {
  const router = useRouter();
  const [definition, setDefinition] = useState<WorkflowDefinitionInput>(initial);
  const [selected, setSelected] = useState<GraphSelection>("trigger");
  const [adding, setAdding] = useState<ActionType>(() => actionsFor(initial.trigger)[0]);
  const [saving, setSaving] = useState(false);
  const [serverIssues, setServerIssues] = useState<string[]>([]);
  const validation = useMemo(() => issuesOf(definition), [definition]);
  const steps = definition.steps as EditableStep[];
  const available = actionsFor(definition.trigger);
  const dirty = JSON.stringify(definition) !== JSON.stringify(initial);

  const setSteps = (next: EditableStep[]) => setDefinition({...definition, steps: next as WorkflowDefinitionInput["steps"]});
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    setSteps(next);
    setSelected(target);
  };
  const remove = (index: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, position) => position !== index));
    setSelected(Math.max(0, index - 1));
  };
  const add = () => {
    if (steps.length >= LIMITS.steps) return;
    const type = available.includes(adding) ? adding : available[0];
    setSteps([...steps, newStep(type, steps.map(step => step.id))]);
    setSelected(steps.length);
  };
  const save = async () => {
    setSaving(true);
    setServerIssues([]);
    try {
      if (workflowId) {
        await automationsSend(`/api/automations/${workflowId}`, organizationId, "PUT", {definition, expectedRevision: revision, versionNumber: (currentVersionNumber ?? 1) + 1}, "The workflow could not be saved.");
        toast.success("Saved as a new draft version. Submit it for review when ready.");
        router.push(`/automations/${workflowId}`);
      } else {
        const created = await automationsSend<{id: string}>("/api/automations", organizationId, "POST", {definition}, "The workflow could not be created.");
        toast.success("Draft saved. Test it, then submit it for review.");
        router.push(`/automations/${created.id}`);
      }
      router.refresh();
    } catch (error) {
      setServerIssues(errorIssues(error));
      toast.error(errorMessage(error, "The workflow could not be saved."));
    } finally { setSaving(false); }
  };

  const selectedStep = typeof selected === "number" ? steps[selected] : null;
  const issues = [...validation.issues, ...serverIssues];
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
      <div className="min-w-0">
        <p className="truncate font-semibold">{definition.name || "Untitled workflow"}</p>
        <p className="text-xs text-muted-foreground">{steps.length} of {LIMITS.steps} steps · {workflowId ? `saving creates version ${(currentVersionNumber ?? 1) + 1}` : "new draft"} · never runs until approved and activated</p>
      </div>
      <div className="flex gap-2">
        <Link className={buttonVariants({variant: "ghost"})} href={workflowId ? `/automations/${workflowId}` : "/automations"}>Cancel</Link>
        <Button onClick={save} disabled={saving || !!validation.issues.length || (!!workflowId && !dirty)} className="hidden md:inline-flex">
          {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}Save draft</Button>
      </div>
    </div>

    {issues.length > 0 && <div className="rounded-xl border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100" role="alert">
      <p className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4" aria-hidden="true" />Fix these before saving</p>
      <ul className="mt-1 list-disc pl-5">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
    </div>}

    <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground md:hidden">Editing works on a tablet or computer. This is a read-only view.</p>
    <div className="md:hidden"><WorkflowGraph definition={definition} /></div>

    <div className="hidden gap-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <div className="space-y-3">
        <WorkflowGraph definition={definition} selected={selected} onSelect={setSelected} onMove={move} onRemove={remove} problemSteps={validation.steps} />
        <div className="mx-auto flex max-w-xl flex-wrap items-center gap-2 rounded-xl border border-dashed p-3">
          <Label htmlFor="wf-add" className="sr-only">Step to add</Label>
          <select id="wf-add" className={selectClass + " max-w-xs flex-1"} value={adding} onChange={event => setAdding(event.target.value as ActionType)}>
            {available.map(type => <option key={type} value={type}>{ACTIONS[type].label}</option>)}
          </select>
          <Button type="button" variant="outline" onClick={add} disabled={steps.length >= LIMITS.steps}><Plus aria-hidden="true" />Add step</Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">Select a step to configure it. With a step focused, Alt+↑ and Alt+↓ move it.</p>
      </div>
      <aside className="space-y-4 rounded-xl border bg-card p-4 md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:self-start md:overflow-y-auto" aria-label="Selected node settings">
        {selected === "trigger" && <TriggerPanel definition={definition} onChange={setDefinition} />}
        {selected === "conditions" && <div className="space-y-3">
          <div><h3 className="font-semibold">Start conditions</h3><p className="text-sm text-muted-foreground">Checked when the event arrives. Each step can add its own condition, rechecked with fresh data when the step runs.</p></div>
          <ConditionEditor id="wf-conditions" value={definition.conditions ?? null} trigger={definition.trigger} onChange={conditions => setDefinition({...definition, conditions})} />
        </div>}
        {selectedStep && <StepEditor key={selected} step={selectedStep} trigger={definition.trigger} agents={agents}
          onChange={step => setSteps(steps.map((item, index) => index === selected ? step : item))} />}
      </aside>
    </div>

    {validation.parsed && <div className="hidden md:block"><WorkflowTester key={validation.parsed.trigger} definition={validation.parsed} /></div>}
  </div>;
}
