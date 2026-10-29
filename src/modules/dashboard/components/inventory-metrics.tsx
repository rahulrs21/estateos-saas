import { getInventoryDashboardMetrics, type GetInventoryDashboardMetricsData } from "@dataconnect/admin-generated";
import { Building2, House, KeyRound, Megaphone } from "lucide-react";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function Breakdown({title, rows, total, hasMore}: {title: string; rows: {id: string; name: string; count: number}[]; total: number; hasMore: boolean}) {
  return <Card className="shadow-xs ring-border"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{rows.length ? <ul className="space-y-4">{rows.map(row => <li key={row.id}><div className="flex items-start justify-between gap-4 text-sm"><span className="break-words">{row.name}</span><span className="font-semibold tabular-nums">{row.count.toLocaleString("en-AE")}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-primary" style={{width: `${total ? row.count / total * 100 : 0}%`}} /></div></li>)}</ul> : <p className="text-sm text-muted-foreground">No records in your inventory scope yet.</p>}{hasMore && <p className="mt-4 text-xs text-muted-foreground">Showing the first 20 groups. Summary totals include all authorized records.</p>}</CardContent></Card>;
}

export async function InventoryMetrics() {
  let data: GetInventoryDashboardMetricsData | undefined;
  let role: string;
  try {
    const {request, organizationId, membership} = await requireActiveOrganizationRequest();
    role = membership.role;
    if (role !== "MANAGER") data = await executeWorkspaceOperation(() => getInventoryDashboardMetrics(request.dc, {organizationId}, request.options), "GetInventoryDashboardMetrics");
  } catch (error) {
    if (!(error instanceof WorkspaceError)) throw error;
    return <Card><CardHeader><CardTitle>Inventory overview unavailable</CardTitle></CardHeader><CardContent><p role="alert" className="text-sm text-muted-foreground">{error.message}</p></CardContent></Card>;
  }
  if (!data) return <Card><CardHeader><CardTitle>Inventory overview</CardTitle><CardDescription>Inventory reporting requires a verified inventory scope. Contact your company owner to review your access.</CardDescription></CardHeader></Card>;
    const total = data.totalProperties[0]?.count ?? 0;
    const listings = data.totalListings[0]?.count ?? 0;
    const metrics = [
      {title: "Total properties", count: total, icon: Building2},
      {title: "Available properties", count: data.availableProperties[0]?.count ?? 0, icon: House},
      {title: "Reserved units", count: data.reservedProperties[0]?.count ?? 0, icon: KeyRound},
      {title: "Active listings", count: data.activeListings[0]?.count ?? 0, icon: Megaphone},
    ];
    return <section className="space-y-4" aria-label="Inventory overview"><div><h2 className="text-lg font-semibold">Inventory overview</h2><p className="mt-1 text-xs text-muted-foreground">Current {role === "AGENT" ? "assigned inventory" : "company inventory"}. Archived records are excluded. Listings by agent includes every non-archived listing status.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({title, count, icon: Icon}) => <Card key={title} className="shadow-xs ring-border"><CardContent><div className="flex items-center justify-between gap-2"><h3 className="text-xs text-muted-foreground">{title}</h3><Icon className="size-5 text-primary" aria-hidden="true" /></div><p className="mt-4 text-3xl font-semibold tabular-nums">{count.toLocaleString("en-AE")}</p></CardContent></Card>)}</div><div className="grid gap-5 lg:grid-cols-2"><Breakdown title="Properties by project" total={total} hasMore={data.propertiesByProject.length > 20} rows={data.propertiesByProject.slice(0, 20).map(row => ({id: row.projectId ?? "standalone", name: row.project?.projectName ?? "Standalone properties", count: row.count}))} /><Breakdown title="Listings by agent" total={listings} hasMore={data.listingsByAgent.length > 20} rows={data.listingsByAgent.slice(0, 20).map(row => ({id: row.assignedMembershipId ?? "unassigned", name: row.assignedMembership?.userProfile?.displayName || row.assignedMembership?.email || "Unassigned", count: row.count}))} /></div></section>;
}
