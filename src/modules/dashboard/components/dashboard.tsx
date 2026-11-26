import { Suspense } from "react";
import { LockKeyhole } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { DASHBOARD_TIME_ZONE, dashboardSections, type DashboardRange } from "../dashboard-model";
import { loadDashboard } from "../server/dashboard-data";
import { DashboardMap } from "./dashboard-map";
import { GreetingBanner } from "./greeting-banner";
import { InventoryMetrics } from "./inventory-metrics";
import { DashboardMotion, Reveal } from "./motion";
import { LeadSectionsView } from "./lead-sections";


export function Dashboard({firstName, range, scopeLabel}: {firstName: string | null; range: DashboardRange; scopeLabel: string}) {
  return <DashboardMotion>
    <div className="space-y-4">
      <Reveal index={0}><GreetingBanner firstName={firstName} range={range} scopeLabel={scopeLabel} serverNow={new Date().toISOString()} /></Reveal>
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
  return <LeadSectionsView data={await loadDashboard(range)} range={range} />;
}

async function InventorySection() {
  const {membership} = await requireActiveOrganizationRequest();
  const sections = dashboardSections(membership.role);
  return <InventoryMetrics map={sections.map ? <Suspense fallback={<Skeleton className="h-[26rem] rounded-xl" />}><DashboardMap /></Suspense> : undefined} />;
}

function LeadSectionsSkeleton() {
  return <div className="space-y-5" role="status" aria-label="Loading lead figures">
    <div className="space-y-3">
      <Skeleton className="h-4 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(item => <Skeleton key={item} className="h-[132px] rounded-xl" />)}</div>
    </div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]"><Skeleton className="h-[352px] rounded-xl" /><Skeleton className="h-[352px] rounded-xl" /></div>
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(item => <Skeleton key={item} className="h-80 rounded-xl" />)}</div>
  </div>;
}

function InventorySkeleton() {
  return <div className="space-y-3" role="status" aria-label="Loading inventory">
    <Skeleton className="h-5 w-32" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(item => <Skeleton key={item} className="h-[132px] rounded-xl" />)}</div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"><Skeleton className="h-[26rem] rounded-xl" /><Skeleton className="h-[26rem] rounded-xl" /></div>
  </div>;
}
