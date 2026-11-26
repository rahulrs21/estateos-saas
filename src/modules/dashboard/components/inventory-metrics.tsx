import type { ReactNode } from "react";
import { getInventoryDashboardMetrics, type GetInventoryDashboardMetricsData } from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { Building2, House, KeyRound, Megaphone } from "lucide-react";
import { DashboardCard, RankedList, SectionEmpty, SectionError } from "./dashboard-card";
import { KpiCard } from "./kpi-card";
import { Reveal } from "./motion";

const GROUP_LIMIT = 8;

function SectionHeading({scope}: {scope: string}) {
  return <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
    <h2 className="text-lg font-semibold">Inventory</h2>
    <p className="text-xs text-muted-foreground">{scope}. Archived records are excluded.</p>
  </div>;
}

/**
 * Current inventory in the member's scope (company-wide for OWNER/ADMIN,
 * assigned records for AGENT; not available to MANAGER). `map` is rendered
 * beside the breakdowns and streams in separately.
 */
export async function InventoryMetrics({map}: {map?: ReactNode}) {
  let data: GetInventoryDashboardMetricsData | undefined;
  let role: string;
  try {
    const {request, organizationId, membership} = await requireActiveOrganizationRequest();
    role = membership.role;
    if (role !== "MANAGER") data = await executeWorkspaceOperation(() => getInventoryDashboardMetrics(request.dc, {organizationId}, request.options), "GetInventoryDashboardMetrics");
  } catch (error) {
    if (!(error instanceof WorkspaceError)) throw error;
    return <section className="space-y-3" aria-label="Inventory"><SectionHeading scope="Inventory" /><SectionError message={error.message} /></section>;
  }
  if (!data) return <section className="space-y-3" aria-label="Inventory">
    <SectionHeading scope="Not available for your role" />
    <SectionEmpty>Inventory reporting requires a verified inventory scope. Contact your company owner to review your access.</SectionEmpty>
  </section>;

  const total = data.totalProperties[0]?.count ?? 0;
  const listings = data.totalListings[0]?.count ?? 0;
  const available = data.availableProperties[0]?.count ?? 0;
  const share = (count: number) => total ? `${Math.round(count / total * 100)}% of properties` : "No properties yet";
  const projects = data.propertiesByProject.slice(0, GROUP_LIMIT).map(row => ({label: row.project?.projectName ?? "Standalone properties", count: row.count}));
  const agents = data.listingsByAgent.slice(0, GROUP_LIMIT).map(row => ({label: row.assignedMembership?.userProfile?.displayName || row.assignedMembership?.email || "Unassigned", count: row.count}));
  const more = (count: number) => count > GROUP_LIMIT ? <p className="mt-4 text-xs text-muted-foreground">Top {GROUP_LIMIT} of {count} groups. Totals include every record in scope.</p> : null;

  return <section className="space-y-3" aria-label="Inventory">
    <SectionHeading scope={role === "AGENT" ? "Properties and listings assigned to you" : "Company inventory"} />
    <Reveal index={6} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard title="Properties" value={total} icon={Building2} tone="teal" detail={`${listings.toLocaleString("en-AE")} listings in total`} href="/properties" />
      <KpiCard title="Available" value={available} icon={House} tone="green" detail={share(available)} href="/properties?inventoryStatus=AVAILABLE" />
      <KpiCard title="Reserved" value={data.reservedProperties[0]?.count ?? 0} icon={KeyRound} tone="amber" detail={share(data.reservedProperties[0]?.count ?? 0)} href="/properties?inventoryStatus=RESERVED" />
      <KpiCard title="Active listings" value={data.activeListings[0]?.count ?? 0} icon={Megaphone} tone="blue" detail="Listings with status Active" href="/listings?listingStatus=ACTIVE" />
    </Reveal>
    <Reveal index={7} className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      {map}
      <div className={map ? "grid gap-4" : "grid gap-4 lg:grid-cols-2 xl:col-span-2"}>
        <DashboardCard title="Properties by project">
          {projects.length ? <RankedList rows={projects} total={total} unit="properties" /> : <SectionEmpty>No properties in your scope yet.</SectionEmpty>}
          {more(data.propertiesByProject.length)}
        </DashboardCard>
        <DashboardCard title="Listings by agent">
          {agents.length ? <RankedList rows={agents} total={listings} unit="listings" /> : <SectionEmpty>No listings in your scope yet.</SectionEmpty>}
          {more(data.listingsByAgent.length)}
        </DashboardCard>
      </div>
    </Reveal>
  </section>;
}
