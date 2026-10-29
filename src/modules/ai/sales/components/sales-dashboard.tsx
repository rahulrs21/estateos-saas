"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bot, Loader2, MessagesSquare, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/modules/leads/components/lead-ui";
import type { PipelineSummaryOutput } from "../analysis";
import { errorMessage, salesGet, salesSend, type PipelineSummaryView, type SalesDashboardView } from "../client";
import { PRIORITY_LABELS } from "../scoring";

const label = (status: string) => status.replaceAll("_", " ").toLowerCase().replace(/^./, char => char.toUpperCase());

function Tile({title, value, hint}: {title: string; value: number | string | null; hint?: string}) {
  return <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value ?? "—"}</p>{hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}</div>;
}

/** One series: thin primary bars anchored to the baseline, hover/focus labels, and the same data as a table for screen readers. */
function ActivityTrend({points}: {points: Array<{date: string; interactions: number}>}) {
  const max = Math.max(1, ...points.map(point => point.interactions));
  const day = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {day: "numeric", month: "short", timeZone: "UTC"});
  return <figure>
    <div className="flex h-36 items-end gap-1.5 border-b border-border/70 pb-px" aria-hidden="true">
      {points.map(point => <div key={point.date} className="group relative flex h-full flex-1 items-end justify-center">
        <div className="w-full max-w-5 rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80" style={{height: `${Math.max(point.interactions ? 3 : 0, (point.interactions / max) * 100)}%`}} />
        <span className="pointer-events-none absolute -top-7 z-10 hidden whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-sm group-hover:block">{day(point.date)}: {point.interactions}</span>
      </div>)}
    </div>
    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground" aria-hidden="true"><span>{day(points[0]?.date ?? "")}</span><span>{day(points.at(-1)?.date ?? "")}</span></div>
    <figcaption className="mt-2 text-[11px] text-muted-foreground">Recorded interactions per day (Dubai time): notes, status changes, completed follow-ups, shortlist, viewing and qualification updates.</figcaption>
    <table className="sr-only"><caption>Recorded interactions per day</caption><thead><tr><th>Date</th><th>Interactions</th></tr></thead><tbody>{points.map(point => <tr key={point.date}><td>{point.date}</td><td>{point.interactions}</td></tr>)}</tbody></table>
  </figure>;
}

export function SalesDashboard({organizationId}: {organizationId: string}) {
  const [scope, setScope] = useState("company");
  const [view, setView] = useState<SalesDashboardView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<PipelineSummaryView | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const load = useCallback((value: string) => salesGet<SalesDashboardView>(`/api/ai/sales/dashboard?scope=${encodeURIComponent(value)}`, "Sales metrics could not be loaded.")
    .then(result => { setView(result); setError(null); }, cause => setError(errorMessage(cause, "Sales metrics could not be loaded.")))
    .finally(() => setLoading(false)), []);
  useEffect(() => { void load("company"); }, [load]);
  const reload = (value: string) => { setLoading(true); setError(null); void load(value); };

  const summarize = async () => {
    setSummaryBusy(true); setSummaryError(null);
    try { setSummary(await salesSend<PipelineSummaryView>(`/api/ai/sales/dashboard/summaries?scope=${encodeURIComponent(scope)}`, organizationId, "POST", {}, "Claude could not summarise the pipeline.")); }
    catch (cause) { setSummaryError(errorMessage(cause, "Claude could not summarise the pipeline.")); }
    finally { setSummaryBusy(false); }
  };
  const openSummary = async (id: string) => {
    setSummaryError(null);
    try {
      const stored = await salesGet<{id: string; createdAt: string; model: string; content: {summary: PipelineSummaryOutput; unverifiedFigures: string[]; scope: string}}>(`/api/ai/sales/dashboard/summaries/${id}`);
      setSummary({id: stored.id, createdAt: stored.createdAt, model: stored.model, ...stored.content});
    } catch (cause) { setSummaryError(errorMessage(cause, "The summary could not be loaded.")); }
  };

  if (error) return <Card><CardContent className="space-y-3 py-6"><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => reload(scope)}><RefreshCw aria-hidden="true" />Try again</Button></CardContent></Card>;
  if (!view) return <div role="status" className="animate-pulse rounded-xl border p-6 text-sm text-muted-foreground">Loading sales metrics...</div>;
  const {metrics} = view;
  const administrator = view.scopeOptions !== null;
  const preset = (key: string) => `/ai-copilot?preset=${key}`;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      {administrator ? <div className="w-full max-w-xs space-y-1.5"><Label htmlFor="sales-scope">Scope</Label>
        <select id="sales-scope" value={scope} disabled={loading} className={selectClassName} onChange={event => { setScope(event.target.value); setSummary(null); reload(event.target.value); }}>
          <option value="company">Whole company</option>
          {view.scopeOptions!.agents.length > 0 && <optgroup label="Agent">{view.scopeOptions!.agents.map(agent => <option key={agent.id} value={`agent:${agent.id}`}>{agent.name}</option>)}</optgroup>}
          {view.scopeOptions!.branches.length > 0 && <optgroup label="Branch">{view.scopeOptions!.branches.map(branch => <option key={branch.id} value={`branch:${branch.id}`}>{branch.name}</option>)}</optgroup>}
        </select></div>
        : <p className="text-sm text-muted-foreground">Showing leads assigned to you.</p>}
      <div className="flex flex-wrap gap-2">
        <Link href={preset("team-pipeline")} className={buttonVariants({variant: "outline", size: "sm"})}><MessagesSquare aria-hidden="true" />Summarize team pipeline</Link>
        <Link href={preset("overdue-follow-ups")} className={buttonVariants({variant: "outline", size: "sm"})}><MessagesSquare aria-hidden="true" />Review overdue follow-ups</Link>
        {administrator && <Link href={preset("unassigned-leads")} className={buttonVariants({variant: "outline", size: "sm"})}><MessagesSquare aria-hidden="true" />Identify unassigned leads</Link>}
        <Button variant="ghost" size="sm" disabled={loading} onClick={() => reload(scope)}>{loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}Refresh</Button>
      </div>
    </div>

    <section aria-labelledby="recorded-metrics" className="space-y-4">
      <div className="flex items-center gap-2"><h2 id="recorded-metrics" className="text-base font-semibold">Recorded CRM metrics</h2><Badge variant="outline">Actual records · {view.scope.label}</Badge></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile title="Open leads" value={metrics.leads.open} hint={`${metrics.leads.newLast7Days} created in the last 7 days`} />
        <Tile title="Qualified leads" value={metrics.leads.qualified} hint="Leads at the Qualified stage" />
        <Tile title="Overdue follow-ups" value={metrics.leads.overdueFollowUp} hint={`${metrics.leads.noUpcomingFollowUp} open leads with no upcoming follow-up`} />
        <Tile title="Viewings awaiting confirmation" value={metrics.viewings.awaitingConfirmation} hint={`${metrics.viewings.upcoming30Days} upcoming in 30 days · ${metrics.viewings.outcomeNotRecorded} outcomes not recorded`} />
        {metrics.leads.unassigned !== null && <Tile title="Unassigned open leads" value={metrics.leads.unassigned} />}
        <Tile title="Won / lost (active records)" value={`${metrics.leads.won} / ${metrics.leads.lost}`} />
        <Tile title="Leads with matching inventory" value={view.matchingInventory ? `${view.matchingInventory.leadsWithMatches} / ${view.matchingInventory.leadsChecked}` : null}
          hint={view.matchingInventory ? `${view.matchingInventory.distinctMatchingProperties} distinct available properties · ${view.matchingInventory.sampleRule.toLowerCase()}` : "Inventory is not available to your role"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="shadow-xs ring-border"><CardHeader><CardTitle>Pipeline by stage</CardTitle><CardDescription>Open leads per stage; stale means no update for {metrics.pipeline.staleAfterDays}+ days.</CardDescription></CardHeader>
          <CardContent><table className="w-full text-left text-sm"><caption className="sr-only">Open leads by stage</caption>
            <thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 font-medium">Stage</th><th className="py-2 text-right font-medium">Leads</th><th className="py-2 text-right font-medium">Stale</th><th className="py-2 text-right font-medium">Median days since update</th></tr></thead>
            <tbody>{metrics.pipeline.byStatus.map(row => <tr key={row.status} className="border-b last:border-0"><td className="py-2">{label(row.status)}</td><td className="py-2 text-right tabular-nums">{row.count}</td><td className="py-2 text-right tabular-nums">{row.stale}</td><td className="py-2 text-right tabular-nums">{row.medianDaysSinceUpdate ?? "—"}</td></tr>)}</tbody></table>
            {metrics.pipeline.bottlenecks.length > 0 && <p className="mt-3 flex gap-2 text-xs text-muted-foreground"><AlertTriangle className="size-3.5 shrink-0 text-amber-600" aria-hidden="true" />Most stale: {metrics.pipeline.bottlenecks.map(row => `${label(row.status)} (${row.stale})`).join(", ")}.</p>}
          </CardContent></Card>
        <Card className="shadow-xs ring-border"><CardHeader><CardTitle>Recent activity</CardTitle><CardDescription>Last 14 days, for leads in this scope.</CardDescription></CardHeader>
          <CardContent><ActivityTrend points={metrics.activityTrend} /></CardContent></Card>
      </div>

      <Card className="shadow-xs ring-border"><CardHeader><CardTitle>Leads by rule-based priority</CardTitle><CardDescription>Latest stored assessment per open lead in the last {metrics.aiPriority.windowDays} days, after any manual review. Calculated by EstateOS rules, not by Claude.</CardDescription></CardHeader>
        <CardContent><div className="grid gap-3 sm:grid-cols-5">
          {(["HIGH", "MEDIUM", "LOW", "INSUFFICIENT_DATA"] as const).map(key => <Tile key={key} title={PRIORITY_LABELS[key]} value={metrics.aiPriority[key]} />)}
          <Tile title="Not assessed" value={metrics.aiPriority.notAssessed} hint="Open a lead and click Evaluate score" />
        </div>{metrics.aiPriority.overriddenByReview > 0 && <p className="mt-2 text-xs text-muted-foreground">{metrics.aiPriority.overriddenByReview} priority(ies) changed by a person&apos;s review.</p>}</CardContent></Card>

      <p className="text-[11px] text-muted-foreground">Counts of stored records at {new Date(metrics.asOf).toLocaleString("en-GB", {timeZone: "Asia/Dubai"})} (Dubai). {view.coverage.leadsComplete ? "" : `Only the first ${view.coverage.leadsLoaded} of ${view.coverage.leadsInScope} leads were loaded. `}No forecasts or conversion probabilities are shown: EstateOS does not yet have the historical outcomes needed to validate them.</p>
    </section>

    <section aria-labelledby="ai-insights" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Sparkles className="size-4 text-primary" aria-hidden="true" /><h2 id="ai-insights" className="text-base font-semibold">AI-generated insights</h2></div>
        <Button size="sm" disabled={summaryBusy || !view.aiAvailable} onClick={() => void summarize()}>{summaryBusy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Bot aria-hidden="true" />}{summaryBusy ? "Summarising..." : "Summarize with Claude"}</Button></div>
      {!view.aiAvailable && <p className="text-sm text-muted-foreground">Claude is not configured for this environment. The recorded metrics above are unaffected.</p>}
      {summaryError && <p role="alert" className="text-sm text-destructive">{summaryError}</p>}
      {summary && <Card className="border-primary/20 bg-primary/5 shadow-xs"><CardContent className="space-y-3 py-5 text-sm">
        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">AI-generated</Badge><span className="text-[11px] text-muted-foreground">{summary.scope} · {new Date(summary.createdAt).toLocaleString("en-GB", {timeZone: "Asia/Dubai"})}</span></div>
        <p className="font-medium">{summary.summary.headline}</p>
        {summary.summary.observations.length > 0 && <ul className="list-disc space-y-1 pl-5">{summary.summary.observations.map((item, index) => <li key={index}>{item}</li>)}</ul>}
        {summary.summary.suggestedFocus.length > 0 && <><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested focus</p><ul className="list-disc space-y-1 pl-5">{summary.summary.suggestedFocus.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
        {summary.summary.dataLimitations.length > 0 && <p className="text-[11px] text-muted-foreground">Limitations: {summary.summary.dataLimitations.join(" ")}</p>}
        {summary.unverifiedFigures.length > 0 && <p className="flex gap-1 text-[11px] text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />Figures not found in the recorded metrics: {summary.unverifiedFigures.join(", ")}. Treat them as unverified.</p>}
        <p className="text-[11px] text-muted-foreground">Written by Claude from the recorded metrics above. The metrics are the source of truth.</p>
      </CardContent></Card>}
      {view.recentSummaries.length > 0 && <div className="text-xs text-muted-foreground">Your recent summaries: {view.recentSummaries.map(item => <button key={item.id} type="button" className="ml-2 text-primary hover:underline" onClick={() => void openSummary(item.id)}>{new Date(item.createdAt).toLocaleString("en-GB", {timeZone: "Asia/Dubai", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"})}</button>)}</div>}
    </section>
  </div>;
}
