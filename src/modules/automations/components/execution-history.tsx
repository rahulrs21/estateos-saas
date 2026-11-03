"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, History, Loader2, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXECUTION_STATUS_LABELS, automationsGet, dateTime, describeError, duration, errorMessage, type ExecutionDetail, type ExecutionList } from "../client";
import { TRIGGERS, TRIGGER_TYPES } from "../definition";
import { actionLabel } from "../describe";
import { selectClass } from "./condition-editor";

/*
 * Execution history with filters (workflow, status, agent, date, trigger) and
 * per-step details. Errors are shown as stored codes with a plain explanation;
 * provider messages and stack traces are never stored or shown.
 */

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {SUCCEEDED: "default", FAILED: "destructive", WAITING: "secondary", APPROVAL_REQUIRED: "secondary", RUNNING: "secondary"};
export const ExecutionStatus = ({status}: {status: string}) => <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{EXECUTION_STATUS_LABELS[status] ?? status}</Badge>;

function Steps({id}: {id: string}) {
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    automationsGet<ExecutionDetail>(`/api/automations/executions/${id}`).then(data => active && setDetail(data), cause => active && setError(errorMessage(cause, "The steps could not be loaded.")));
    return () => { active = false; };
  }, [id]);
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!detail) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading steps…</p>;
  return <div className="space-y-2">
    {detail.execution.errorCode && <p className="text-sm text-destructive">{describeError(detail.execution.errorCode)}</p>}
    {detail.job && ["QUEUED", "CLAIMED"].includes(detail.job.status) && <p className="text-sm text-muted-foreground">Next run: {dateTime(detail.job.runAt)} · attempt {detail.job.attemptCount ?? 0}</p>}
    {detail.steps.length === 0 ? <p className="text-sm text-muted-foreground">No steps have run yet.</p>
      : <ol className="space-y-1.5">{detail.steps.map(step => <li key={step.id} className="rounded-lg border bg-background px-3 py-2 text-sm">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{step.position + 1}. {actionLabel(step.actionType as Parameters<typeof actionLabel>[0])}</span>
          <ExecutionStatus status={step.status} />
          {step.attemptCount > 1 && <span className="text-xs text-muted-foreground">{step.attemptCount} attempts</span>}
          <span className="text-xs text-muted-foreground">{dateTime(step.completedAt ?? step.startedAt)}</span>
        </span>
        {step.resultSummary && <span className="mt-1 block text-muted-foreground">{step.resultSummary}</span>}
        {step.errorCode && <span className="mt-1 block text-destructive">{describeError(step.errorCode)}</span>}
      </li>)}</ol>}
  </div>;
}

export function ExecutionHistory({workflowId, workflows = [], agents = []}: {workflowId?: string; workflows?: Array<{id: string; name: string}>; agents?: Array<{id: string; name: string}>}) {
  const [filters, setFilters] = useState({workflowId: workflowId ?? "", status: "", agentId: "", triggerType: "", from: "", to: ""});
  const [data, setData] = useState<ExecutionList | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (!value) continue;
      // Dates are whole days in the browser's timezone, sent as UTC instants.
      query.set(key, key === "from" ? new Date(`${value}T00:00:00`).toISOString() : key === "to" ? new Date(`${value}T23:59:59.999`).toISOString() : value);
    }
    if (offset) query.set("offset", String(offset));
    return automationsGet<ExecutionList>(`/api/automations/executions?${query}`, "The execution history could not be loaded.")
      .then(rows => { setData(rows); setError(null); }, cause => setError(errorMessage(cause, "The execution history could not be loaded.")))
      .finally(() => setLoading(false));
  }, [filters, offset]);
  useEffect(() => { void load(); }, [load]);
  const set = (key: keyof typeof filters, value: string) => { setLoading(true); setOffset(0); setFilters(current => ({...current, [key]: value})); };
  const page = (next: number) => { setLoading(true); setOffset(next); };
  const workflowName = (id: string) => workflows.find(item => item.id.replaceAll("-", "") === id.replaceAll("-", ""))?.name;

  return <section className="space-y-3 rounded-xl border bg-card p-4" aria-labelledby="executions-title">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="executions-title" className="flex items-center gap-2 font-semibold"><History className="size-4" aria-hidden="true" />Execution history</h2>
      <Button size="sm" variant="ghost" onClick={() => { setLoading(true); void load(); }} disabled={loading}><RefreshCw className={loading ? "animate-spin" : undefined} aria-hidden="true" />Refresh</Button>
    </div>
    <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {!workflowId && <div className="space-y-1"><Label htmlFor="ex-workflow" className="text-xs">Workflow</Label>
        <select id="ex-workflow" className={selectClass} value={filters.workflowId} onChange={event => set("workflowId", event.target.value)}><option value="">All</option>{workflows.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}
      <div className="space-y-1"><Label htmlFor="ex-status" className="text-xs">Status</Label>
        <select id="ex-status" className={selectClass} value={filters.status} onChange={event => set("status", event.target.value)}><option value="">All</option>{Object.entries(EXECUTION_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      {agents.length > 0 && <div className="space-y-1"><Label htmlFor="ex-agent" className="text-xs">Agent</Label>
        <select id="ex-agent" className={selectClass} value={filters.agentId} onChange={event => set("agentId", event.target.value)}><option value="">All</option>{agents.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}
      {!workflowId && <div className="space-y-1"><Label htmlFor="ex-trigger" className="text-xs">Trigger</Label>
        <select id="ex-trigger" className={selectClass} value={filters.triggerType} onChange={event => set("triggerType", event.target.value)}><option value="">All</option>{TRIGGER_TYPES.map(type => <option key={type} value={type}>{TRIGGERS[type].label}</option>)}</select></div>}
      <div className="space-y-1"><Label htmlFor="ex-from" className="text-xs">From</Label><Input id="ex-from" type="date" value={filters.from} onChange={event => set("from", event.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="ex-to" className="text-xs">To</Label><Input id="ex-to" type="date" value={filters.to} onChange={event => set("to", event.target.value)} /></div>
    </div>
    {error ? <p className="text-sm text-destructive" role="alert">{error}</p>
      : !data ? <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading executions…</p>
      : data.executions.length === 0 ? <EmptyState icon={History} title="No executions" description="Executions appear here when an active workflow's trigger fires." />
      : <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground"><tr>
          <th className="w-8 py-2" /><th className="py-2 pr-3 font-medium">Started</th>{!workflowId && <th className="py-2 pr-3 font-medium">Workflow</th>}<th className="py-2 pr-3 font-medium">Trigger</th>
          <th className="py-2 pr-3 font-medium">Lead</th><th className="py-2 pr-3 font-medium">Status</th><th className="py-2 pr-3 font-medium">Steps</th><th className="py-2 font-medium">Duration</th>
        </tr></thead>
        <tbody>{data.executions.map(row => <Fragment key={row.id}>
          <tr className="border-t">
            <td className="py-2"><Button size="sm" variant="ghost" onClick={() => setOpen(open === row.id ? null : row.id)} aria-expanded={open === row.id} aria-label={open === row.id ? "Hide steps" : "Show steps"}>
              {open === row.id ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}</Button></td>
            <td className="py-2 pr-3 whitespace-nowrap">{dateTime(row.createdAt)}</td>
            {!workflowId && <td className="py-2 pr-3">{row.workflow?.name ?? workflowName(row.workflowId) ?? "—"}</td>}
            <td className="py-2 pr-3">{TRIGGERS[row.triggerType as keyof typeof TRIGGERS]?.label ?? row.triggerType}</td>
            <td className="py-2 pr-3">{row.lead?.fullName ?? "—"}</td>
            <td className="py-2 pr-3"><ExecutionStatus status={row.status} />{row.errorCode && <span className="ml-1 text-xs text-muted-foreground">{row.errorCode}</span>}</td>
            <td className="py-2 pr-3">{row.actionCount}</td>
            <td className="py-2">{duration(row.durationMs)}</td>
          </tr>
          {open === row.id && <tr><td colSpan={workflowId ? 7 : 8} className="pb-3 pl-10"><Steps id={row.id} /></td></tr>}
        </Fragment>)}</tbody>
      </table></div>}
    {data && (offset > 0 || data.executions.length === 30) && <div className="flex justify-end gap-2">
      <Button size="sm" variant="outline" disabled={offset === 0 || loading} onClick={() => page(Math.max(0, offset - 30))}>Newer</Button>
      <Button size="sm" variant="outline" disabled={data.executions.length < 30 || loading} onClick={() => page(offset + 30)}>Older</Button>
    </div>}
  </section>;

}
