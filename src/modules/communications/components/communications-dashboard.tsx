"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CalendarClock, Eye, PhoneIncoming, PhoneMissed, PhoneOutgoing, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLeadDate } from "@/modules/leads/components/lead-ui";
import { communicationsGet, errorMessage, formatDuration } from "../client";
import { CALL_DIRECTION_LABELS, CALL_OUTCOME_LABELS, CALL_STATUS_LABELS } from "../model";
import type { CommunicationDashboardView } from "../server/hub";

type CallRow = CommunicationDashboardView["recent"][number];

function Stat({label, value, hint}: {label: string; value: ReactNode; hint: string}) {
  return <Card className="gap-1 py-4 shadow-xs ring-border"><CardContent className="px-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{hint}</p></CardContent></Card>;
}

function CallRows({calls, empty}: {calls: CallRow[]; empty: string}) {
  if (!calls.length) return <p className="py-4 text-sm text-muted-foreground">{empty}</p>;
  return <ul className="divide-y">{calls.map(call => {
    const Icon = !call.answered ? PhoneMissed : call.direction === "INBOUND" ? PhoneIncoming : PhoneOutgoing;
    const who = call.lead?.fullName ?? call.contact?.fullName ?? call.number ?? "Unknown caller";
    return <li key={call.id} className="flex items-center gap-3 py-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1"><Link href={`/communications/calls/${call.id}`} className="block truncate text-sm font-medium hover:underline">{who}</Link>
        <p className="truncate text-xs text-muted-foreground">{CALL_DIRECTION_LABELS[call.direction]} · {CALL_STATUS_LABELS[call.callStatus]}{call.answered && call.durationSeconds > 0 ? ` · ${formatDuration(call.durationSeconds)}` : ""} · {call.agent}</p></div>
      <div className="flex shrink-0 flex-col items-end gap-1">{call.outcome && <Badge variant="secondary">{CALL_OUTCOME_LABELS[call.outcome]}</Badge>}<time dateTime={call.startedAt} className="text-[11px] text-muted-foreground">{formatLeadDate(call.startedAt, true)}</time></div>
    </li>;
  })}</ul>;
}

function Section({title, description, children}: {title: string; description: string; children: ReactNode}) {
  return <Card className="gap-3 py-5 shadow-xs ring-border"><CardHeader className="px-5"><CardTitle role="heading" aria-level={2}>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="px-5">{children}</CardContent></Card>;
}

/** Real counts from stored calls only; attempts, answered calls, conversations and outcomes are shown apart. */
export function CommunicationsDashboard() {
  const [view, setView] = useState<CommunicationDashboardView | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** When the data was loaded: overdue follow-ups are judged against it (never the clock during render). */
  const [loadedAt, setLoadedAt] = useState(0);
  /** Developer tools only: simulated calls are never counted unless asked for. */
  const [withSimulated, setWithSimulated] = useState(false);
  const load = useCallback(() => communicationsGet<CommunicationDashboardView>(`/api/communications/dashboard${withSimulated ? "?includeSimulated=1" : ""}`, "Communications could not be loaded.")
    .then(result => { setView(result); setLoadedAt(Date.now()); setError(null); }, problem => setError(errorMessage(problem, "Communications could not be loaded."))), [withSimulated]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <div role="alert" className="space-y-3 rounded-xl border p-6"><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw aria-hidden="true" />Try again</Button></div>;
  if (!view) return <div role="status" className="animate-pulse rounded-xl border p-6 text-sm text-muted-foreground">Loading communications...</div>;
  const {totals} = view;
  const recorded = totals.attempts + totals.incoming + totals.inProgress;
  return <div className="space-y-5">
    {view.simulated.available && <label className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground" data-testid="include-simulated">
      <input type="checkbox" className="size-4 accent-primary" checked={withSimulated} onChange={event => setWithSimulated(event.target.checked)} />
      Include simulated records (developer tools; {view.simulated.count} in this period). They are labelled SIMULATED and never count otherwise.</label>}
    <p className="text-xs text-muted-foreground">Last {view.periodDays} days · {view.companyWide ? "all company calls" : "calls you handled and calls on your leads"}{view.truncated ? " · based on the most recent 1,000 calls" : ""}. Logged and provider calls are counted the same way; a dial attempt is not a conversation.</p>
    {recorded === 0 ? <div className="rounded-xl border border-dashed p-8 text-center"><p className="text-sm font-medium">No calls recorded in the last {view.periodDays} days</p><p className="mt-1 text-sm text-muted-foreground">Calls appear here when agents log them from a lead or contact, or when a verified provider reports them.</p><Link href="/leads" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">Open leads</Link></div>
      : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Outgoing attempts" value={totals.attempts} hint="Finished outgoing calls, answered or not" />
        <Stat label="Answered" value={totals.answered} hint={totals.attempts ? `${Math.round(totals.answered / totals.attempts * 100)}% of attempts` : "No attempts yet"} />
        <Stat label="Missed incoming" value={totals.missed} hint={`${totals.incoming} incoming in total`} />
        <Stat label="Conversations" value={totals.conversations} hint="Answered calls, in or out, with an outcome recorded" />
        <Stat label="Average answered call" value={totals.averageAnsweredSeconds === null ? "—" : formatDuration(totals.averageAnsweredSeconds)} hint="Length only; not a quality measure" />
      </div>}
    <div className="grid gap-5 xl:grid-cols-2">
      <Section title="Recent calls" description="The latest calls, newest first."><CallRows calls={view.recent} empty="No calls yet." /><Link href="/communications/calls" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">All calls</Link></Section>
      <Section title="Missed calls" description="Incoming calls nobody answered."><CallRows calls={view.missed} empty="No missed calls." /></Section>
      <Section title="Lead calls" description="Calls recorded on leads."><CallRows calls={view.leadCalls} empty="No calls on leads yet." /></Section>
      <Section title="Follow-up needed" description="Calls marked as needing a follow-up that has not been scheduled."><CallRows calls={view.needsFollowUp} empty="Nothing waiting." /></Section>
      <Section title="Call outcomes" description="Outcomes agents recorded for answered calls. An outcome is not a sale.">
        {view.outcomes.every(item => item.count === 0) ? <p className="py-4 text-sm text-muted-foreground">No outcomes recorded yet.</p>
          : <ul className="space-y-1.5">{view.outcomes.filter(item => item.count > 0).map(item => <li key={item.outcome} className="flex justify-between text-sm"><span>{CALL_OUTCOME_LABELS[item.outcome]}</span><span className="tabular-nums text-muted-foreground">{item.count}</span></li>)}</ul>}
      </Section>
      <Section title="Coming up" description="Pending follow-ups and scheduled viewings in the next 7 days.">
        {!view.followUps.length && !view.viewings.length ? <p className="py-4 text-sm text-muted-foreground">Nothing scheduled.</p> : <ul className="divide-y">
          {view.followUps.map(item => <li key={item.id} className="flex items-center gap-3 py-2.5"><CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div className="min-w-0 flex-1"><Link href={`/leads/${item.leadId}#follow-up-history`} className="block truncate text-sm font-medium hover:underline">{item.title}</Link><p className="truncate text-xs text-muted-foreground">Follow-up · {item.lead.fullName} · {item.assignedUser.userProfile?.displayName || item.assignedUser.email}</p></div><time dateTime={item.dueAt} className={`shrink-0 text-[11px] ${Date.parse(item.dueAt) < loadedAt ? "font-medium text-destructive" : "text-muted-foreground"}`}>{Date.parse(item.dueAt) < loadedAt ? "Overdue · " : ""}{formatLeadDate(item.dueAt, true)}</time></li>)}
          {view.viewings.map(item => <li key={item.id} className="flex items-center gap-3 py-2.5"><Eye className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div className="min-w-0 flex-1"><Link href={`/leads/${item.leadId}#lead-viewings`} className="block truncate text-sm font-medium hover:underline">Viewing with {item.lead.fullName}</Link></div><time dateTime={item.scheduledAt} className="shrink-0 text-[11px] text-muted-foreground">{formatLeadDate(item.scheduledAt, true)}</time></li>)}
        </ul>}
      </Section>
    </div>
    {view.companyWide && view.byAgent.length > 0 && <Section title="Calls by agent" description="Counts per agent. Duration and volume alone do not measure the quality of an agent's work.">
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-3 font-medium">Agent</th><th className="py-2 pr-3 font-medium">Attempts</th><th className="py-2 pr-3 font-medium">Answered</th><th className="py-2 pr-3 font-medium">Incoming</th><th className="py-2 pr-3 font-medium">Missed</th><th className="py-2 font-medium">Conversations</th></tr></thead>
        <tbody>{view.byAgent.map(row => <tr key={row.agentId} className="border-b last:border-0"><td className="py-2 pr-3">{row.agentName}</td><td className="py-2 pr-3 tabular-nums">{row.attempts}</td><td className="py-2 pr-3 tabular-nums">{row.answered}</td><td className="py-2 pr-3 tabular-nums">{row.incoming}</td><td className="py-2 pr-3 tabular-nums">{row.missed}</td><td className="py-2 tabular-nums">{row.conversations}</td></tr>)}</tbody></table></div>
    </Section>}
  </div>;
}
