"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { selectClassName } from "@/modules/leads/components/lead-ui";
import { communicationsGet, errorMessage, formatDuration } from "../client";
import { CALL_OUTCOME_LABELS } from "../model";
import type { CommunicationReportView } from "../server/reports";

function Stat({label, value, note}: {label: string; value: string | number; note?: string}) {
  return <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>{note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}</div>;
}

/** Calls and meetings over a period: attempts, answered calls, conversations and outcomes kept apart. */
export function CommunicationReports() {
  const [filters, setFilters] = useState<{from?: string; to?: string; agent?: string}>({});
  const [view, setView] = useState<CommunicationReportView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])));
    return communicationsGet<CommunicationReportView>(`/api/communications/reports?${query}`, "The report could not be loaded.")
      .then(result => { setView(result); setError(null); }, problem => setError(errorMessage(problem, "The report could not be loaded.")));
  }, [filters]);
  useEffect(() => { void load(); }, [load]);
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFilters({from: String(form.get("from") ?? "") || undefined, to: String(form.get("to") ?? "") || undefined, agent: String(form.get("agent") ?? "") || undefined});
  }

  return <div className="space-y-5">
    {view && <form onSubmit={apply} className="flex flex-wrap items-end gap-3" aria-label="Report filters">
      <div className="space-y-1"><label htmlFor="report-from" className="text-xs font-medium">From (Dubai)</label><Input id="report-from" name="from" type="date" defaultValue={view.from} key={`f${view.from}`} /></div>
      <div className="space-y-1"><label htmlFor="report-to" className="text-xs font-medium">To</label><Input id="report-to" name="to" type="date" defaultValue={view.to} key={`t${view.to}`} /></div>
      {view.companyWide && <div className="space-y-1"><label htmlFor="report-agent" className="text-xs font-medium">Agent</label>
        <select id="report-agent" name="agent" className={selectClassName} defaultValue={view.agent ?? ""}><option value="">Everyone</option>{view.agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></div>}
      <Button type="submit" variant="outline">Show</Button>
      <p className="text-xs text-muted-foreground">{view.companyWide ? "Company-wide." : "Your own calls and meetings."} Up to 92 days.</p>
    </form>}
    {error ? <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw aria-hidden />Try again</Button></div>
      : !view ? <div role="status" className="animate-pulse rounded-xl border p-6 text-sm text-muted-foreground">Loading the report…</div>
      : <>
        {view.truncated && <p role="note" className="text-sm text-amber-700 dark:text-amber-300">This period has more than 5,000 calls; the figures cover the latest 5,000. Choose a shorter period.</p>}
        <section aria-label="Totals" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Outgoing attempts" value={view.totals.attempts} note={`${view.totals.answered} answered${view.totals.attempts ? ` (${Math.round(view.totals.answered / view.totals.attempts * 100)}%)` : ""}`} />
          <Stat label="Incoming calls" value={view.totals.incoming} note={`${view.totals.missed} missed`} />
          <Stat label="Conversations" value={view.totals.conversations} note="Answered calls with an outcome recorded" />
          <Stat label="Meetings held" value={view.meetings.held} note={`${view.meetings.scheduled} scheduled · ${view.meetings.noShow} not attended · ${view.meetings.cancelled} cancelled`} />
        </section>
        <p className="text-xs text-muted-foreground">
          Average answered call: {view.totals.averageAnsweredSeconds === null ? "—" : formatDuration(view.totals.averageAnsweredSeconds)}. Call length is shown for context only; it is not a measure of quality.
          {" "}{view.manualCalls} of {view.totals.attempts + view.totals.incoming + view.totals.inProgress} calls were logged manually by agents.
        </p>
        <Card className="gap-3 py-5 shadow-xs ring-border"><CardHeader className="px-5"><CardTitle role="heading" aria-level={2}>By agent</CardTitle><CardDescription>Calls the agent made or took, and meetings they organized.</CardDescription></CardHeader>
          <CardContent className="px-5">{view.byAgent.length ? <div className="overflow-x-auto"><Table aria-label="Report by agent"><TableHeader><TableRow>
            <TableHead>Agent</TableHead><TableHead className="text-right">Attempts</TableHead><TableHead className="text-right">Answered</TableHead><TableHead className="text-right">Answer rate</TableHead>
            <TableHead className="text-right">Incoming</TableHead><TableHead className="text-right">Missed</TableHead><TableHead className="text-right">Conversations</TableHead>
            <TableHead className="text-right">Interested</TableHead><TableHead className="text-right">Viewing requests</TableHead><TableHead className="text-right">Meetings held</TableHead>
          </TableRow></TableHeader><TableBody>{view.byAgent.map(row => <TableRow key={row.agentId}>
            <TableCell className="font-medium">{row.agentName}</TableCell><TableCell className="text-right tabular-nums">{row.attempts}</TableCell><TableCell className="text-right tabular-nums">{row.answered}</TableCell>
            <TableCell className="text-right tabular-nums">{row.answerRate === null ? "—" : `${row.answerRate}%`}</TableCell><TableCell className="text-right tabular-nums">{row.incoming}</TableCell>
            <TableCell className="text-right tabular-nums">{row.missed}</TableCell><TableCell className="text-right tabular-nums">{row.conversations}</TableCell>
            <TableCell className="text-right tabular-nums">{row.interested}</TableCell><TableCell className="text-right tabular-nums">{row.viewingRequested}</TableCell><TableCell className="text-right tabular-nums">{row.meetings.held}</TableCell>
          </TableRow>)}</TableBody></Table></div> : <p className="text-sm text-muted-foreground">No calls or meetings in this period.</p>}</CardContent></Card>
        <Card className="gap-3 py-5 shadow-xs ring-border"><CardHeader className="px-5"><CardTitle role="heading" aria-level={2}>Recorded outcomes</CardTitle><CardDescription>What agents recorded on answered calls. An outcome is not a sale.</CardDescription></CardHeader>
          <CardContent className="px-5"><ul className="grid gap-2 sm:grid-cols-2">{view.outcomes.map(item => <li key={item.outcome} className="flex justify-between rounded-md border px-3 py-2 text-sm"><span>{CALL_OUTCOME_LABELS[item.outcome]}</span><span className="tabular-nums">{item.count}</span></li>)}</ul></CardContent></Card>
      </>}
  </div>;
}
