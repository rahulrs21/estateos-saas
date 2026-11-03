"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { CalendarClock, ExternalLink, Loader2, Plus, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { aiContentHref } from "@/modules/ai/content/components/ai-content-link";
import { formatLeadDate, fromDubaiDateTimeInput, LeadField, LeadFormMessage, selectClassName, textareaClassName, toDubaiDateTimeInput } from "@/modules/leads/components/lead-ui";
import { communicationsGet, communicationsSend, errorMessage } from "../client";
import { SUGGESTION_LABELS, type SuggestionKind } from "../intelligence";
import { MEETING_PROVIDERS, MEETING_PROVIDER_LABELS, MEETING_STATUS_LABELS, needsLink, type MeetingProvider, type MeetingStatus } from "../meetings";
import type { MeetingListView, MeetingView } from "../server/meetings";
import { AcceptFollowUp, SUMMARY_CONFIDENCE, SummarySections } from "./call-summary-panel";

type Option = {id: string; name: string};
const FOLLOW_UP_KINDS = ["FOLLOW_UP", "CLARIFY_BUDGET", "SHARE_PAYMENT_PLAN", "ALTERNATIVE_PROPERTY"];
const DURATIONS = [15, 30, 45, 60, 90, 120];
const statusVariant = (status: string) => status === "COMPLETED" ? "secondary" as const : status === "SCHEDULED" ? "outline" as const : "destructive" as const;

/** The meeting's fields; values are read from the form when it is submitted. */
function MeetingFields({prefix, meeting, attendees, selected, startDefault}: {prefix: string; meeting?: MeetingView; attendees: Option[]; selected: string[]; startDefault: string}) {
  const [provider, setProvider] = useState<MeetingProvider>((meeting?.provider as MeetingProvider) ?? "GOOGLE_MEET");
  const duration = meeting ? Math.round((Date.parse(meeting.endsAt) - Date.parse(meeting.startsAt)) / 60_000) : 30;
  return <>
    <LeadField id={`${prefix}-title`} label="Title"><Input id={`${prefix}-title`} name="title" required maxLength={160} defaultValue={meeting?.title ?? "Property consultation"} /></LeadField>
    <div className="grid gap-4 sm:grid-cols-2">
      <LeadField id={`${prefix}-provider`} label="Meeting type"><select id={`${prefix}-provider`} name="provider" className={selectClassName} value={provider} onChange={event => setProvider(event.target.value as MeetingProvider)}>
        {MEETING_PROVIDERS.map(value => <option key={value} value={value}>{MEETING_PROVIDER_LABELS[value]}</option>)}</select></LeadField>
      {needsLink(provider) ? <LeadField id={`${prefix}-url`} label="Meeting link (https)"><Input id={`${prefix}-url`} name="meetingUrl" type="url" required maxLength={490} placeholder="https://" defaultValue={meeting?.meetingUrl ?? ""} /></LeadField>
        : <LeadField id={`${prefix}-location`} label={provider === "PHONE" ? "Phone details (optional)" : "Location (optional)"}><Input id={`${prefix}-location`} name="location" maxLength={200} defaultValue={meeting?.location ?? ""} /></LeadField>}
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <LeadField id={`${prefix}-start`} label="Starts (Dubai time)"><Input id={`${prefix}-start`} name="startsAt" type="datetime-local" required defaultValue={meeting ? toDubaiDateTimeInput(meeting.startsAt) : startDefault} key={startDefault} /></LeadField>
      <LeadField id={`${prefix}-duration`} label="Duration"><select id={`${prefix}-duration`} name="duration" className={selectClassName} defaultValue={String(DURATIONS.includes(duration) ? duration : 30)}>
        {DURATIONS.map(value => <option key={value} value={value}>{value < 60 ? `${value} minutes` : `${value / 60} hour${value > 60 ? "s" : ""}`}</option>)}</select></LeadField>
    </div>
    <LeadField id={`${prefix}-agenda`} label="Agenda (optional)"><textarea id={`${prefix}-agenda`} name="agenda" className={textareaClassName} maxLength={2000} defaultValue={meeting?.agenda ?? ""} /></LeadField>
    {attendees.length > 0 && <fieldset className="space-y-1.5"><legend className="text-sm font-medium">Colleagues to invite</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">{attendees.map(option => <label key={option.id} className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="attendeeIds" value={option.id} defaultChecked={selected.includes(option.id)} className="size-4 accent-primary" />{option.name}</label>)}</div>
    </fieldset>}
    <p className="text-xs text-muted-foreground">EstateOS stores the meeting and its link; the video call opens in the provider&apos;s own app.</p>
  </>;
}

function detailsFrom(form: FormData) {
  const start = fromDubaiDateTimeInput(String(form.get("startsAt") ?? ""));
  const minutes = Number(form.get("duration") ?? 30);
  const provider = String(form.get("provider")) as MeetingProvider;
  return {
    title: String(form.get("title") ?? "").trim(), provider, meetingUrl: needsLink(provider) ? String(form.get("meetingUrl") ?? "").trim() || null : null,
    location: needsLink(provider) ? null : String(form.get("location") ?? "").trim() || null,
    startsAt: start, endsAt: start ? new Date(Date.parse(start) + minutes * 60_000).toISOString() : start, agenda: String(form.get("agenda") ?? "").trim() || null,
  };
}

function ScheduleMeeting({subject, organizationId, onDone}: {subject: {kind: "LEAD" | "CONTACT"; id: string}; organizationId: string; onDone: () => void}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [attendees, setAttendees] = useState<Option[]>([]);
  const [startDefault, setStartDefault] = useState("");
  const [requestId, setRequestId] = useState("");
  function openChange(value: boolean) {
    if (pending) return;
    setOpen(value); setError("");
    if (!value) return;
    setRequestId(crypto.randomUUID());
    // Tomorrow at the next hour, set when the dialog opens (not during render).
    const next = new Date(Date.now() + 86_400_000); next.setUTCMinutes(0, 0, 0);
    setStartDefault(toDubaiDateTimeInput(next.toISOString()));
    communicationsGet<Option[]>("/api/communications/meetings/attendees").then(setAttendees, () => setAttendees([]));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await communicationsSend("/api/communications/meetings", organizationId, "POST", {
        requestId, ...(subject.kind === "LEAD" ? {leadId: subject.id} : {contactId: subject.id}), attendeeIds: form.getAll("attendeeIds").map(String), details: detailsFrom(form),
      }, "The meeting could not be scheduled.");
      setOpen(false); toast.success("Meeting scheduled."); onDone();
    } catch (problem) { setError(errorMessage(problem, "The meeting could not be scheduled.")); }
    finally { setPending(false); }
  }
  return <Dialog open={open} onOpenChange={openChange}>
    <DialogTrigger render={<Button size="sm" variant="outline" />}><Plus aria-hidden />Schedule meeting</DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Schedule a meeting</DialogTitle><DialogDescription>Nothing is sent to the customer; share the link with them yourself.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4">
        <MeetingFields prefix={prefix} attendees={attendees} selected={[]} startDefault={startDefault} />
        <Button type="submit">{pending ? "Scheduling…" : "Schedule"}</Button>
      </fieldset><LeadFormMessage message={error} /></form>
    </DialogContent>
  </Dialog>;
}

function MeetingRow({meeting}: {meeting: MeetingListView["meetings"][number]}) {
  const who = meeting.lead?.fullName ?? meeting.contact?.fullName ?? "Customer";
  return <li><Link href={`/communications/meetings/${meeting.id}`} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted/50">
    <CalendarClock aria-hidden className="size-4 text-muted-foreground" />
    <span className="font-medium">{meeting.title}</span>
    <span className="text-muted-foreground">{who} · {formatLeadDate(meeting.startsAt, true)} · {MEETING_PROVIDER_LABELS[meeting.provider as MeetingProvider]} · {meeting.organizerMembership.userProfile?.displayName ?? "Organizer"}</span>
    <Badge variant={statusVariant(meeting.status)} className="ml-auto">{MEETING_STATUS_LABELS[meeting.status as MeetingStatus]}</Badge>
  </Link></li>;
}

/** Meetings on a lead or contact page, with scheduling. */
export function MeetingPanel({subject, organizationId}: {subject: {kind: "LEAD" | "CONTACT"; id: string}; organizationId: string}) {
  const [view, setView] = useState<MeetingListView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = subject.kind === "LEAD" ? `leadId=${subject.id}` : `contactId=${subject.id}`;
  const load = useCallback(() => communicationsGet<MeetingListView>(`/api/communications/meetings?when=ALL&${query}`, "Meetings could not be loaded.")
    .then(result => { setView(result); setError(null); }, problem => setError(errorMessage(problem, "Meetings could not be loaded."))), [query]);
  useEffect(() => { void load(); }, [load]);
  return <Card id="meetings" className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1">
    <CardTitle role="heading" aria-level={2}>Meetings</CardTitle><CardDescription>Video, phone and in-person meetings. Links open in the provider&apos;s app.</CardDescription></div>
    <ScheduleMeeting subject={subject} organizationId={organizationId} onDone={() => void load()} /></div></CardHeader>
    <CardContent className="px-5">
      {error ? <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw aria-hidden />Try again</Button></div>
        : !view ? <p role="status" className="text-sm text-muted-foreground">Loading meetings…</p>
        : view.meetings.length ? <ul className="divide-y rounded-md border" aria-label="Meetings">{view.meetings.map(meeting => <MeetingRow key={meeting.id} meeting={meeting} />)}</ul>
        : <p className="text-sm text-muted-foreground">No meetings yet.</p>}
    </CardContent></Card>;
}

/** The hub's meeting list. */
export function MeetingList() {
  const [when, setWhen] = useState<"UPCOMING" | "PAST" | "ALL">("UPCOMING");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<MeetingListView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => communicationsGet<MeetingListView>(`/api/communications/meetings?when=${when}&page=${page}`, "Meetings could not be loaded.")
    .then(result => { setView(result); setError(null); }, problem => setError(errorMessage(problem, "Meetings could not be loaded."))), [when, page]);
  useEffect(() => { void load(); }, [load]);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Which meetings">
      {(["UPCOMING", "PAST", "ALL"] as const).map(value => <Button key={value} size="sm" variant={when === value ? "default" : "outline"} aria-pressed={when === value} onClick={() => { setWhen(value); setPage(1); }}>
        {value === "UPCOMING" ? "Upcoming" : value === "PAST" ? "Past" : "All"}</Button>)}
      <p className="ml-auto text-xs text-muted-foreground">Schedule meetings from a lead or contact page.</p>
    </div>
    {error ? <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw aria-hidden />Try again</Button></div>
      : !view ? <p role="status" className="text-sm text-muted-foreground">Loading meetings…</p>
      : view.meetings.length ? <ul className="divide-y rounded-lg border" aria-label="Meetings">{view.meetings.map(meeting => <MeetingRow key={meeting.id} meeting={meeting} />)}</ul>
      : <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">No meetings here yet.</p>}
    {view && (page > 1 || view.hasMore) && <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={!view.hasMore} onClick={() => setPage(page + 1)}>Next</Button></div>}
  </div>;
}

function EditMeeting({meeting, organizationId, onDone}: {meeting: MeetingView; organizationId: string; onDone: () => void}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await communicationsSend(`/api/communications/meetings/${meeting.id}`, organizationId, "PUT", {expectedRevision: meeting.revision, details: detailsFrom(form), notes: meeting.notes, attendeeIds: form.getAll("attendeeIds").map(String)}, "The meeting could not be saved.");
      setOpen(false); toast.success("Meeting updated."); onDone();
    } catch (problem) { setError(errorMessage(problem, "The meeting could not be saved.")); }
    finally { setPending(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!pending) { setOpen(value); setError(""); } }}>
    <DialogTrigger render={<Button size="sm" variant="outline" />}>Edit</DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Edit the meeting</DialogTitle><DialogDescription>Changes are not sent to anyone.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4">
        <MeetingFields prefix={prefix} meeting={meeting} attendees={meeting.attendeeOptions.filter(option => option.id !== meeting.organizerMembershipId).map(option => ({id: option.id, name: option.name}))}
          selected={meeting.attendees.map(row => row.membershipId)} startDefault="" />
        <Button type="submit">{pending ? "Saving…" : "Save"}</Button>
      </fieldset><LeadFormMessage message={error} /></form>
    </DialogContent>
  </Dialog>;
}

function CompleteMeeting({meeting, organizationId, onDone}: {meeting: MeetingView; organizationId: string; onDone: () => void}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const notes = String(new FormData(event.currentTarget).get("notes") ?? "").trim();
    try {
      await communicationsSend(`/api/communications/meetings/${meeting.id}/status`, organizationId, "POST", {expectedRevision: meeting.revision, status: "COMPLETED", notes: notes || null}, "The meeting could not be updated.");
      setOpen(false); toast.success("Meeting marked as held."); onDone();
    } catch (problem) { setError(errorMessage(problem, "The meeting could not be updated.")); }
    finally { setPending(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!pending) { setOpen(value); setError(""); } }}>
    <DialogTrigger render={<Button size="sm" />}>Mark as held</DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Meeting held</DialogTitle><DialogDescription>Record what was discussed. Notes stay internal.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4">
        <LeadField id={`${prefix}-notes`} label="Notes"><textarea id={`${prefix}-notes`} name="notes" rows={6} className={textareaClassName} maxLength={8000} defaultValue={meeting.notes ?? ""} /></LeadField>
        <Button type="submit">{pending ? "Saving…" : "Save"}</Button>
      </fieldset><LeadFormMessage message={error} /></form>
    </DialogContent>
  </Dialog>;
}

/** One meeting: details, status changes, notes and the Claude summary with its suggestions. */
export function MeetingDetail({meetingId, organizationId}: {meetingId: string; organizationId: string}) {
  const [meeting, setMeeting] = useState<MeetingView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => communicationsGet<MeetingView>(`/api/communications/meetings/${meetingId}`, "The meeting could not be loaded.")
    .then(result => { setMeeting(result); setError(null); }, problem => setError(errorMessage(problem, "The meeting could not be loaded."))), [meetingId]);
  useEffect(() => { void load(); }, [load]);
  async function act(key: string, path: string, body: unknown, success: string) {
    setBusy(key);
    try { await communicationsSend(path, organizationId, "POST", body); toast.success(success); }
    catch (problem) { toast.error(errorMessage(problem, "The request could not be completed.")); }
    finally { setBusy(null); void load(); }
  }
  if (error) return <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw aria-hidden />Try again</Button></div>;
  if (!meeting) return <div role="status" className="animate-pulse rounded-xl border p-6 text-sm text-muted-foreground">Loading the meeting…</div>;
  const who = meeting.lead ? {label: meeting.lead.fullName, href: `/leads/${meeting.lead.id}`} : meeting.contact ? {label: meeting.contact.fullName, href: `/contacts/${meeting.contact.id}`} : null;
  const scheduled = meeting.status === "SCHEDULED";
  const summary = meeting.summary;
  return <div className="space-y-5">
    <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1">
      <CardTitle role="heading" aria-level={2}>{meeting.title}</CardTitle>
      <CardDescription>{formatLeadDate(meeting.startsAt, true)} – {new Intl.DateTimeFormat("en-GB", {timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit"}).format(new Date(meeting.endsAt))} (Dubai) · {MEETING_PROVIDER_LABELS[meeting.provider as MeetingProvider]}</CardDescription></div>
      <Badge variant={statusVariant(meeting.status)} data-testid="meeting-status">{MEETING_STATUS_LABELS[meeting.status as MeetingStatus]}</Badge></div></CardHeader>
      <CardContent className="space-y-4 px-5 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">Customer</dt><dd>{who ? <Link className="font-medium text-primary hover:underline" href={who.href}>{who.label}</Link> : "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Organizer</dt><dd>{meeting.organizerMembership.userProfile?.displayName ?? "Team member"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Colleagues invited</dt><dd>{meeting.attendees.length ? meeting.attendees.map(row => row.membership.userProfile?.displayName ?? "Team member").join(", ") : "None"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{meeting.meetingUrl ? "Link" : "Location"}</dt><dd>{meeting.meetingUrl
            ? <a href={meeting.meetingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Open in {MEETING_PROVIDER_LABELS[meeting.provider as MeetingProvider]}<ExternalLink aria-hidden className="size-3.5" /></a>
            : meeting.location ?? "—"}</dd></div>
        </dl>
        {meeting.agenda && <div><h3 className="text-xs font-medium text-muted-foreground">Agenda</h3><p className="whitespace-pre-wrap" dir="auto">{meeting.agenda}</p></div>}
        {meeting.notes && <div><h3 className="text-xs font-medium text-muted-foreground">Notes</h3><p className="whitespace-pre-wrap" dir="auto" data-testid="meeting-notes">{meeting.notes}</p></div>}
        {meeting.canEdit && scheduled && <div className="flex flex-wrap gap-2 border-t pt-4">
          <CompleteMeeting meeting={meeting} organizationId={organizationId} onDone={() => void load()} />
          <EditMeeting meeting={meeting} organizationId={organizationId} onDone={() => void load()} />
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void act("no-show", `/api/communications/meetings/${meeting.id}/status`, {expectedRevision: meeting.revision, status: "NO_SHOW"}, "Marked as not attended.")}>Customer did not attend</Button>
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void act("cancel", `/api/communications/meetings/${meeting.id}/status`, {expectedRevision: meeting.revision, status: "CANCELLED"}, "Meeting cancelled.")}>Cancel meeting</Button>
        </div>}
      </CardContent></Card>

    {meeting.status === "COMPLETED" && <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><div className="flex items-center gap-2"><Sparkles className="size-4 text-muted-foreground" aria-hidden /><CardTitle role="heading" aria-level={2}>Claude summary of the notes</CardTitle></div>
      <CardDescription>A draft from your notes; every point quotes them and anything not found is marked. Nothing is sent or changed on the customer&apos;s record.</CardDescription></CardHeader>
      <CardContent className="space-y-4 px-5">
        {!meeting.aiAnalysisEnabled ? <p className="text-sm text-muted-foreground">Claude summaries are off for your company. An owner or administrator can enable them in Calling settings.</p>
          : !summary ? <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={!meeting.canSummarize || busy !== null} onClick={() => void act("summary", `/api/communications/meetings/${meeting.id}/summary`, {}, "Summary ready to review.")}>
              {busy === "summary" ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}Summarise the notes</Button>
            {!meeting.notes?.trim() && <p className="text-xs text-muted-foreground">Add notes when marking the meeting as held to summarise them.</p>}
          </div>
          : <article className="space-y-4" aria-label="Meeting summary">
            <div className="flex flex-wrap items-center gap-1.5 text-xs"><Badge variant="outline">{SUMMARY_CONFIDENCE[summary.overallConfidence]}</Badge>
              {summary.unverifiedCount > 0 && <Badge variant="destructive">{summary.unverifiedCount} unsupported {summary.unverifiedCount === 1 ? "point" : "points"}</Badge>}
              <span className="text-muted-foreground">{meeting.summarizedBy?.displayName} · {meeting.summarizedAt ? formatLeadDate(meeting.summarizedAt, true) : ""}</span></div>
            <SummarySections summary={summary} subject="meeting" />
            {summary.suggestions.length > 0 && <div className="space-y-2 border-t pt-3"><h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suggested actions</h4>
              <ul className="space-y-2">{summary.suggestions.map((suggestion, index) => {
                const decision = meeting.decisions[String(index)];
                const path = `/api/communications/meetings/${meeting.id}/suggestions/${index}/decide`;
                const leadId = meeting.lead?.id ?? null;
                return <li key={index} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0"><p className="text-sm font-medium">{suggestion.title}</p><p className="text-xs text-muted-foreground">{SUGGESTION_LABELS[suggestion.kind as SuggestionKind] ?? suggestion.kind} · {suggestion.text}{!suggestion.verified && " · not found in the notes"}</p></div>
                  {decision ? <Badge variant="outline">{decision.status === "ACCEPTED" ? "Accepted" : "Dismissed"}</Badge>
                    : meeting.canEdit && <div className="flex flex-wrap gap-1">
                      {FOLLOW_UP_KINDS.includes(suggestion.kind) && leadId && <AcceptFollowUp title={suggestion.title} path={path} organizationId={organizationId} onDone={() => void load()} />}
                      {suggestion.kind === "PROPOSAL_DRAFT" && leadId && <Link className={buttonVariants({variant: "outline", size: "sm"})} href={aiContentHref("CLIENT_PROPOSAL", undefined, [{kind: "leadId", id: leadId}])}
                        onClick={() => void communicationsSend(path, organizationId, "POST", {action: "ACCEPT"}).catch(() => undefined)}>Draft in Content Studio</Link>}
                      {suggestion.kind === "SCHEDULE_VIEWING" && leadId && <Link className={buttonVariants({variant: "outline", size: "sm"})} href={`/leads/${leadId}#lead-viewings`}
                        onClick={() => void communicationsSend(path, organizationId, "POST", {action: "ACCEPT"}).catch(() => undefined)}>Open viewings</Link>}
                      <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void act(`s${index}`, path, {action: "DISMISS"}, "Suggestion dismissed.")}>Dismiss</Button>
                    </div>}
                </li>;
              })}</ul></div>}
          </article>}
      </CardContent></Card>}
  </div>;
}
