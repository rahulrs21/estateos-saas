import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { InventoryAccessState } from "@/modules/inventory/components/inventory-access-state";
import { ProjectList } from "@/modules/inventory/components/inventory-lists";
import { getProjectListData } from "@/modules/inventory/server/views";

export const metadata: Metadata = {title: "Projects"};
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const value = (input: string | string[] | undefined) => typeof input === "string" ? input : "";

async function Content({searchParams}: {searchParams: SearchParams}) {
  const query = await searchParams;
  const search = value(query.search).trim();
  const status = value(query.status);
  const emirate = value(query.emirate);
  const developerId = value(query.developerId);
  const page = Math.max(1, Math.min(401, Number.parseInt(value(query.page) || "1", 10) || 1));
  let data: Awaited<ReturnType<typeof getProjectListData>> | null = null;
  let failure: WorkspaceError | null = null;
  try { data = await getProjectListData({search, status, emirate, developerId, page}); }
  catch (error) { if (error instanceof WorkspaceError) failure = error; else throw error; }
  if (failure) return <InventoryAccessState error={failure} />;
  if (!data) throw new Error("Project list was not loaded.");
  return <ProjectList data={data} search={search} status={status} emirate={emirate} developerId={developerId} />;
}

export default function ProjectsPage({searchParams}: {searchParams: SearchParams}) { return <Suspense fallback={<main className="p-6"><PageSkeleton /></main>}><Content searchParams={searchParams} /></Suspense>; }
