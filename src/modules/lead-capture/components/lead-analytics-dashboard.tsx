import { BarChart3, ClockAlert, ContactRound, HandCoins, UsersRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CountRow = { label: string; count: number; bucket?: string };
type Analytics = {
  filters: { from: string; to: string; timeZone: string; bucket: "day" | "week" | "month"; sourceId: string; pipelineStageId: string; assignedMembershipId: string };
  scope: "COMPANY" | "ASSIGNED_TO_YOU";
  summary: { totalLeads: number; unassignedLeads: number; wonLeads: number; overdueFollowUps: number; leadToWonPercent: number };
  sources: CountRow[]; stages: CountRow[]; byAgent: CountRow[]; volume: CountRow[];
  options: { sources: { id: string; label: string }[]; stages: { id: string; label: string }[]; agents: { id: string; label: string }[] };
  denominator: string;
};

function Metric({ title, value, note, icon: Icon }: { title: string; value: string; note: string; icon: typeof UsersRound }) {
  return <Card><CardContent className="flex min-h-32 items-start justify-between gap-4 p-5"><div><p className="text-sm text-muted-foreground">{title}</p><p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div><span className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="size-4" aria-hidden="true" /></span></CardContent></Card>;
}

function CountPanel({ title, rows, empty, icon: Icon }: { title: string; rows: CountRow[]; empty: string; icon: typeof UsersRound }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return <Card><CardContent className="p-5"><div className="mb-4 flex items-center gap-2"><Icon className="size-4 text-primary" aria-hidden="true" /><h2 className="font-semibold">{title}</h2></div>
    {rows.length ? <ol className="space-y-4">{rows.map((row) => <li key={row.label}><div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="truncate">{row.label}</span><span className="tabular-nums text-muted-foreground">{row.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (row.count / max) * 100)}%` }} /></div></li>)}</ol> : <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">{empty}</p>}
  </CardContent></Card>;
}

export function LeadAnalyticsDashboard({ data }: { data: Analytics }) {
  const summary = data.summary;
  const maxVolume = Math.max(1, ...data.volume.map((entry) => entry.count));
  const scopeLabel = data.scope === "COMPANY" ? "All company leads" : "Leads assigned to you";
  return <div className="space-y-6">
    <Card><CardContent className="p-4 sm:p-5">
      <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8" aria-label="Report filters">
        <label className="space-y-1 text-xs font-medium">From<input className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" type="date" name="from" defaultValue={data.filters.from} /></label>
        <label className="space-y-1 text-xs font-medium">To<input className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" type="date" name="to" defaultValue={data.filters.to} /></label>
        <label className="space-y-1 text-xs font-medium">Timezone<select className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" name="timeZone" defaultValue={data.filters.timeZone}><option value="Asia/Dubai">Asia/Dubai</option><option value="UTC">UTC</option><option value="Europe/London">Europe/London</option><option value="Asia/Riyadh">Asia/Riyadh</option></select></label>
        <label className="space-y-1 text-xs font-medium">Lead volume<select className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" name="bucket" defaultValue={data.filters.bucket}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></label>
        <label className="space-y-1 text-xs font-medium">Source<select className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" name="sourceId" defaultValue={data.filters.sourceId}><option value="">All sources</option>{data.options.sources.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="space-y-1 text-xs font-medium">Pipeline stage<select className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" name="pipelineStageId" defaultValue={data.filters.pipelineStageId}><option value="">All stages</option>{data.options.stages.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="space-y-1 text-xs font-medium">Agent<select className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" name="assignedMembershipId" defaultValue={data.filters.assignedMembershipId}><option value="">{data.scope === "COMPANY" ? "All agents" : "Your leads"}</option>{data.options.agents.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <div className="flex items-end"><Button type="submit" className="w-full">Apply filters</Button></div>
      </form>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Showing {scopeLabel.toLowerCase()} created from {data.filters.from} through {data.filters.to} in {data.filters.timeZone}. The end date includes its full local day.</p>
    </CardContent></Card>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Lead KPI summary">
      <Metric title="Total leads" value={summary.totalLeads.toLocaleString()} note="Visible, non-archived leads in range" icon={UsersRound} />
      <Metric title="Won leads" value={summary.wonLeads.toLocaleString()} note="Won or converted in range" icon={HandCoins} />
      <Metric title="Unassigned" value={summary.unassignedLeads.toLocaleString()} note="Visible leads in range" icon={ContactRound} />
      <Metric title="Overdue follow-ups" value={summary.overdueFollowUps.toLocaleString()} note="Pending and past due now" icon={ClockAlert} />
      <Metric title="Lead-to-won" value={`${summary.leadToWonPercent.toFixed(1)}%`} note="Won ÷ lead cohort in range" icon={BarChart3} />
    </section>

    <Card><CardContent className="p-5"><div className="mb-4 flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-semibold">Lead volume</h2><p className="mt-1 text-xs text-muted-foreground">{data.filters.bucket[0].toUpperCase() + data.filters.bucket.slice(1)} cohorts · {data.filters.timeZone}</p></div><span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{data.volume.reduce((sum, row) => sum + row.count, 0).toLocaleString()} leads</span></div>
      {data.volume.length ? <div className="overflow-x-auto"><div role="img" aria-label={`${data.filters.bucket} lead volume chart`} className="flex min-h-48 min-w-max items-end gap-2 border-b border-l px-2 pt-5">{data.volume.map((entry) => <div key={entry.bucket ?? entry.label} className="flex h-44 w-12 flex-col items-center justify-end gap-2 text-center"><span className="text-[10px] tabular-nums text-muted-foreground">{entry.count}</span><div className="w-6 min-h-1 rounded-t bg-primary" style={{ height: `${Math.max(3, (entry.count / maxVolume) * 75)}%` }} /><span className="max-w-full truncate text-[10px] text-muted-foreground" title={entry.label}>{entry.label}</span></div>)}</div><p className="mt-3 text-xs text-muted-foreground">Use the filters to compare lead volume by source, stage or agent.</p></div> : <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No lead submissions in this period. The chart will populate as your company captures leads.</p>}
    </CardContent></Card>

    <section className="grid gap-4 lg:grid-cols-3" aria-label="Lead breakdowns">
      <CountPanel title="Leads by source" rows={data.sources} empty="No source-attributed leads in this period." icon={ContactRound} />
      <CountPanel title="Leads by stage" rows={data.stages} empty="No leads by stage in this period." icon={BarChart3} />
      <CountPanel title="Leads by agent" rows={data.byAgent} empty="No assigned leads in this period." icon={UsersRound} />
    </section>
    <p className="text-xs leading-5 text-muted-foreground">{data.denominator} Leads counted by creation time; archived records are excluded. Won includes WON and legacy CONVERTED statuses. Overdue follow-ups are pending tasks with due times before the current instant and are not limited by lead creation date.</p>
  </div>;
}

