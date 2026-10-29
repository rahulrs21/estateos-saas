import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { InventoryAccessState } from "@/modules/inventory/components/inventory-access-state";
import { PortalSettings } from "@/modules/portals/components/portal-settings";
import { getPortalSettings } from "@/modules/portals/server/service";

export const metadata: Metadata = { title: "Property portals" };

async function PropertyPortalsContent() {
  let data;
  try { data = await getPortalSettings(); }
  catch (error) { if (error instanceof WorkspaceError) return <InventoryAccessState error={error} backHref="/settings/company" />; throw error; }
  return <div className="space-y-6">
    <PageHeader eyebrow="Company settings" title="Property portals" description="Prepare listings for Property Finder, Bayut and dubizzle. Review connection status, field mappings and export readiness." />
    <PortalSettings data={data} />
  </div>;
}

export default function PropertyPortalsPage() {
  return <Suspense fallback={<PageSkeleton />}><PropertyPortalsContent /></Suspense>;
}
