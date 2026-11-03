"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LIMITS, OPERATORS_BY_KIND, OPERATOR_LABELS, factsFor, type Condition, type ConditionValue, type FactDefinition, type Operator, type Trigger } from "../definition";

/*
 * Declarative conditions: AND/OR groups of field–operator–value rows. Fields
 * and operators come from the trigger's allowlist, so the editor cannot build
 * anything the server would not accept; the server validates again on save.
 */

export const selectClass = "h-9 w-full rounded-lg border bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

type Rule = Extract<Condition, {field: string}>;
type Group = Extract<Condition, {mode: string}>;

function defaultValue(fact: FactDefinition | undefined, operator: Operator): ConditionValue {
  if (operator === "empty" || operator === "not_empty") return null;
  if (operator === "within_minutes") return 60;
  if (!fact) return "";
  if (fact.kind === "boolean") return false;
  if (fact.kind === "number") return 0;
  if (fact.kind === "date") return new Date().toISOString();
  return fact.options?.[0] ?? "";
}

export function newRule(trigger: Trigger): Rule {
  const [field, fact] = Object.entries(factsFor(trigger)).find(([key]) => !key.startsWith("event.")) ?? Object.entries(factsFor(trigger))[0];
  const operator = OPERATORS_BY_KIND[fact.kind][0];
  return {field, operator, value: defaultValue(fact, operator)};
}

function ValueInput({rule, fact, onChange, id}: {rule: Rule; fact: FactDefinition | undefined; onChange: (value: ConditionValue) => void; id: string}) {
  if (rule.operator === "empty" || rule.operator === "not_empty") return null;
  if (rule.operator === "within_minutes") return <Input id={id} type="number" min={1} max={LIMITS.delayMinutes} aria-label="Minutes" value={Number(rule.value ?? 60)} onChange={event => onChange(Number(event.target.value))} />;
  if (!fact) return null;
  if (fact.kind === "boolean") return <select id={id} aria-label="Value" className={selectClass} value={String(rule.value)} onChange={event => onChange(event.target.value === "true")}><option value="true">Yes</option><option value="false">No</option></select>;
  if (fact.kind === "number") return <Input id={id} type="number" aria-label="Value" value={Number(rule.value ?? 0)} onChange={event => onChange(Number(event.target.value))} />;
  if (fact.kind === "date") {
    const local = typeof rule.value === "string" && Number.isFinite(Date.parse(rule.value)) ? new Date(rule.value).toISOString().slice(0, 16) : "";
    return <Input id={id} type="datetime-local" aria-label="Date and time (UTC)" value={local} onChange={event => onChange(event.target.value ? new Date(`${event.target.value}:00Z`).toISOString() : "")} />;
  }
  if (fact.options && rule.operator !== "contains") return <select id={id} aria-label="Value" className={selectClass} value={String(rule.value ?? "")} onChange={event => onChange(event.target.value)}>
    {fact.options.map(option => <option key={option} value={option}>{option.toLowerCase().replaceAll("_", " ")}</option>)}
  </select>;
  return <Input id={id} aria-label="Value" maxLength={160} value={String(rule.value ?? "")} onChange={event => onChange(event.target.value)} />;
}

function RuleRow({rule, trigger, onChange, onRemove, path}: {rule: Rule; trigger: Trigger; onChange: (rule: Rule) => void; onRemove: () => void; path: string}) {
  const facts = factsFor(trigger);
  const fact = facts[rule.field];
  const operators = fact ? OPERATORS_BY_KIND[fact.kind] : [];
  return <div className="grid gap-2 rounded-lg border bg-background p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
    <select aria-label="Field" className={selectClass} value={rule.field} onChange={event => {
      const next = facts[event.target.value];
      const operator = OPERATORS_BY_KIND[next.kind][0];
      onChange({field: event.target.value, operator, value: defaultValue(next, operator)});
    }}>
      {!fact && <option value={rule.field}>{rule.field} (not available)</option>}
      {Object.entries(facts).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
    </select>
    <select aria-label="Operator" className={selectClass} value={rule.operator} onChange={event => {
      const operator = event.target.value as Operator;
      onChange({...rule, operator, value: defaultValue(fact, operator)});
    }}>
      {operators.map(operator => <option key={operator} value={operator}>{OPERATOR_LABELS[operator]}</option>)}
    </select>
    <ValueInput id={`${path}-value`} rule={rule} fact={fact} onChange={value => onChange({...rule, value})} />
    <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label="Remove condition"><Trash2 aria-hidden="true" /></Button>
  </div>;
}

function GroupEditor({group, trigger, onChange, onRemove, depth, path}: {group: Group; trigger: Trigger; onChange: (group: Group) => void; onRemove?: () => void; depth: number; path: string}) {
  const update = (index: number, child: Condition | null) => {
    const conditions = group.conditions.flatMap((item, position) => position === index ? (child ? [child] : []) : [item]);
    if (!conditions.length) { onRemove?.(); if (!onRemove) onChange({...group, conditions: [newRule(trigger)]}); return; }
    onChange({...group, conditions});
  };
  return <fieldset className="space-y-2 rounded-lg border border-dashed p-2">
    <legend className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
      Match
      <select aria-label="Match all or any" className="h-7 rounded-md border bg-background px-1 text-xs" value={group.mode} onChange={event => onChange({...group, mode: event.target.value as Group["mode"]})}>
        <option value="AND">all of</option><option value="OR">any of</option>
      </select>
      {onRemove && <Button type="button" size="sm" variant="ghost" onClick={onRemove} aria-label="Remove group"><Trash2 aria-hidden="true" /></Button>}
    </legend>
    {group.conditions.map((child, index) => "mode" in child
      ? <GroupEditor key={index} group={child} trigger={trigger} depth={depth + 1} path={`${path}-${index}`} onChange={next => update(index, next)} onRemove={() => update(index, null)} />
      : <RuleRow key={index} rule={child} trigger={trigger} path={`${path}-${index}`} onChange={next => update(index, next)} onRemove={() => update(index, null)} />)}
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" disabled={group.conditions.length >= 10} onClick={() => onChange({...group, conditions: [...group.conditions, newRule(trigger)]})}><Plus aria-hidden="true" />Condition</Button>
      {depth + 1 < LIMITS.conditionDepth && <Button type="button" size="sm" variant="outline" disabled={group.conditions.length >= 10}
        onClick={() => onChange({...group, conditions: [...group.conditions, {mode: group.mode === "AND" ? "OR" : "AND", conditions: [newRule(trigger)]}]})}><Plus aria-hidden="true" />Group</Button>}
    </div>
  </fieldset>;
}

/** Edits an optional condition. A single rule is stored as an AND group of one, which reads the same. */
export function ConditionEditor({value, trigger, onChange, emptyLabel = "No conditions: always runs.", id}: {value: Condition | null | undefined; trigger: Trigger; onChange: (value: Condition | null) => void; emptyLabel?: string; id: string}) {
  if (!value) return <div className="space-y-2">
    <p className="text-sm text-muted-foreground">{emptyLabel}</p>
    <Button type="button" size="sm" variant="outline" onClick={() => onChange({mode: "AND", conditions: [newRule(trigger)]})}><Plus aria-hidden="true" />Add a condition</Button>
  </div>;
  const group: Group = "mode" in value ? value : {mode: "AND", conditions: [value]};
  return <GroupEditor group={group} trigger={trigger} depth={0} path={id} onChange={onChange} onRemove={() => onChange(null)} />;
}
