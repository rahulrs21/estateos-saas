"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CircleSlash, FlaskConical, PauseCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { evaluateCondition, type Facts } from "../conditions";
import { factsFor, type WorkflowDefinition } from "../definition";
import { actionLabel, describeCondition } from "../describe";
import { nextAllowedTime, withinHours } from "../scheduling";
import { selectClass } from "./condition-editor";

/*
 * A dry run against synthetic facts: the same pure condition and hours checks
 * the engine uses, with no database access and no side effects. Facts that
 * steps change (for example the assignee after distribution) keep the values
 * entered here.
 */

function initialFacts(definition: WorkflowDefinition): Facts {
  const facts: Facts = {};
  for (const [key, fact] of Object.entries(factsFor(definition.trigger))) {
    facts[key] = key === "event.origin" ? "CRM" : key === "event.occurredAt" ? new Date().toISOString()
      : fact.kind === "boolean" ? false : fact.options ? fact.options[0] : fact.kind === "number" ? 0 : fact.kind === "date" ? new Date().toISOString() : "";
  }
  return facts;
}

export function WorkflowTester({definition}: {definition: WorkflowDefinition}) {
  const [facts, setFacts] = useState<Facts>(() => initialFacts(definition));
  const [at, setAt] = useState(() => new Date().toISOString().slice(0, 16));
  const available = factsFor(definition.trigger);
  const result = useMemo(() => {
    const now = new Date(`${at}:00Z`);
    const matches = evaluateCondition(definition.conditions, facts, now);
    // Each step runs after the delays before it.
    const offsets = definition.steps.map((_, index) => definition.steps.slice(0, index).reduce((sum, item) => sum + (item.type === "delay" ? item.minutes : 0), 0));
    const steps = definition.steps.map((step, index) => {
      const moment = new Date(now.getTime() + offsets[index] * 60_000);
      const runs = evaluateCondition(step.when, facts, moment);
      const held = runs && !["delay", "end"].includes(step.type) && !withinHours(definition, moment) ? nextAllowedTime(definition, moment) : null;
      return {step, runs, held};
    });
    return {matches, steps};
  }, [definition, facts, at]);

  return <section className="space-y-4 rounded-xl border bg-card p-4" aria-labelledby="tester-title">
    <div>
      <h2 id="tester-title" className="flex items-center gap-2 font-semibold"><FlaskConical className="size-4" aria-hidden="true" />Test with a synthetic event</h2>
      <p className="text-sm text-muted-foreground">Nothing is saved or sent. Change the facts to see which steps would run.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="tester-at">Event time (UTC)</Label><Input id="tester-at" type="datetime-local" value={at} onChange={event => event.target.value && setAt(event.target.value)} /></div>
      {Object.entries(available).filter(([key]) => key !== "event.occurredAt").map(([key, fact]) => <div key={key} className="space-y-1.5">
        <Label htmlFor={`fact-${key}`}>{fact.label}</Label>
        {fact.kind === "boolean"
          ? <select id={`fact-${key}`} className={selectClass} value={String(facts[key])} onChange={event => setFacts({...facts, [key]: event.target.value === "true"})}><option value="false">No</option><option value="true">Yes</option></select>
          : fact.options
            ? <select id={`fact-${key}`} className={selectClass} value={String(facts[key] ?? "")} onChange={event => setFacts({...facts, [key]: event.target.value})}>
                <option value="">(empty)</option>{fact.options.map(option => <option key={option} value={option}>{option.toLowerCase().replaceAll("_", " ")}</option>)}
              </select>
            : <Input id={`fact-${key}`} type={fact.kind === "number" ? "number" : fact.kind === "date" ? "datetime-local" : "text"} maxLength={160}
                value={fact.kind === "date" ? String(facts[key] ?? "").slice(0, 16) : String(facts[key] ?? "")}
                onChange={event => setFacts({...facts, [key]: fact.kind === "number" ? (event.target.value === "" ? null : Number(event.target.value)) : fact.kind === "date" ? (event.target.value ? new Date(`${event.target.value}:00Z`).toISOString() : null) : event.target.value})} />}
      </div>)}
    </div>
    <div className="rounded-lg border bg-background p-3 text-sm" role="status" aria-live="polite">
      {!result.matches
        ? <p className="flex items-center gap-2"><CircleSlash className="size-4 text-muted-foreground" aria-hidden="true" />The workflow would not start: {describeCondition(definition.conditions, definition.trigger)} is not met.</p>
        : <ol className="space-y-1.5">
            <li className="flex items-center gap-2 font-medium"><CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />The workflow would start.</li>
            {result.steps.map(({step, runs, held}, index) => <li key={`${step.id}-${index}`} className="flex items-start gap-2">
              {runs ? held ? <PauseCircle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" /> : <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
              <span>{index + 1}. {actionLabel(step.type)} — {runs ? held ? `waits for allowed hours, until ${held.toISOString().slice(0, 16).replace("T", " ")} UTC` : "runs" : "skipped (condition not met)"}</span>
            </li>)}
          </ol>}
    </div>
  </section>;
}
