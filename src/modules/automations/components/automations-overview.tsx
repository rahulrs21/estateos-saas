"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Plus, RefreshCw, Workflow } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { WORKFLOW_STATUS_LABELS, automationsGet, dateTime, duration, errorMessage, type Metrics, type WorkflowList } from "../client";
import { TRIGGERS } from "../definition";
import { selectClass } from "./condition-editor";
import { ExecutionHistory } from "./execution-history";
import { WorkflowStatus } from "./workflow-detail";

/*
 * The automation dashboard (docs/WORKFLOW_BUILDER.md#dashboard). Every number
 * comes from stored workflows and executions of the active company; agents see
 * only their own workflows and no company-wide metrics.
 */

function Stat({label, value, hint}: {label: string; value: string | number; hint?: string}) {
  return <div className="rounded-xl border bg-card p-4">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
  </div>;
}

export function AutomationsOverview() {
  const [list, setList] = useState<WorkflowList | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => automationsGet<WorkflowList>(`/api/automations${status ? `?status=${status}` : ""}`, "Workflows could not be loaded.")
    .then(async workflows => {
      const counts = workflows.canViewAll ? await automationsGet<Metrics>("/api/automations/metrics", "Metrics could not be loaded.") : null;
      setList(workflows); setMetrics(counts); setError(null);
    }, cause => setError(errorMessage(cause, "Automation could not be loaded."))), [status]);
  useEffect(() => { void load(); }, [load]);

  if (error && !list) return <EmptyState icon={AlertTriangle} title="Automation could not be loaded" description={error}><Button variant="outline" onClick={() => void load()}>Try again</Button></EmptyState>;
  if (!list) return <PageSkeleton />;
  const workflowTotal = metrics ? Object.values(metrics.workflows).reduce((sum, count) => sum + count, 0) : list.workflows.length;
  const nameOf = (id: string) => list.workflows.find(row => row.id.replaceAll("-", "") === id.replaceAll("-", ""))?.name ?? "A workflow";

  return <div className="space-y-6">
    {metrics && <section aria-labelledby="metrics-title" className="space-y-3">
      <div className="flex items-center justify-between"><h2 id="metrics-title" className="font-semibold">Last 30 days</h2>
        <Button size="sm" variant="ghost" onClick={() => void load()}><RefreshCw aria-hidden="true" />Refresh</Button></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Workflows" value={workflowTotal} hint={`${metrics.workflows.ACTIVE ?? 0} active · ${metrics.workflows.PAUSED ?? 0} paused`} />
        <Stat label="Pending approvals" value={metrics.pendingApprovals} />
        <Stat label="Executions" value={`${metrics.executions.SUCCEEDED ?? 0} succeeded`} hint={`${metrics.executions.FAILED ?? 0} failed · ${(metrics.executions.WAITING ?? 0) + (metrics.executions.QUEUED ?? 0) + (metrics.executions.RUNNING ?? 0)} in progress`} />
        <Stat label="Average duration" value={duration(metrics.averageDurationMs)} hint="Finished executions, including waits" />
      </div>
      {metrics.topWorkflows.length > 0 && <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-medium">Most triggered</h3>
        <ol className="mt-2 space-y-1 text-sm">{metrics.topWorkflows.map(row => <li key={row.workflowId} className="flex justify-between gap-3">
          <Link className="truncate hover:underline" href={`/automations/${row.workflowId}`}>{nameOf(row.workflowId)}</Link><span className="tabular-nums text-muted-foreground">{row.count}</span>
        </li>)}</ol>
      </div>}
    </section>}

    <section aria-labelledby="workflows-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="workflows-title" className="font-semibold">{list.canViewAll ? "Workflows" : "Your workflows"}</h2>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="wf-status">Status</label>
          <select id="wf-status" className={selectClass + " w-40"} value={status} onChange={event => setStatus(event.target.value)}>
            <option value="">All statuses</option>{Object.entries(WORKFLOW_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <Link className={buttonVariants()} href="/automations/new"><Plus aria-hidden="true" />New workflow</Link>
        </div>
      </div>
      {list.workflows.length === 0
        ? <div className="rounded-xl border bg-card"><EmptyState icon={Workflow} title={status ? "No workflows with this status" : "No workflows yet"} description="Start from a template such as New lead assignment, or build one from the allowed triggers and actions.">
            <Link className={buttonVariants({variant: "outline"})} href="/automations/new">Choose a template</Link></EmptyState></div>
        : <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr className="border-b">
            <th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Trigger</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Version</th><th className="px-4 py-2 font-medium">Updated</th>
          </tr></thead>
          <tbody>{list.workflows.map(row => <tr key={row.id} className="border-b last:border-0">
            <td className="px-4 py-2"><Link className="font-medium hover:underline" href={`/automations/${row.id}`}>{row.name}</Link></td>
            <td className="px-4 py-2 text-muted-foreground">{TRIGGERS[row.triggerType as keyof typeof TRIGGERS]?.label ?? row.triggerType}</td>
            <td className="px-4 py-2"><WorkflowStatus status={row.status} /></td>
            <td className="px-4 py-2 tabular-nums">{row.currentVersionNumber}{row.approvedVersionNumber && row.approvedVersionNumber !== row.currentVersionNumber ? ` (v${row.approvedVersionNumber} approved)` : ""}</td>
            <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{dateTime(row.updatedAt)}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>

    {list.canViewAll && <ExecutionHistory workflows={list.workflows.map(row => ({id: row.id, name: row.name}))} agents={list.agents} />}
  </div>;
}
