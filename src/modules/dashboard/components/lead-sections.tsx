import Link from "next/link";
import { ArrowRight, CalendarCheck2, ChartColumnBig, ChartNoAxesCombined, ChartPie, Handshake, ListChecks, TrendingUp, UsersRound, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { DASHBOARD_RANGES, type DashboardRange } from "../dashboard-model";
import type { DashboardData } from "../server/dashboard-data";
import { ActivityFeed } from "./activity-feed";
import { LeadVolumeChart, PipelineColumns, SourcesDonut, Sparkline } from "./charts";
import { sliceColor } from "../series-colors";
import { CopilotCard } from "./copilot-card";
import { DashboardCard, RankedList, SectionEmpty, SectionError } from "./dashboard-card";
import { ChangeBadge, KpiCard, RatioBar } from "./kpi-card";
import { PerformanceStats } from "./performance-stats";
import { Reveal } from "./motion";
import { QuickShortcuts } from "./quick-shortcuts";
import { RangeTabs } from "./range-tabs";
import { TaskAgenda } from "./task-agenda";

const integer = new Intl.NumberFormat("en-AE");
const percent = new Intl.NumberFormat("en-AE", {maximumFractionDigits: 1});
const period = new Intl.DateTimeFormat("en-AE", {day: "numeric", month: "short", year: "numeric", timeZone: "UTC"});
const formatPeriod = (from: string, to: string) => `${period.format(new Date(`${from}T00:00:00Z`))} – ${period.format(new Date(`${to}T00:00:00Z`))}`;
const linkClass = "inline-flex items-center gap-1 rounded font-medium text-primary hover:underline";

/** The lead, task and activity rows of the dashboard, from already-loaded data (see server/dashboard-data.ts). */
export function LeadSectionsView({data, range}: {data: DashboardData; range: DashboardRange}) {
  const {leads, pipeline, tasks, activity} = data;
  const scope = data.sections.leadScope === "COMPANY" ? "All company leads" : "Leads assigned to you";
  const rangeLabel = DASHBOARD_RANGES[range].label;
  const summary = leads.status === "ok" ? leads.data.summary : null;
  const change = leads.status === "ok" ? leads.data.change : null;
  const taskData = tasks.status === "ok" ? tasks.data : null;
  const negotiationShare = pipeline.status === "ok" && pipeline.data.openLeads > 0 ? pipeline.data.negotiation / pipeline.data.openLeads * 100 : 0;

  return <>
    <Reveal index={1} className="space-y-3">
      <p className="px-1 text-xs text-muted-foreground">{scope} · {formatPeriod(data.from, data.to)}</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="New leads" value={summary?.totalLeads ?? null} icon={UsersRound} tone="teal" href="/leads"
          detail={!summary ? "Could not be loaded" : change ? <ChangeBadge change={change.leads} period={rangeLabel} /> : `${integer.format(summary.unassignedLeads)} unassigned`}
          trailing={leads.status === "ok" && summary?.totalLeads ? <Sparkline data={leads.data.volume} /> : null} />
        <KpiCard title="Won" value={summary?.wonLeads ?? null} icon={Handshake} tone="green" href="/leads?status=WON"
          detail={!summary ? "Could not be loaded" : change ? <ChangeBadge change={change.won} period={rangeLabel} /> : `${percent.format(summary.leadToWonPercent)}% of new leads`}
          meter={summary && summary.totalLeads > 0 ? <RatioBar percent={summary.leadToWonPercent} label={`${percent.format(summary.leadToWonPercent)}% won`} /> : null} />
        <KpiCard title="Tasks due in 7 days" value={taskData?.dueNext7Days ?? null} icon={CalendarCheck2} tone="blue" href="/workspace/tasks"
          detail={!taskData ? "Could not be loaded" : taskData.overdue
            ? <span className="font-medium text-(--tile-rose-fg)">{integer.format(taskData.overdue)}{taskData.truncated ? "+" : ""} overdue</span>
            : <span className="text-muted-foreground">Nothing overdue</span>}
          meter={taskData && taskData.overdue + taskData.dueNext7Days > 0
            ? <RatioBar percent={taskData.overdue / (taskData.overdue + taskData.dueNext7Days) * 100} label={`${integer.format(taskData.overdue)} of ${integer.format(taskData.overdue + taskData.dueNext7Days)} late`} tone="rose" /> : null} />
        <KpiCard title="In negotiation" value={pipeline.status === "ok" ? pipeline.data.negotiation : null} icon={TrendingUp} tone="amber" href="/leads?status=NEGOTIATION"
          detail={pipeline.status === "ok" ? <span className="text-muted-foreground">Open leads at this stage now</span> : "Could not be loaded"}
          meter={pipeline.status === "ok" && pipeline.data.openLeads > 0
            ? <RatioBar percent={negotiationShare} label={`${percent.format(negotiationShare)}% of leads`} tone="amber" /> : null} />
      </div>
    </Reveal>

    <Reveal index={2} className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <DashboardCard title="Lead performance" icon={ChartNoAxesCombined} action={<RangeTabs active={range} />}
        description={leads.status === "ok" ? `New leads per ${data.bucket}, last ${rangeLabel}` : undefined}>
        {leads.status === "error" ? <SectionError message={leads.message} />
          : summary?.totalLeads ? <div className="space-y-4">
            <PerformanceStats volume={leads.data.volume} bucket={data.bucket} total={summary.totalLeads} change={change?.leads ?? null} rangeLabel={rangeLabel} />
            <LeadVolumeChart data={leads.data.volume} bucket={data.bucket} />
          </div>
          : <SectionEmpty>No new leads in the last {rangeLabel}.</SectionEmpty>}
      </DashboardCard>
      <DashboardCard title="Lead sources" icon={ChartPie} description="New leads by channel"
        action={<Link href="/workspace/reports" className={linkClass}>View report<ArrowRight className="size-3.5" aria-hidden="true" /></Link>}>
        {leads.status === "error" ? <SectionError message={leads.message} />
          : leads.data.sources.slices.length ? <div className="flex h-full flex-col justify-between gap-5">
            <div className="flex flex-1 flex-col items-center justify-center gap-6 sm:flex-row">
              <SourcesDonut slices={leads.data.sources.slices} total={leads.data.sources.total} />
              <ul className="w-full min-w-0 space-y-3 text-sm">
                {leads.data.sources.slices.map((slice, index) => <li key={slice.label}>
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{background: sliceColor(slice.label, index)}} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{slice.label}</span>
                    <span className="font-medium tabular-nums">{integer.format(slice.count)}</span>
                    <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{slice.percent}%</span>
                  </div>
                  <div className="mt-1.5 ml-[18px] h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full" style={{width: `${Math.max(slice.percent, 2)}%`, background: sliceColor(slice.label, index)}} />
                  </div>
                </li>)}
              </ul>
            </div>
            <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
              <span className="font-medium text-foreground">{leads.data.sources.slices[0].label}</span> brought {leads.data.sources.slices[0].percent}% of new leads in the last {rangeLabel}.
            </p>
          </div>
          : <SectionEmpty>No new leads in the last {rangeLabel}.</SectionEmpty>}
      </DashboardCard>
    </Reveal>

    <Reveal index={3} className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
      <DashboardCard title="Your activity" icon={Zap} description="Latest changes on your leads"
        action={<Link href="/leads" className={linkClass}>View leads<ArrowRight className="size-3.5" aria-hidden="true" /></Link>}>
        {activity.status === "error" ? <SectionError message={activity.message} /> : <ActivityFeed rows={activity.data} now={data.now} />}
      </DashboardCard>
      <DashboardCard title="Upcoming tasks" icon={ListChecks}
        description={taskData ? `${integer.format(taskData.items.length)}${taskData.truncated ? "+" : ""} open` : undefined}
        action={<Link href="/workspace/tasks" className={linkClass}>View all<ArrowRight className="size-3.5" aria-hidden="true" /></Link>}>
        {tasks.status === "error" ? <SectionError message={tasks.message} /> : <TaskAgenda items={tasks.data.items} limit={8} />}
      </DashboardCard>
      <div className="lg:col-span-2 xl:col-span-1"><CopilotCard /></div>
    </Reveal>

    <Reveal index={4} className={cn("grid gap-4 lg:grid-cols-2", data.sections.leaderboard ? "xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)]" : "xl:grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)]")}>
      <DashboardCard title="Pipeline" icon={ChartColumnBig} description="New leads by current stage">
        {leads.status === "error" ? <SectionError message={leads.message} />
          : leads.data.stages.length ? <PipelineColumns data={leads.data.stages} />
          : <SectionEmpty>No new leads in the last {rangeLabel}.</SectionEmpty>}
      </DashboardCard>
      {data.sections.leaderboard && <DashboardCard title="Agents" icon={UsersRound} description="New leads assigned, top 5">
        {leads.status === "error" ? <SectionError message={leads.message} />
          : leads.data.agents?.agents.length ? <>
            <RankedList rows={leads.data.agents.agents} total={summary?.totalLeads ?? 0} unit="leads" />
            {(leads.data.agents.others > 0 || leads.data.agents.unassigned > 0) && <p className="mt-4 text-xs text-muted-foreground">
              {[leads.data.agents.others > 0 && `${leads.data.agents.others} more agents`, leads.data.agents.unassigned > 0 && `${integer.format(leads.data.agents.unassigned)} unassigned`].filter(Boolean).join(" · ")}
            </p>}
          </>
          : <SectionEmpty>No assigned leads in the last {rangeLabel}.</SectionEmpty>}
      </DashboardCard>}
      <DashboardCard title="Quick shortcuts" icon={Zap} className={data.sections.leaderboard ? "lg:col-span-2 xl:col-span-1" : undefined}>
        <QuickShortcuts canManageInventory={data.canManageInventory} />
      </DashboardCard>
    </Reveal>
  </>;
}
