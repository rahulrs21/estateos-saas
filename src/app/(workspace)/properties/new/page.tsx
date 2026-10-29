import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { InventoryAccessState } from "@/modules/inventory/components/inventory-access-state";
import { PropertyForm } from "@/modules/inventory/components/property-management";
import { getPropertyFormData } from "@/modules/inventory/server/views";

export const metadata: Metadata = {title: "Add property"};
async function Content() {
  let data;
  try {
    data = await getPropertyFormData();
  } catch (error) { if (error instanceof WorkspaceError) return <InventoryAccessState error={error} backHref="/properties" />; throw error; }
  if (!data.canManage) return <InventoryAccessState error={new WorkspaceError("FORBIDDEN",403,"Only company administrators can create inventory records.")} backHref="/properties" />;
  return <main className="mx-auto w-full max-w-[1200px] space-y-6 p-4 sm:p-6 lg:p-8"><PageHeader eyebrow={data.company.name} title="Add property" description="Create a private inventory record in five steps."/><PropertyForm {...data} property={null} /></main>;
}
export default function NewPropertyPage() { return <Suspense fallback={<main className="p-6"><PageSkeleton /></main>}><Content /></Suspense>; }
