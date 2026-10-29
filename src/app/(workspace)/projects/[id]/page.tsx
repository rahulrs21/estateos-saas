import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { InventoryAccessState } from "@/modules/inventory/components/inventory-access-state";
import { ProjectDetail, type ProjectDetailTab } from "@/modules/inventory/components/project-detail";
import { getProjectDetailData } from "@/modules/inventory/server/views";

export const metadata: Metadata = {title: "Project details"};
type Params = Promise<{id: string}>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const tabs: ProjectDetailTab[] = ["overview", "structure", "units", "floor-plans", "payment-plans", "documents", "activity"];

async function Content({params, searchParams}: {params: Params; searchParams: SearchParams}) {
  const {id} = await params;
  const query = await searchParams;
  const requestedTab = typeof query.tab === "string" ? query.tab : "overview";
  const selectedTab = tabs.includes(requestedTab as ProjectDetailTab) ? requestedTab as ProjectDetailTab : "overview";
  let data: Awaited<ReturnType<typeof getProjectDetailData>> | null = null;
  let failure: WorkspaceError | null = null;
  try { data = await getProjectDetailData(id); }
  catch (error) { if (error instanceof WorkspaceError) failure = error; else throw error; }
  if (failure) return <InventoryAccessState error={failure} backHref="/projects" />;
  if (!data) throw new Error("Project details were not loaded.");
  return <ProjectDetail data={data} selectedTab={selectedTab} />;
}

export default function ProjectDetailPage({params, searchParams}: {params: Params; searchParams: SearchParams}) {
  return <Suspense fallback={<main className="p-6"><PageSkeleton /></main>}><Content params={params} searchParams={searchParams} /></Suspense>;
}
