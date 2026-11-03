"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { automationsGet, automationsSend, dateTime, describeError, errorMessage } from "../client";
import { TRIGGERS } from "../definition";
import { actionLabel } from "../describe";
import type { listApprovals } from "../server/approvals";

/*
 * Approvals (docs/WORKFLOW_APPROVALS.md#ui). Each card shows the exact change
 * the worker will make if approved. The decision is checked again on the
 * server: role, separation of duties, expiry, and that the record has not
 * changed since the request.
 */

type Approvals = Awaited<ReturnType<typeof listApprovals>>;
type Row = Approvals["approvals"][number];

const STATUS: Record<string, {label: string; variant: "default" | "secondary" | "outline" | "destructive"}> = {
  PENDING: {label: "Pending", variant: "secondary"}, APPROVED: {label: "Approved", variant: "default"}, EXECUTED: {label: "Approved and applied", variant: "default"},
  REJECTED: {label: "Rejected", variant: "destructive"}, EXPIRED: {label: "Expired", variant: "outline"}, CANCELLED: {label: "Cancelled", variant: "outline"},
};
const person = (row: {userProfile?: {displayName?: string | null} | null; email: string} | null | undefined) => row ? row.userProfile?.displayName || row.email : "Unassigned";

function reasonOf(row: Row) {
  try { return (JSON.parse(row.approvedActionSnapshot) as {action?: {reason?: string}}).action?.reason ?? null; } catch { return null; }
}

function ApprovalCard({row, organizationId, onDecided}: {row: Row; organizationId: string; onDecided: () => void}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"APPROVED" | "REJECTED" | null>(null);
  const status = STATUS[row.status] ?? {label: row.status, variant: "outline" as const};
  const decide = async (decision: "APPROVED" | "REJECTED") => {
    setBusy(decision);
    try {
      await automationsSend(`/api/approvals/${row.id}/decide`, organizationId, "POST", {decision, reason, snapshotHash: row.snapshotHash}, "The decision could not be saved.");
      toast.success(decision === "APPROVED" ? "Approved. The workflow applies the change within a few seconds." : "Rejected. The workflow execution ends.");
      onDecided();
    } catch (error) { toast.error(errorMessage(error, "The decision could not be saved.")); onDecided(); } finally { setBusy(null); }
  };
  const trigger = row.execution.triggeringEvent?.triggerType ?? row.execution.triggerType;
  return <li className="space-y-3 rounded-xl border bg-card p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold">{actionLabel(row.actionType as Parameters<typeof actionLabel>[0])}
          <Badge variant={status.variant}>{status.label}</Badge><Badge variant="outline">{row.risk} risk</Badge></p>
        <p className="text-sm text-muted-foreground">
          <Link className="hover:underline" href={`/automations/${row.workflow.id}`}>{row.workflow.name}</Link> · version {row.execution.workflowVersion?.versionNumber ?? "—"} ·
          after “{TRIGGERS[trigger as keyof typeof TRIGGERS]?.label ?? trigger}” · requested {dateTime(row.requestedAt)} for {row.requestedBy?.displayName ?? "the workflow's executor"}
        </p>
      </div>
      {row.status === "PENDING" && <p className="text-xs text-muted-foreground">Expires {dateTime(row.expiresAt)}</p>}
    </div>

    <dl className="grid gap-2 rounded-lg border bg-background p-3 text-sm sm:grid-cols-2">
      {row.lead && <div><dt className="text-xs text-muted-foreground">Lead</dt><dd><Link className="font-medium hover:underline" href={`/leads/${row.lead.id}`}>{row.lead.fullName}</Link> <span className="text-muted-foreground">({row.lead.status.toLowerCase().replaceAll("_", " ")})</span></dd></div>}
      {row.actionType === "lead.reassign" && <div><dt className="text-xs text-muted-foreground">Proposed change</dt>
        <dd className="flex flex-wrap items-center gap-1.5"><span>{person(row.fromMembership)}</span><ArrowRight className="size-3.5" aria-label="to" /><span className="font-medium">{person(row.toMembership)}</span></dd></div>}
      {reasonOf(row) && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Reason</dt><dd>{reasonOf(row)}</dd></div>}
      {row.decidedAt && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Decision</dt>
        <dd>{row.approver?.displayName ?? "The worker"} · {dateTime(row.decidedAt)}{row.decisionReason ? ` · “${row.decisionReason}”` : ""}
          {row.resultStatus && <> · result: {row.resultStatus.toLowerCase()}</>}{row.resultErrorCode && <span className="text-destructive"> ({describeError(row.resultErrorCode) || row.resultErrorCode})</span>}</dd></div>}
    </dl>

    {row.status === "PENDING" && (row.canDecide
      ? <div className="space-y-2">
          {row.selfApproval && <p className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />This workflow runs as you. As an owner you may decide it; the audit log records a self-approval.</p>}
          <div className="space-y-1.5"><Label htmlFor={`reason-${row.id}`}>Reason (required to reject)</Label>
            <Input id={`reason-${row.id}`} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void decide("APPROVED")} disabled={!!busy}>{busy === "APPROVED" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}Approve</Button>
            <Button variant="outline" onClick={() => void decide("REJECTED")} disabled={!!busy || reason.trim().length < 3}>{busy === "REJECTED" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <XCircle aria-hidden="true" />}Reject</Button>
          </div>
        </div>
      : <p className="text-sm text-muted-foreground">{row.selfApproval ? "This workflow runs as you, so another owner or administrator must decide." : "Only owners and administrators can decide this approval."}</p>)}
  </li>;
}

export function ApprovalsView({organizationId}: {organizationId: string}) {
  const [view, setView] = useState<"pending" | "history">("pending");
  const [data, setData] = useState<Approvals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => automationsGet<Approvals>(`/api/approvals?view=${view}`, "Approvals could not be loaded.")
    .then(rows => { setData(rows); setError(null); }, cause => setError(errorMessage(cause, "Approvals could not be loaded."))), [view]);
  useEffect(() => { void load(); }, [load]);

  if (error && !data) return <EmptyState icon={AlertTriangle} title="Approvals could not be loaded" description={error}><Button variant="outline" onClick={() => void load()}>Try again</Button></EmptyState>;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div role="tablist" aria-label="Approvals" className="inline-flex rounded-lg border bg-muted/40 p-1">
        {(["pending", "history"] as const).map(tab => <button key={tab} role="tab" type="button" aria-selected={view === tab} onClick={() => { setData(null); setView(tab); }}
          className={`rounded-md px-3 py-1.5 text-sm ${view === tab ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}>{tab === "pending" ? "Pending" : "History"}</button>)}
      </div>
      <Button size="sm" variant="ghost" onClick={() => void load()}><RefreshCw aria-hidden="true" />Refresh</Button>
    </div>
    {!data ? <PageSkeleton />
      : data.approvals.length === 0
        ? <div className="rounded-xl border bg-card"><EmptyState icon={ShieldCheck} title={view === "pending" ? "Nothing waiting" : "No decisions yet"} description={view === "pending" ? "Workflow steps that need a decision, such as lead reassignments, appear here." : "Approved, rejected and expired requests appear here."} /></div>
        : <ul className="space-y-3">{data.approvals.map(row => <ApprovalCard key={row.id} row={row} organizationId={organizationId} onDecided={() => void load()} />)}</ul>}
  </div>;
}
