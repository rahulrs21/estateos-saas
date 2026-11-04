"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, PhoneOff, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLeadDate } from "@/modules/leads/components/lead-ui";
import { isFinal } from "../call-state";
import { communicationsGet, communicationsSend, errorMessage, formatDuration } from "../client";
import { CALL_DIRECTION_LABELS, CALL_OUTCOME_LABELS, CALL_STATUS_LABELS, CALL_TYPE_LABELS, type CallStatus } from "../model";
import type { getCall } from "../server/calls";
import { CallMediaPanel } from "./call-media-panel";
import { CallSummaryPanel } from "./call-summary-panel";
import { EditCallDialog } from "./call-panel";

type CallDetailView = Awaited<ReturnType<typeof getCall>>;

function Fact({label, children}: {label: string; children?: ReactNode}) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1.5 break-words text-sm font-medium">{children || <span className="font-normal text-muted-foreground">Not recorded</span>}</dd></div>;
}

const RESULT_LABELS: Record<string, string> = {
  APPLIED: "Applied", NO_CHANGE: "No change (repeat)", FINAL: "Ignored: the call had already ended", OUT_OF_ORDER: "Ignored: arrived late",
  NOT_ALLOWED: "Ignored: not a valid next state", UNMATCHED: "No matching call", NOT_ELIGIBLE: "Not used: EstateOS does not take recordings or transcripts from providers", DEFERRED: "Not used", IGNORED: "Ignored", RECEIVED: "Received",
};

export function CallDetail({callId, organizationId}: {callId: string; organizationId: string}) {
  const [call, setCall] = useState<CallDetailView | null>(null);
  const [error, setError] = useState<{message: string; notFound: boolean} | null>(null);
  const [ending, setEnding] = useState(false);
  const load = useCallback(() => communicationsGet<CallDetailView>(`/api/communications/calls/${callId}`, "The call could not be loaded.")
    .then(result => { setCall(result); setError(null); }, problem => setError({message: errorMessage(problem, "The call could not be loaded."), notFound: (problem as {status?: number})?.status === 404})), [callId]);
  useEffect(() => { void load(); }, [load]);

  async function hangUp() {
    setEnding(true);
    try { await communicationsSend(`/api/communications/calls/${callId}/end`, organizationId, "POST", {}, "The call could not be ended."); toast.success("Hang-up requested. The provider will report when the call ends."); }
    catch (problem) { toast.error(errorMessage(problem, "The call could not be ended.")); }
    finally { setEnding(false); void load(); }
  }

  const back = <Link href="/communications/calls" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" aria-hidden="true" />All calls</Link>;
  if (error) return <div className="space-y-4">{back}<div role="alert" className="space-y-3 rounded-xl border p-6"><p className="text-sm">{error.notFound ? "This call was not found, or you do not have access to it." : error.message}</p>{!error.notFound && <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw aria-hidden="true" />Try again</Button>}</div></div>;
  if (!call) return <div role="status" className="animate-pulse rounded-xl border p-6 text-sm text-muted-foreground">Loading call...</div>;

  const who = call.lead?.fullName ?? call.contact?.fullName ?? call.number ?? "Unknown caller";
  const live = call.source === "PROVIDER" && !isFinal(call.callStatus as CallStatus);
  return <div className="space-y-5">
    {back}
    <PageHeader eyebrow={`${CALL_DIRECTION_LABELS[call.direction]} call`} title={who} description={`${CALL_STATUS_LABELS[call.callStatus]} · ${formatLeadDate(call.startedAt, true)} (Dubai)`}>
      {call.canEdit && <EditCallDialog call={call} organizationId={organizationId} onSaved={() => void load()} />}
      {live && call.canEdit && <Button variant="destructive" size="sm" disabled={ending} onClick={() => void hangUp()}><PhoneOff aria-hidden="true" />Hang up</Button>}
    </PageHeader>
    <div className="flex flex-wrap gap-2">
      <Badge variant={call.source === "SIMULATED" ? "destructive" : "outline"}>{call.source === "MANUAL" ? "Logged manually" : call.source === "SIMULATED" ? "SIMULATED (developer test, not a real call)" : `Reported by ${call.provider?.name ?? "the calling provider"}`}</Badge>
      {call.outcome && <Badge variant="secondary">{CALL_OUTCOME_LABELS[call.outcome]}</Badge>}
      {call.answered ? <Badge variant="outline">Answered</Badge> : <Badge variant="outline">Not answered</Badge>}
      {call.conversation && <Badge variant="outline">Conversation recorded</Badge>}
    </div>
    {call.issues.length > 0 && <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200"><ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div><p className="font-medium">This call broke company calling rules</p><ul className="mt-1 list-disc pl-5 text-xs leading-5">{call.issues.map(issue => <li key={issue.code}>{issue.message}</li>)}</ul></div></div>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><CardTitle role="heading" aria-level={2}>Call</CardTitle></CardHeader><CardContent className="px-5"><dl className="grid gap-5 sm:grid-cols-2">
          <Fact label="Customer">{call.lead ? <Link className="text-primary hover:underline" href={`/leads/${call.lead.id}`}>{call.lead.fullName} (lead)</Link> : call.contact ? <Link className="text-primary hover:underline" href={`/contacts/${call.contact.id}`}>{call.contact.fullName} (contact)</Link> : null}</Fact>
          <Fact label="Customer number">{call.number}</Fact>
          <Fact label="Agent">{call.agent}</Fact>
          <Fact label="Purpose">{CALL_TYPE_LABELS[call.callType]}</Fact>
          <Fact label="Started (Dubai)">{formatLeadDate(call.startedAt, true)}</Fact>
          <Fact label="Answered">{call.answeredAt ? formatLeadDate(call.answeredAt, true) : null}</Fact>
          <Fact label="Ended">{call.endedAt ? formatLeadDate(call.endedAt, true) : null}</Fact>
          <Fact label="Duration">{call.answered && call.durationSeconds > 0 ? formatDuration(call.durationSeconds) : null}</Fact>
          {call.line && <Fact label="Company line">{call.line.name ? `${call.line.name} (${call.line.number})` : call.line.number}</Fact>}
        </dl></CardContent></Card>
        <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><CardTitle role="heading" aria-level={2}>Notes</CardTitle><CardDescription>What the agent recorded.</CardDescription></CardHeader>
          <CardContent className="px-5">{call.notes ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{call.notes}</p> : <p className="text-sm text-muted-foreground">No notes.</p>}</CardContent></Card>
        <CallMediaPanel callId={call.id} organizationId={organizationId} />
        <CallSummaryPanel callId={call.id} organizationId={organizationId} />
        {call.events.length > 0 && <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><CardTitle role="heading" aria-level={2}>Provider events</CardTitle><CardDescription>Signed status updates from the provider, in the order received. Repeats and late updates never change a call.</CardDescription></CardHeader>
          <CardContent className="px-5"><ol className="space-y-2">{call.events.map(event => <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm last:border-0">
            <span>{event.callStatus ? CALL_STATUS_LABELS[event.callStatus as CallStatus] : event.eventType.toLowerCase()} <span className="text-xs text-muted-foreground">· {RESULT_LABELS[event.result] ?? event.result}</span></span>
            <time dateTime={event.receivedAt} className="text-xs text-muted-foreground">{formatLeadDate(event.receivedAt, true)}</time></li>)}</ol></CardContent></Card>}
      </div>
      <aside className="space-y-5" aria-label="Follow-up and viewing">
        <Card className="gap-3 py-5 shadow-xs ring-border"><CardHeader className="px-5"><CardTitle role="heading" aria-level={2}>Follow-up</CardTitle></CardHeader><CardContent className="px-5 text-sm">
          {call.followUp ? <p>{call.followUp.title}<br /><span className="text-xs text-muted-foreground">Due {formatLeadDate(call.followUp.dueAt, true)} · {call.followUp.status.toLowerCase()}</span></p>
            : call.followUpRequired ? <p className="font-medium text-amber-700 dark:text-amber-300">Follow-up needed, not scheduled yet.{call.lead && <> <Link className="text-primary hover:underline" href={`/leads/${call.lead.id}#follow-up-history`}>Schedule it on the lead</Link></>}</p>
            : <p className="text-muted-foreground">No follow-up needed.</p>}
        </CardContent></Card>
        {call.viewing && <Card className="gap-3 py-5 shadow-xs ring-border"><CardHeader className="px-5"><CardTitle role="heading" aria-level={2}>Related viewing</CardTitle></CardHeader><CardContent className="px-5 text-sm">{formatLeadDate(call.viewing.scheduledAt, true)} · {call.viewing.status.toLowerCase()}</CardContent></Card>}
      </aside>
    </div>
  </div>;
}
