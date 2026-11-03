"use client";

import { ArrowDown, ArrowUp, Clock, Filter, Flag, ShieldCheck, Trash2, Zap, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Action, WorkflowDefinitionInput } from "../definition";
import { actionLabel, describeCondition, describeStep, describeTrigger, nodeKind, type NodeKind } from "../describe";

/*
 * The workflow as a vertical graph: TRIGGER → CONDITION → ACTION → DELAY → …
 * Branches are per-step conditions ("only when"), so a linear graph shows the
 * whole flow without a graph-editor dependency. Nodes are buttons: Tab moves
 * between them, and in the editor Alt+↑/↓ moves the selected step.
 */

export type GraphSelection = "trigger" | "conditions" | number;

const KIND_STYLE: Record<NodeKind, {icon: LucideIcon; label: string; tone: string}> = {
  TRIGGER: {icon: Zap, label: "Trigger", tone: "border-primary/50 bg-primary/5"},
  CONDITION: {icon: Filter, label: "Condition", tone: "border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20"},
  ACTION: {icon: Flag, label: "Action", tone: "border-border bg-card"},
  DELAY: {icon: Clock, label: "Delay", tone: "border-sky-500/40 bg-sky-50/60 dark:bg-sky-950/20"},
  APPROVAL: {icon: ShieldCheck, label: "Approval", tone: "border-violet-500/40 bg-violet-50/60 dark:bg-violet-950/20"},
  END: {icon: Flag, label: "End", tone: "border-border bg-muted/40"},
};

function Connector() {
  return <div className="flex justify-center py-1" aria-hidden="true"><span className="h-5 w-px bg-border" /></div>;
}

function Node({kind, title, detail, condition, selected, onSelect, children, problem}: {
  kind: NodeKind; title: string; detail: string; condition?: string | null; selected?: boolean; onSelect?: () => void; children?: React.ReactNode; problem?: boolean;
}) {
  const style = KIND_STYLE[kind];
  const Icon = style.icon;
  const body = <>
    <span className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Badge variant="outline" className="text-[10px] tracking-wide uppercase">{style.label}</Badge>
      <span className="truncate text-sm font-medium">{title}</span>
    </span>
    <span className="mt-1.5 block text-sm text-muted-foreground">{detail}</span>
    {condition && <span className="mt-1.5 block text-xs text-amber-800 dark:text-amber-300">Only when: {condition}</span>}
  </>;
  return <div className={cn("relative rounded-xl border p-3 transition-colors", style.tone, selected && "ring-2 ring-primary", problem && "border-destructive")}>
    {onSelect
      ? <button type="button" className="block w-full rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-pressed={selected} onClick={onSelect}>{body}</button>
      : <div>{body}</div>}
    {children && <div className="mt-2 flex flex-wrap gap-1">{children}</div>}
  </div>;
}

export function WorkflowGraph({definition, selected, onSelect, onMove, onRemove, problemSteps = []}: {
  definition: WorkflowDefinitionInput;
  selected?: GraphSelection | null;
  onSelect?: (selection: GraphSelection) => void;
  onMove?: (index: number, direction: -1 | 1) => void;
  onRemove?: (index: number) => void;
  problemSteps?: number[];
}) {
  const editable = !!onMove && !!onRemove;
  const steps = definition.steps as Array<Partial<Action> & Pick<Action, "type" | "id">>;
  return <ol className="mx-auto max-w-xl" aria-label="Workflow steps">
    <li>
      <Node kind="TRIGGER" title={describeTrigger(definition)} detail={definition.description || "Starts the workflow."} selected={selected === "trigger"} onSelect={onSelect && (() => onSelect("trigger"))} />
    </li>
    <li><Connector />
      <Node kind="CONDITION" title={definition.conditions ? "Conditions" : "No conditions"} detail={describeCondition(definition.conditions ?? null, definition.trigger)}
        selected={selected === "conditions"} onSelect={onSelect && (() => onSelect("conditions"))} />
    </li>
    {steps.map((step, index) => <li key={`${step.id}-${index}`}
      onKeyDown={editable ? event => {
        if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
        event.preventDefault();
        onMove!(index, event.key === "ArrowUp" ? -1 : 1);
      } : undefined}>
      <Connector />
      <Node kind={nodeKind(step)} title={`${index + 1}. ${actionLabel(step.type)}`} detail={describeStep(step)} condition={step.when ? describeCondition(step.when, definition.trigger) : null}
        selected={selected === index} onSelect={onSelect && (() => onSelect(index))} problem={problemSteps.includes(index)}>
        {editable && <>
          <Button type="button" size="sm" variant="ghost" disabled={index === 0} onClick={() => onMove!(index, -1)} aria-label={`Move step ${index + 1} up`}><ArrowUp aria-hidden="true" /></Button>
          <Button type="button" size="sm" variant="ghost" disabled={index === steps.length - 1} onClick={() => onMove!(index, 1)} aria-label={`Move step ${index + 1} down`}><ArrowDown aria-hidden="true" /></Button>
          <Button type="button" size="sm" variant="ghost" disabled={steps.length === 1} onClick={() => onRemove!(index)} aria-label={`Delete step ${index + 1}`}><Trash2 aria-hidden="true" /></Button>
        </>}
      </Node>
    </li>)}
  </ol>;
}
