import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { InventoryAccessState } from "@/modules/inventory/components/inventory-access-state";
import { DeveloperDetail } from "@/modules/inventory/components/inventory-records";
import { getDeveloperDetailData } from "@/modules/inventory/server/views";

export const metadata: Metadata = {title: "Developer details"};
type Params = Promise<{id: string}>;

async function Content({params}: {params: Params}) {
  const {id} = await params;
  let data: Awaited<ReturnType<typeof getDeveloperDetailData>> | null = null;
  let failure: WorkspaceError | null = null;
  try { data = await getDeveloperDetailData(id); }
  catch (error) { if (error instanceof WorkspaceError) failure = error; else throw error; }
  if (failure) return <InventoryAccessState error={failure} backHref="/developers" />;
  if (!data) throw new Error("Developer details were not loaded.");
  return <DeveloperDetail data={data} />;
}

export default function DeveloperDetailPage({params}: {params: Params}) { return <Suspense fallback={<main className="p-6"><PageSkeleton /></main>}><Content params={params} /></Suspense>; }
