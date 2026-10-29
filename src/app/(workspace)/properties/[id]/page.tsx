import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { InventoryAccessState } from "@/modules/inventory/components/inventory-access-state";
import { PropertyDetail, type PropertyRecord } from "@/modules/inventory/components/property-management";
import { getPropertyDetailData } from "@/modules/inventory/server/views";

export const metadata: Metadata = {title: "Property details"};
type Params = Promise<{id: string}>;
async function Content({params}: {params: Params}) {
  let data;
  try { data = await getPropertyDetailData((await params).id); }
  catch (error) { if (error instanceof WorkspaceError) return <InventoryAccessState error={error} backHref="/properties" />; throw error; }
  return <PropertyDetail {...data} property={data.property as PropertyRecord} />;
}
export default function PropertyDetailPage({params}: {params: Params}) { return <Suspense fallback={<main className="p-6"><PageSkeleton /></main>}><Content params={params} /></Suspense>; }
