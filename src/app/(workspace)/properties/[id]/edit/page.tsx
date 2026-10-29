import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { InventoryAccessState } from "@/modules/inventory/components/inventory-access-state";
import { PropertyForm, type PropertyRecord } from "@/modules/inventory/components/property-management";
import { getPropertyFormData } from "@/modules/inventory/server/views";

export const metadata: Metadata = {title: "Edit property"};
type Params = Promise<{id: string}>;
async function Content({params}: {params: Params}) {
  const {id} = await params;
  let data;
  try { data = await getPropertyFormData(id); }
  catch (error) { if (error instanceof WorkspaceError) return <InventoryAccessState error={error} backHref="/properties" />; throw error; }
  if (!data.canManage) return <InventoryAccessState error={new WorkspaceError("FORBIDDEN",403,"Only company administrators can change property inventory.")} backHref={`/properties/${id}`} />;
  return <main className="mx-auto w-full max-w-[1200px] space-y-6 p-4 sm:p-6 lg:p-8"><PageHeader eyebrow={data.company.name} title={`Edit ${data.property?.propertyReference ?? "property"}`} description="Update the company inventory record."/><PropertyForm {...data} property={data.property as PropertyRecord} /></main>;
}
export default function EditPropertyPage({params}: {params: Params}) { return <Suspense fallback={<main className="p-6"><PageSkeleton /></main>}><Content params={params} /></Suspense>; }
