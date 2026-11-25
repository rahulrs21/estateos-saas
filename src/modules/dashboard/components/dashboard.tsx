import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { DASHBOARD_RANGES, DASHBOARD_TIME_ZONE, dashboardSections, type DashboardRange } from "../dashboard-model";
import { loadDashboard } from "../server/dashboard-data";
import { LeadVolumeChart, PipelineChart, Sparkline } from "./charts";
import { DashboardCard, RankedList, SectionEmpty, SectionError } from "./dashboard-card";
import { DashboardMap } from "./dashboard-map";
import { InventoryMetrics } from "./inventory-metrics";
import { KpiCard } from "./kpi-card";
import { DashboardMotion, Reveal } from "./motion";
import { RangeTabs } from "./range-tabs";
import { TaskAgenda } from "./task-agenda";

const integer = new Intl.NumberFormat("en-AE");
const percent = new Intl.NumberFormat("en-AE", {maximumFractionDigits: 1});
const period = new Intl.DateTimeFormat("en-AE", {day: "numeric", month: "short", year: "numeric", timeZone: "UTC"});
const formatPeriod = (from: string, to: string) => `${period.format(new Date(`${from}T00:00:00Z`))} – ${period.format(new Date(`${to}T00:00:00Z`))}`;

const linkClass = "inline-flex items-center gap-1 rounded font-medium text-primary hover:underline";

export function Dashboard({companyName, range}: {companyName: string; range: DashboardRange}) {
  return <DashboardMotion>
    <div className="space-y-6">
      <PageHeader eyebrow={companyName} title="Dashboard" description="Leads, pipeline, tasks and inventory at a glance.">
        <RangeTabs active={range} />
        <Link href="/leads" className={cn(buttonVariants({variant: "outline"}), "bg-card")}>View leads<ArrowRight aria-hidden="true" /></Link>
      </PageHeader>
      <Suspense key={range} fallback={<LeadSectionsSkeleton />}><LeadSections range={range} /></Suspense>
      <Suspense fallback={<InventorySkeleton />}><InventorySection /></Suspense>
      <p className="flex items-start gap-2 px-1 text-xs leading-5 text-muted-foreground">
        <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Figures include only records your role allows you to see. Lead figures cover leads created in the selected period; dates use {DASHBOARD_TIME_ZONE} time.
      </p>
    </div>
  </DashboardMotion>;
}

async function LeadSections({range}: {range: DashboardRange}) {
  const data = await loadDashboard(range);
  const {leads, pipeline, tasks} = data;
  const scope = data.sections.leadScope === "COMPANY" ? "All company leads" : "Leads assigned to you";
  const rangeLabel = DASHBOARD_RANGES[range].label;
  const summary = leads.status === "ok" ? leads.data.summary : null;
  const channelTotal = leads.status === "ok" ? leads.data.channels.reduce((sum, row) => sum + row.count, 0) : 0;

  return <>
    <Reveal index={0}>
      <p className="-mt-2 text-xs text-muted-foreground">{scope} · {formatPeriod(data.from, data.to)}</p>
    </Reveal>

    <Reveal index={1} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard title="New leads" value={summary?.totalLeads ?? null} href="/leads"
        detail={summary ? `${integer.format(summary.unassignedLeads)} unassigned · last ${rangeLabel}` : "Could not be loaded"}
        trailing={leads.status === "ok" && summary?.totalLeads ? <Sparkline data={leads.data.volume} /> : null} />
      <KpiCard title="Won" value={summary?.wonLeads ?? null} href="/leads?status=WON"
        detail={summary ? `${percent.format(summary.leadToWonPercent)}% of new leads in the period` : "Could not be loaded"} />
      <KpiCard title="In negotiation" value={pipeline.status === "ok" ? pipeline.data.negotiation : null} href="/leads?status=NEGOTIATION"
        detail={pipeline.status === "ok" ? "Open leads at negotiation stage, all dates" : "Could not be loaded"} />
      <KpiCard title="Tasks due in 7 days" value={tasks.status === "ok" ? tasks.data.dueNext7Days : null} href="/workspace/tasks"
        detail={tasks.status !== "ok" ? "Could not be loaded"
          : tasks.data.overdue ? <span className="font-medium text-destructive">{integer.format(tasks.data.overdue)}{tasks.data.truncated ? "+" : ""} overdue</span>
          : "Nothing overdue"} />
    </Reveal>

    <Reveal index={2} className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <DashboardCard title="Lead volume"
        description={leads.status === "ok" ? `${integer.format(summary?.totalLeads ?? 0)} new leads, per ${data.bucket}` : undefined}
        action={<Link href="/workspace/reports" className={linkClass}>Reports<ArrowRight className="size-3.5" aria-hidden="true" /></Link>}>
        {leads.status === "error" ? <SectionError message={leads.message} />
          : summary?.totalLeads ? <LeadVolumeChart data={leads.data.volume} bucket={data.bucket} />
          : <SectionEmpty>No new leads in the last {rangeLabel}.</SectionEmpty>}
      </DashboardCard>
      <DashboardCard title="Lead sources" description="New leads by channel">
        {leads.status === "error" ? <SectionError message={leads.message} />
          : leads.data.channels.length ? <RankedList rows={leads.data.channels.slice(0, 6)} total={channelTotal} unit="leads" />
          : <SectionEmpty>No new leads in the last {rangeLabel}.</SectionEmpty>}
      </DashboardCard>
    </Reveal>

    <Reveal index={3} className={cn("grid gap-4", data.sections.leaderboard ? "lg:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2")}>
      <DashboardCard title="Pipeline" description="New leads by current stage">
        {leads.status === "error" ? <SectionError message={leads.message} />
          : leads.data.stages.length ? <PipelineChart data={leads.data.stages} />
          : <SectionEmpty>No new leads in the last {rangeLabel}.</SectionEmpty>}
      </DashboardCard>
      {data.sections.leaderboard && <DashboardCard title="Agents" description="New leads assigned, top 5">
        {leads.status === "error" ? <SectionError message={leads.message} />
          : leads.data.agents?.agents.length ? <>
            <RankedList rows={leads.data.agents.agents} total={summary?.totalLeads ?? 0} unit="leads" />
            {(leads.data.agents.others > 0 || leads.data.agents.unassigned > 0) && <p className="mt-4 text-xs text-muted-foreground">
              {[leads.data.agents.others > 0 && `${leads.data.agents.others} more agents`, leads.data.agents.unassigned > 0 && `${integer.format(leads.data.agents.unassigned)} unassigned`].filter(Boolean).join(" · ")}
            </p>}
          </>
          : <SectionEmpty>No assigned leads in the last {rangeLabel}.</SectionEmpty>}
      </DashboardCard>}
      <DashboardCard title="Upcoming tasks" className={data.sections.leaderboard ? "lg:col-span-2 xl:col-span-1" : undefined}
        description={tasks.status === "ok" ? `${integer.format(tasks.data.items.length)}${tasks.data.truncated ? "+" : ""} open` : undefined}
        action={<Link href="/workspace/tasks" className={linkClass}>All tasks<ArrowRight className="size-3.5" aria-hidden="true" /></Link>}>
        {tasks.status === "error" ? <SectionError message={tasks.message} /> : <TaskAgenda items={tasks.data.items} />}
      </DashboardCard>
    </Reveal>
  </>;
}

async function InventorySection() {
  const {membership} = await requireActiveOrganizationRequest();
  const sections = dashboardSections(membership.role);
  return <InventoryMetrics map={sections.map ? <Suspense fallback={<Skeleton className="h-[26rem] rounded-xl" />}><DashboardMap /></Suspense> : undefined} />;
}

function LeadSectionsSkeleton() {
  return <div className="space-y-6" role="status" aria-label="Loading lead figures">
    <Skeleton className="-mt-2 h-4 w-56" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(item => <Skeleton key={item} className="h-[118px] rounded-xl" />)}</div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]"><Skeleton className="h-[330px] rounded-xl" /><Skeleton className="h-[330px] rounded-xl" /></div>
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(item => <Skeleton key={item} className="h-72 rounded-xl" />)}</div>
  </div>;
}

function InventorySkeleton() {
  return <div className="space-y-3" role="status" aria-label="Loading inventory">
    <Skeleton className="h-5 w-32" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(item => <Skeleton key={item} className="h-[118px] rounded-xl" />)}</div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"><Skeleton className="h-[26rem] rounded-xl" /><Skeleton className="h-[26rem] rounded-xl" /></div>
  </div>;
}
