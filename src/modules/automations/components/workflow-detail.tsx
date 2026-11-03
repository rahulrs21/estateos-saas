"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Archive, CheckCircle2, Loader2, Pause, Pencil, Play, Send, Undo2, Zap } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WORKFLOW_STATUS_LABELS, automationsGet, automationsSend, dateTime, errorMessage, type WorkflowDetail } from "../client";
import { parseWorkflowDefinition, type WorkflowDefinition } from "../definition";
import { describeTrigger } from "../describe";
import { ExecutionHistory } from "./execution-history";
import { WorkflowGraph } from "./workflow-graph";
import { WorkflowTester } from "./workflow-tester";

/*
 * A workflow's page: the graph, status actions allowed for the member's role
 * (the server checks each again), version history, a dry-run tester, Run now
 * for manual workflows and the execution history.
 */

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {ACTIVE: "default", IN_REVIEW: "secondary", APPROVED: "secondary", PAUSED: "outline", DRAFT: "outline", ARCHIVED: "outline"};
export const WorkflowStatus = ({status}: {status: string}) => <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{WORKFLOW_STATUS_LABELS[status] ?? status}</Badge>;

type Transition = "submit" | "return" | "approve" | "activate" | "pause" | "archive";

function RunNow({workflowId, organizationId, onQueued}: {workflowId: string; organizationId: string; onQueued: () => void}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Array<{id: string; fullName: string}>>([]);
  const [lead, setLead] = useState<{id: string; fullName: string} | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (search.trim().length < 2) return;
    const timer = setTimeout(() => {
      automationsGet<{leads: Array<{id: string; fullName: string}>}>(`/api/leads?search=${encodeURIComponent(search.trim())}&limit=8`)
        .then(data => setResults(data.leads.map(row => ({id: row.id, fullName: row.fullName}))), () => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const run = async () => {
    setBusy(true);
    try {
      await automationsSend(`/api/automations/${workflowId}/run`, organizationId, "POST", {requestId: crypto.randomUUID(), leadId: lead?.id ?? null}, "The run could not be queued.");
      toast.success("Queued. The worker runs it within a few seconds.");
      onQueued();
    } catch (error) { toast.error(errorMessage(error, "The run could not be queued.")); } finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded-xl border bg-card p-4" aria-labelledby="run-title">
    <h2 id="run-title" className="flex items-center gap-2 font-semibold"><Zap className="size-4" aria-hidden="true" />Run now</h2>
    <div className="space-y-1.5"><Label htmlFor="run-lead">For lead (optional)</Label>
      <Input id="run-lead" placeholder="Search leads by name" value={lead ? lead.fullName : search} onChange={event => { setLead(null); setSearch(event.target.value); }} autoComplete="off" />
      {!lead && search.trim().length >= 2 && results.length > 0 && <ul className="rounded-lg border bg-background text-sm" role="listbox" aria-label="Matching leads">
        {results.map(row => <li key={row.id}><button type="button" role="option" aria-selected={false} className="w-full px-3 py-1.5 text-left hover:bg-muted" onClick={() => { setLead(row); setResults([]); }}>{row.fullName}</button></li>)}
      </ul>}</div>
    <Button onClick={run} disabled={busy}>{busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}Run now</Button>
  </section>;
}

export function WorkflowDetailView({workflowId, organizationId}: {workflowId: string; organizationId: string}) {
  const [data, setData] = useState<WorkflowDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<Transition | null>(null);
  const [note, setNote] = useState("");
  const [historyKey, setHistoryKey] = useState(0);
  const load = useCallback(() => automationsGet<WorkflowDetail>(`/api/automations/${workflowId}`, "The workflow could not be loaded.")
    .then(detail => { setData(detail); setError(null); }, cause => setError(cause)), [workflowId]);
  useEffect(() => { void load(); }, [load]);

  if (error && !data) return <EmptyState icon={AlertTriangle} title="The workflow could not be loaded" description={errorMessage(error, "Reload the page or go back to Automation.")}>
    <div className="flex gap-2"><Button variant="outline" onClick={() => void load()}>Try again</Button><Link className={buttonVariants({variant: "ghost"})} href="/automations">Back to Automation</Link></div>
  </EmptyState>;
  if (!data) return <PageSkeleton />;
  const {workflow, versions, permissions} = data;
  let definition: WorkflowDefinition | null = null;
  try { definition = parseWorkflowDefinition(workflow.definition); } catch { /* shown below */ }

  const act = async (action: Transition) => {
    setBusy(action);
    try {
      await automationsSend(`/api/automations/${workflowId}/transition`, organizationId, "POST",
        {action, expectedRevision: workflow.revision, ...(action === "approve" ? {versionNumber: workflow.currentVersionNumber} : {}), ...(action === "return" ? {note} : {})}, "The workflow could not be updated.");
      toast.success({submit: "Submitted for review.", return: "Returned to draft.", approve: "Approved. Activate it to start running.", activate: "Active. New events now start executions.", pause: "Paused. Nothing new starts; waiting executions hold.", archive: "Archived."}[action]);
      setNote("");
      await load();
    } catch (cause) { toast.error(errorMessage(cause, "The workflow could not be updated.")); await load(); } finally { setBusy(null); }
  };
  const button = (action: Transition, label: string, Icon: typeof Send, variant: "default" | "outline" | "ghost" = "outline") =>
    <Button variant={variant} onClick={() => void act(action)} disabled={!!busy}>{busy === action ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Icon aria-hidden="true" />}{label}</Button>;
  const pendingVersion = workflow.approvedVersionNumber && workflow.approvedVersionNumber !== workflow.currentVersionNumber;

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold">{workflow.name}</h1><WorkflowStatus status={workflow.status} />{workflow.hasApprovalSteps && <Badge variant="outline">Has approval steps</Badge>}</div>
        {workflow.description && <p className="text-sm text-muted-foreground">{workflow.description}</p>}
        <p className="text-xs text-muted-foreground">
          {definition ? describeTrigger(definition) : workflow.triggerType} · version {workflow.currentVersionNumber}{workflow.approvedVersionNumber ? ` · approved version ${workflow.approvedVersionNumber}` : ""}
          {workflow.executorUid && ` · runs as ${workflow.executor?.displayName ?? "the activating member"}`}{workflow.nextRunAt && ` · next run ${dateTime(workflow.nextRunAt, workflow.timeZone)}`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {permissions.edit && <Link className={buttonVariants({variant: "outline"})} href={`/automations/${workflowId}/edit`}><Pencil aria-hidden="true" />Edit</Link>}
        {permissions.submit && button("submit", "Submit for review", Send, "default")}
        {permissions.approve && button("approve", "Approve", CheckCircle2, "default")}
        {permissions.activate && button("activate", workflow.status === "PAUSED" ? "Resume" : "Activate", Play, "default")}
        {permissions.pause && button("pause", "Pause", Pause)}
        {permissions.returnToDraft && button("return", "Return to draft", Undo2, "ghost")}
        {permissions.archive && button("archive", "Archive", Archive, "ghost")}
      </div>
    </div>

    {permissions.approve && data.selfApproval && <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />You created this workflow. Approving your own workflow is allowed only for owners and is recorded in the audit log; ask another owner or administrator if you can.</p>}
    {pendingVersion && <p className="rounded-xl border bg-muted/40 p-3 text-sm">Version {workflow.currentVersionNumber} is a draft. Version {workflow.approvedVersionNumber} {workflow.status === "ACTIVE" ? "keeps running" : "stays approved"} until the new version is approved.</p>}
    {permissions.returnToDraft && workflow.status === "IN_REVIEW" && <div className="max-w-md space-y-1.5"><Label htmlFor="return-note">Note when returning to draft (optional)</Label><Input id="return-note" maxLength={500} value={note} onChange={event => setNote(event.target.value)} /></div>}
    {!definition && <p className="text-sm text-destructive">The stored definition is no longer valid. Edit the workflow to fix it.</p>}

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-labelledby="graph-title" className="space-y-3">
        <h2 id="graph-title" className="font-semibold">Workflow</h2>
        {definition && <WorkflowGraph definition={definition} />}
      </section>
      <div className="space-y-5">
        {permissions.run && <RunNow workflowId={workflowId} organizationId={organizationId} onQueued={() => setHistoryKey(key => key + 1)} />}
        <section aria-labelledby="versions-title" className="space-y-2 rounded-xl border bg-card p-4">
          <h2 id="versions-title" className="font-semibold">Versions</h2>
          <ol className="space-y-1.5 text-sm">{versions.map(version => <li key={version.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>Version {version.versionNumber}{version.versionNumber === workflow.approvedVersionNumber && <Badge className="ml-2" variant="secondary">Approved</Badge>}</span>
            <span className="text-xs text-muted-foreground">{version.author?.displayName ?? "—"} · {dateTime(version.createdAt)}</span>
          </li>)}</ol>
          {workflow.approvedAt && <p className="text-xs text-muted-foreground">Approved by {workflow.approvedBy?.displayName ?? "—"} on {dateTime(workflow.approvedAt)}.</p>}
        </section>
      </div>
    </div>

    {definition && <div className="hidden md:block"><WorkflowTester definition={definition} /></div>}
    {permissions.viewExecutions && <ExecutionHistory key={historyKey} workflowId={workflowId} />}
  </div>;
}
