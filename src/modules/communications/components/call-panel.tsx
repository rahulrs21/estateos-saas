"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { CalendarClock, Loader2, Pencil, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatLeadDate, fromDubaiDateTimeInput, LeadField, LeadFormMessage, selectClassName, textareaClassName, toDubaiDateTimeInput } from "@/modules/leads/components/lead-ui";
import { communicationsGet, communicationsSend, errorMessage, formatDuration, type CallHistoryView, type CallView } from "../client";
import {
  CALL_DIRECTION_LABELS, CALL_OUTCOME_LABELS, CALL_OUTCOMES, CALL_STATUS_LABELS, CALL_TYPE_LABELS, CALL_TYPES, MANUAL_CALL_STATUSES,
  type CallDirection, type CallOutcome, type CallType, type ManualCallStatus,
} from "../model";

type Subject = {kind: "LEAD" | "CONTACT"; id: string};
type Issue = {code: string; message: string};
type LogResult = {call: CallView; duplicate: boolean; issues: Issue[]; followUp: {scheduled: boolean; error: string | null}};

const historyPath = (subject: Subject, offset = 0) => `/api/communications/${subject.kind === "LEAD" ? "leads" : "contacts"}/${subject.id}/calls${offset ? `?offset=${offset}` : ""}`;

function CallIcon({call}: {call: CallView}) {
  const Icon = !call.answered ? PhoneMissed : call.direction === "INBOUND" ? PhoneIncoming : PhoneOutgoing;
  return <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground"><Icon className="size-3.5" aria-hidden="true" /></span>;
}

function LogCallDialog({subject, organizationId, view, onLogged}: {subject: Subject; organizationId: string; view: CallHistoryView; onLogged: (result: LogResult) => void}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [direction, setDirection] = useState<CallDirection>("OUTBOUND");
  const [status, setStatus] = useState<ManualCallStatus>("COMPLETED");
  const [followUp, setFollowUp] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const answered = status === "COMPLETED";
  const isLead = subject.kind === "LEAD";

  function openChange(value: boolean) {
    if (pending) return;
    setOpen(value); setError("");
    if (value) { setRequestId(crypto.randomUUID()); setDirection("OUTBOUND"); setStatus("COMPLETED"); setFollowUp(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const startedAt = fromDubaiDateTimeInput(value("startedAt"));
    if (!startedAt) { setError("Enter when the call started."); return; }
    const durationSeconds = answered ? Number(value("minutes") || 0) * 60 + Number(value("seconds") || 0) : 0;
    if (!Number.isInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > 14_400) { setError("Enter a duration of up to 4 hours."); return; }
    const followUpAt = isLead && followUp && value("followUpAt") ? fromDubaiDateTimeInput(value("followUpAt")) : null;
    setPending(true);
    try {
      const result = await communicationsSend<LogResult>("/api/communications/calls", organizationId, "POST", {
        requestId, ...(isLead ? {leadId: subject.id} : {contactId: subject.id}),
        direction, callType: value("callType"), callStatus: status, outcome: answered && value("outcome") ? value("outcome") : null,
        startedAt, durationSeconds, notes: value("notes") || null, number: value("number") || "PRIMARY",
        followUpRequired: followUp, followUpAt, followUpTitle: followUpAt ? value("followUpTitle") || null : null,
        viewingId: isLead && value("viewingId") ? value("viewingId") : null,
      }, "The call could not be logged.");
      setOpen(false);
      onLogged(result);
    } catch (problem) { setError(errorMessage(problem, "The call could not be logged.")); }
    finally { setPending(false); }
  }

  return <Dialog open={open} onOpenChange={openChange}>
    <DialogTrigger render={<Button variant="outline" size="sm" disabled={view.subject.archived} />}><Phone aria-hidden="true" />Log a call</DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Log a call</DialogTitle><DialogDescription>Record a call you made or took through your company&apos;s approved phone service. Times are in Dubai.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <LeadField id={`${prefix}-direction`} label="Direction"><select id={`${prefix}-direction`} name="direction" className={selectClassName} value={direction} onChange={event => setDirection(event.target.value as CallDirection)}>
            <option value="OUTBOUND">{CALL_DIRECTION_LABELS.OUTBOUND}</option><option value="INBOUND">{CALL_DIRECTION_LABELS.INBOUND}</option></select></LeadField>
          <LeadField id={`${prefix}-type`} label="Purpose"><select id={`${prefix}-type`} name="callType" className={selectClassName} key={direction} defaultValue={direction === "INBOUND" ? "INBOUND_ENQUIRY" : "FOLLOW_UP"}>
            {CALL_TYPES.filter(type => direction === "OUTBOUND" ? type !== "INBOUND_ENQUIRY" : type !== "MARKETING").map((type: CallType) => <option key={type} value={type}>{CALL_TYPE_LABELS[type]}</option>)}</select></LeadField>
          <LeadField id={`${prefix}-status`} label="What happened"><select id={`${prefix}-status`} name="callStatus" className={selectClassName} value={status} onChange={event => setStatus(event.target.value as ManualCallStatus)}>
            {MANUAL_CALL_STATUSES.map(item => <option key={item} value={item}>{CALL_STATUS_LABELS[item]}</option>)}</select></LeadField>
          <LeadField id={`${prefix}-number`} label="Number used">{view.numbers.length ? <select id={`${prefix}-number`} name="number" className={selectClassName}>
            {view.numbers.map(item => <option key={item.choice} value={item.choice}>{item.number}{item.choice === "ALTERNATE" ? " (alternate)" : ""}</option>)}</select>
            : <p className="text-xs leading-5 text-muted-foreground">No valid number on record.</p>}</LeadField>
          <LeadField id={`${prefix}-started`} label="Started (Dubai time)"><Input id={`${prefix}-started`} name="startedAt" type="datetime-local" required defaultValue={toDubaiDateTimeInput(new Date().toISOString())} /></LeadField>
          {answered && <div className="space-y-2"><span className="text-xs font-medium">Duration</span><div className="flex items-center gap-2">
            <Input aria-label="Minutes" name="minutes" type="number" min={0} max={240} defaultValue={0} /><span className="text-xs text-muted-foreground">min</span>
            <Input aria-label="Seconds" name="seconds" type="number" min={0} max={59} defaultValue={0} /><span className="text-xs text-muted-foreground">s</span></div></div>}
        </div>
        {answered && <LeadField id={`${prefix}-outcome`} label="Outcome" hint="What the customer said. Asking not to be called, rejecting an offer or a wrong number adds the number to the do-not-call list.">
          <select id={`${prefix}-outcome`} name="outcome" className={selectClassName} defaultValue=""><option value="">Not recorded</option>
            {CALL_OUTCOMES.map((outcome: CallOutcome) => <option key={outcome} value={outcome}>{CALL_OUTCOME_LABELS[outcome]}</option>)}</select></LeadField>}
        <LeadField id={`${prefix}-notes`} label="Notes"><textarea id={`${prefix}-notes`} name="notes" maxLength={4000} className={textareaClassName} placeholder="What was discussed and agreed." /></LeadField>
        {isLead && view.viewings.length > 0 && <LeadField id={`${prefix}-viewing`} label="Related viewing"><select id={`${prefix}-viewing`} name="viewingId" className={selectClassName} defaultValue="">
          <option value="">None</option>{view.viewings.map(viewing => <option key={viewing.id} value={viewing.id}>{formatLeadDate(viewing.scheduledAt, true)} ({viewing.status.toLowerCase()})</option>)}</select></LeadField>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="followUpRequired" checked={followUp} onChange={event => setFollowUp(event.target.checked)} className="size-4" />Follow-up needed</label>
        {isLead && followUp && <div className="grid gap-4 sm:grid-cols-2">
          <LeadField id={`${prefix}-follow-at`} label="Schedule it for (optional)"><Input id={`${prefix}-follow-at`} name="followUpAt" type="datetime-local" /></LeadField>
          <LeadField id={`${prefix}-follow-title`} label="Follow-up title"><Input id={`${prefix}-follow-title`} name="followUpTitle" maxLength={500} placeholder="Follow up after call" /></LeadField>
        </div>}
        <Button type="submit">{pending ? <><Loader2 className="animate-spin" aria-hidden="true" />Saving…</> : "Save call"}</Button>
      </fieldset><LeadFormMessage message={error} /></form>
    </DialogContent>
  </Dialog>;
}

type DialResult = {started: boolean; callId?: string; reasons?: Issue[]};

/** Starts a live call through the company's verified provider: the agent's phone rings first, then the customer's. */
function LiveCallDialog({leadId, organizationId, view, onStarted}: {leadId: string; organizationId: string; view: CallHistoryView; onStarted: () => void}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [reasons, setReasons] = useState<Issue[]>([]);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setReasons([]);
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const result = await communicationsSend<DialResult>("/api/communications/calls/dial", organizationId, "POST", {requestId, leadId, number: String(form.get("number") ?? "PRIMARY"), callType: String(form.get("callType") ?? "FOLLOW_UP")}, "The call could not be started.");
      if (result.started) { setOpen(false); toast.success("Calling: your phone rings first, then the customer's."); onStarted(); }
      else setReasons(result.reasons ?? []);
    } catch (problem) { setReasons([{code: "ERROR", message: errorMessage(problem, "The call could not be started.")}]); }
    finally { setPending(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!pending) { setOpen(value); setReasons([]); if (value) setRequestId(crypto.randomUUID()); } }}>
    <DialogTrigger render={<Button size="sm" />}><Phone aria-hidden="true" />Call</DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Call {view.subject.name}</DialogTitle><DialogDescription>EstateOS rings your phone from your company line, then connects the customer. The call is not recorded.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4">
        <LeadField id={`${prefix}-number`} label="Number"><select id={`${prefix}-number`} name="number" className={selectClassName}>{view.numbers.filter(item => !item.doNotCall).map(item => <option key={item.choice} value={item.choice}>{item.number}</option>)}</select></LeadField>
        <LeadField id={`${prefix}-type`} label="Purpose"><select id={`${prefix}-type`} name="callType" className={selectClassName} defaultValue="FOLLOW_UP">
          {(["FOLLOW_UP", "SERVICE", "MARKETING"] as const).map(type => <option key={type} value={type}>{CALL_TYPE_LABELS[type]}</option>)}</select></LeadField>
        <Button type="submit">{pending ? <><Loader2 className="animate-spin" aria-hidden="true" />Starting…</> : "Start call"}</Button>
      </fieldset>
      {reasons.length > 0 && <div role="alert" className="mt-3 space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"><p className="font-medium">The call was not started:</p><ul className="list-disc pl-5">{reasons.map(item => <li key={item.code}>{item.message}</li>)}</ul></div>}</form>
    </DialogContent>
  </Dialog>;
}

export function EditCallDialog({call, organizationId, onSaved}: {call: CallView; organizationId: string; onSaved: () => void}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await communicationsSend(`/api/communications/calls/${call.id}`, organizationId, "PUT", {
        expectedRevision: call.revision, outcome: call.answered && form.get("outcome") ? String(form.get("outcome")) : null,
        notes: String(form.get("notes") ?? "").trim() || null, followUpRequired: form.get("followUpRequired") === "on",
      }, "The call could not be updated.");
      setOpen(false); toast.success("Call updated."); onSaved();
    } catch (problem) { setError(errorMessage(problem, "The call could not be updated.")); }
    finally { setPending(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!pending) { setOpen(value); setError(""); } }}>
    <DialogTrigger render={<Button variant="ghost" size="sm" aria-label={`Edit the call on ${formatLeadDate(call.startedAt, true)}`} />}><Pencil aria-hidden="true" />Edit</DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Edit call</DialogTitle><DialogDescription>The connection status stays as recorded; you can change the outcome and notes.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4">
        {call.answered && <LeadField id={`${prefix}-outcome`} label="Outcome"><select id={`${prefix}-outcome`} name="outcome" className={selectClassName} defaultValue={call.outcome ?? ""}>
          <option value="">Not recorded</option>{CALL_OUTCOMES.map(outcome => <option key={outcome} value={outcome}>{CALL_OUTCOME_LABELS[outcome]}</option>)}</select></LeadField>}
        <LeadField id={`${prefix}-notes`} label="Notes"><textarea id={`${prefix}-notes`} name="notes" maxLength={4000} className={textareaClassName} defaultValue={call.notes ?? ""} /></LeadField>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="followUpRequired" defaultChecked={call.followUpRequired} className="size-4" />Follow-up needed</label>
        <Button type="submit">{pending ? "Saving…" : "Save"}</Button>
      </fieldset><LeadFormMessage message={error} /></form>
    </DialogContent>
  </Dialog>;
}

export function CallItem({call, organizationId, showLead, onChanged}: {call: CallView; organizationId: string; showLead: boolean; onChanged: () => void}) {
  return <li className="flex gap-3 rounded-lg border p-4">
    <CallIcon call={call} />
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{CALL_DIRECTION_LABELS[call.direction]} · {CALL_STATUS_LABELS[call.callStatus]}{call.answered && call.durationSeconds > 0 && <span className="font-normal text-muted-foreground"> · {formatDuration(call.durationSeconds)}</span>}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {call.outcome && <Badge variant="secondary">{CALL_OUTCOME_LABELS[call.outcome]}</Badge>}
          {call.source === "MANUAL" && <Badge variant="outline">Logged manually</Badge>}
          {call.canEdit && <EditCallDialog call={call} organizationId={organizationId} onSaved={onChanged} />}
          <Link href={`/communications/calls/${call.id}`} className={buttonVariants({variant: "ghost", size: "sm"})} aria-label={`Details of the call on ${formatLeadDate(call.startedAt, true)}`}>Details</Link>
        </div>
      </div>
      <p className="text-xs text-muted-foreground"><time dateTime={call.startedAt}>{formatLeadDate(call.startedAt, true)}</time> · {call.agent} · {CALL_TYPE_LABELS[call.callType]}{call.number && <> · {call.number}</>}{showLead && call.lead && <> · Lead: {call.lead.fullName}</>}{showLead && !call.lead && call.contact && <> · Contact: {call.contact.fullName}</>}</p>
      {call.notes && <p className="whitespace-pre-wrap break-words rounded-lg bg-muted/30 px-3 py-2 text-sm leading-6">{call.notes}</p>}
      {call.followUp ? <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock className="size-3.5" aria-hidden="true" />Follow-up: {call.followUp.title}, due {formatLeadDate(call.followUp.dueAt, true)} ({call.followUp.status.toLowerCase()})</p>
        : call.followUpRequired && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Follow-up needed (not scheduled)</p>}
      {call.viewing && <p className="text-xs text-muted-foreground">Related viewing: {formatLeadDate(call.viewing.scheduledAt, true)} ({call.viewing.status.toLowerCase()})</p>}
    </div>
  </li>;
}

/**
 * Calls for a lead or contact: the numbers on record and whether they may be
 * called, the live-call button (disabled with the reason until a provider is
 * verified and approved), manual logging and the authorized call history.
 */
export function CallPanel({subject, organizationId}: {subject: Subject; organizationId: string}) {
  const [view, setView] = useState<CallHistoryView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [warnings, setWarnings] = useState<Issue[]>([]);
  const descriptionId = useId();
  const {kind, id} = subject;

  const load = useCallback((at = 0) => communicationsGet<CallHistoryView>(historyPath({kind, id}, at), "Calls could not be loaded.")
    .then(result => { setView(result); setOffset(at); setLoadError(null); }, problem => setLoadError(errorMessage(problem, "Calls could not be loaded."))), [kind, id]);
  useEffect(() => { void load(0); }, [load]);

  function logged(result: LogResult) {
    setWarnings(result.issues);
    if (result.duplicate) toast.info("This call was already logged.");
    else toast.success(result.issues.length ? "Call logged with compliance warnings." : "Call logged.");
    if (result.followUp.error) toast.error(`The call was logged, but the follow-up was not scheduled: ${result.followUp.error}`);
    void load(0);
  }

  const header = <CardHeader className="px-5 sm:px-6"><div className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>Calls</CardTitle></div>
    <CardDescription>Calls with this customer, most recent first. Times are in Dubai.</CardDescription></CardHeader>;
  if (loadError) return <Card id="calls" className="scroll-mt-24 gap-4 py-5 shadow-xs ring-border">{header}<CardContent className="space-y-3 px-5 sm:px-6"><p role="alert" className="text-sm text-destructive">{loadError}</p><Button variant="outline" size="sm" onClick={() => void load(offset)}><RefreshCw aria-hidden="true" />Try again</Button></CardContent></Card>;
  if (!view) return <div id="calls" role="status" className="animate-pulse rounded-xl border p-6 text-sm text-muted-foreground">Loading calls...</div>;

  return <Card id="calls" className="scroll-mt-24 gap-4 py-5 shadow-xs ring-border">{header}
    <CardContent className="space-y-5 px-5 sm:px-6">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="space-y-2">
          {view.numbers.length ? <ul className="space-y-1.5" aria-label="Numbers on record">{view.numbers.map(item => <li key={item.choice} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{item.number}</span>{item.choice === "ALTERNATE" && <span className="text-xs text-muted-foreground">Alternate</span>}
            {item.doNotCall && <Badge variant="destructive">Do not call</Badge>}{!item.doNotCall && item.noMarketing && <Badge variant="secondary">No marketing calls</Badge>}
          </li>)}</ul> : <p className="text-sm text-muted-foreground">No valid phone number on record. Add one with its country code to call this customer.</p>}
          <p className="text-xs leading-5 text-muted-foreground">Last answered call: {view.lastAnsweredAt ? formatLeadDate(view.lastAnsweredAt, true) : "none yet"} · {view.total} {view.total === 1 ? "call" : "calls"} recorded</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {view.liveCalling.available && subject.kind === "LEAD" ? <LiveCallDialog leadId={subject.id} organizationId={organizationId} view={view} onStarted={() => void load(0)} />
            : <Button size="sm" disabled aria-describedby={descriptionId}><Phone aria-hidden="true" />Call</Button>}
          <LogCallDialog subject={subject} organizationId={organizationId} view={view} onLogged={logged} />
        </div>
      </div>
      {!view.liveCalling.available && <div id={descriptionId} className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground"><ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div><p>{view.liveCalling.reason} Log calls you make through your company&apos;s approved phone service instead.</p>
          {view.liveCalling.reasons.length > 1 && <ul className="mt-1 list-disc pl-4">{view.liveCalling.reasons.slice(1).map(item => <li key={item.code}>{item.message}</li>)}</ul>}</div></div>}
      <p className="text-xs leading-5 text-muted-foreground">Company calling hours {view.rules.callingHours} ({view.rules.timeZone}). Marketing calls: {view.rules.telemarketingEnabled ? `allowed ${view.rules.marketingHours}` : "not enabled for your company"}. {view.rules.recordingEnabled ? "Recordings can be added to a call after the customer's notice or consent is recorded." : "Calls are not recorded."}</p>
      {warnings.length > 0 && <div role="status" className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-5 text-amber-800 dark:text-amber-200">
        <p className="font-medium">The call you logged breaks company calling rules. It was saved, and administrators can review it:</p>
        <ul className="list-disc pl-5">{warnings.map(issue => <li key={issue.code}>{issue.message}</li>)}</ul></div>}
      {view.calls.length ? <ol className="space-y-3" aria-label="Call history">{view.calls.map(call => <CallItem key={call.id} call={call} organizationId={organizationId} showLead={subject.kind === "CONTACT"} onChanged={() => void load(offset)} />)}</ol>
        : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{offset ? "No more calls." : "No calls recorded yet. Log calls you make or take so the team sees the full history."}</p>}
      {(offset > 0 || view.hasMore) && <nav aria-label="Call history pages" className="flex justify-between gap-2">
        <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => void load(Math.max(0, offset - 20))}>Newer</Button>
        <Button variant="outline" size="sm" disabled={!view.hasMore} onClick={() => void load(offset + 20)}>Older</Button></nav>}
    </CardContent>
  </Card>;
}
