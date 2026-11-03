"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeadField, selectClassName } from "@/modules/leads/components/lead-ui";
import { communicationsGet, errorMessage } from "../client";
import { CALL_DIRECTION_LABELS, CALL_DIRECTIONS, CALL_OUTCOME_LABELS, CALL_OUTCOMES, CALL_STATUS_LABELS, CALL_STATUSES } from "../model";
import type { CallListView } from "../server/hub";
import { CallItem } from "./call-panel";

type Filters = {direction: string; callStatus: string; outcome: string; source: string; agent: string; from: string; to: string};
const EMPTY: Filters = {direction: "", callStatus: "", outcome: "", source: "", agent: "", from: "", to: ""};

/** Filterable list of the calls the member may read. */
export function CallList({organizationId}: {organizationId: string}) {
  const prefix = useId();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<CallListView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((next: Filters, at: number) => {
    const query = new URLSearchParams(Object.entries(next).filter(([, value]) => value));
    if (at) query.set("offset", String(at));
    setLoading(true);
    return communicationsGet<CallListView>(`/api/communications/calls${query.size ? `?${query}` : ""}`, "Calls could not be loaded.")
      .then(result => { setView(result); setError(null); setOffset(at); }, problem => setError(errorMessage(problem, "Calls could not be loaded.")))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { void load(EMPTY, 0); }, [load]);
  const change = (key: keyof Filters, value: string) => { const next = {...filters, [key]: value}; setFilters(next); void load(next, 0); };

  const select = (key: keyof Filters, label: string, options: Array<[string, string]>) => <LeadField id={`${prefix}-${key}`} label={label}>
    <select id={`${prefix}-${key}`} className={selectClassName} value={filters[key]} onChange={event => change(key, event.target.value)}><option value="">All</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></LeadField>;

  return <div className="space-y-4">
    <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7" role="search" aria-label="Filter calls">
      {select("direction", "Direction", CALL_DIRECTIONS.map(value => [value, CALL_DIRECTION_LABELS[value]]))}
      {select("callStatus", "Status", CALL_STATUSES.map(value => [value, CALL_STATUS_LABELS[value]]))}
      {select("outcome", "Outcome", CALL_OUTCOMES.map(value => [value, CALL_OUTCOME_LABELS[value]]))}
      {select("source", "Recorded by", [["MANUAL", "Logged manually"], ["PROVIDER", "Calling provider"]])}
      {view?.companyWide && select("agent", "Agent", view.agents.map(agent => [agent.id, agent.name]))}
      <LeadField id={`${prefix}-from`} label="From (Dubai)"><Input id={`${prefix}-from`} type="date" value={filters.from} onChange={event => change("from", event.target.value)} /></LeadField>
      <LeadField id={`${prefix}-to`} label="To (Dubai)"><Input id={`${prefix}-to`} type="date" value={filters.to} onChange={event => change("to", event.target.value)} /></LeadField>
    </div>
    {error ? <div role="alert" className="space-y-3 rounded-xl border p-6"><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => void load(filters, offset)}><RefreshCw aria-hidden="true" />Try again</Button></div>
      : !view ? <div role="status" className="animate-pulse rounded-xl border p-6 text-sm text-muted-foreground">Loading calls...</div>
      : <>
        <p className="text-xs text-muted-foreground" aria-live="polite">{loading ? "Updating…" : `${view.total} ${view.total === 1 ? "call" : "calls"}${view.companyWide ? "" : " you may see (yours and those on your leads)"}`}</p>
        {view.calls.length ? <ol className="space-y-3" aria-label="Calls">{view.calls.map(call => <CallItem key={call.id} call={call} organizationId={organizationId} showLead onChanged={() => void load(filters, offset)} />)}</ol>
          : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No calls match these filters.</p>}
        {(offset > 0 || view.hasMore) && <nav aria-label="Call pages" className="flex justify-between gap-2">
          <Button variant="outline" size="sm" disabled={offset === 0 || loading} onClick={() => void load(filters, Math.max(0, offset - view.pageSize))}>Newer</Button>
          <Button variant="outline" size="sm" disabled={!view.hasMore || loading} onClick={() => void load(filters, offset + view.pageSize)}>Older</Button></nav>}
      </>}
  </div>;
}
