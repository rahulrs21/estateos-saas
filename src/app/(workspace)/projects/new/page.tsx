import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { InventoryAccessState } from "@/modules/inventory/components/inventory-access-state";
import { ProjectForm } from "@/modules/inventory/components/inventory-forms";
import { getProjectFormData } from "@/modules/inventory/server/views";

export const metadata: Metadata = {title: "Add project"};
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Content({searchParams}: {searchParams: SearchParams}) {
  let data: Awaited<ReturnType<typeof getProjectFormData>> | null = null;
  let failure: WorkspaceError | null = null;
  try { data = await getProjectFormData(); }
  catch (error) { if (error instanceof WorkspaceError) failure = error; else throw error; }
  if (failure) return <InventoryAccessState error={failure} backHref="/projects" />;
  if (!data) throw new Error("Project form data was not loaded.");
  const query = await searchParams;
  const requestedDeveloperId = typeof query.developerId === "string" ? query.developerId : "";
  const defaultDeveloperId = data.developers.find(developer => developer.id === requestedDeveloperId && developer.status === "ACTIVE")?.id;
  if (!data.canManage) return <InventoryAccessState error={new WorkspaceError("FORBIDDEN", 403, "Only company owners and administrators can manage projects.")} backHref="/projects" />;
  return <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8"><Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground">← Projects</Link><PageHeader eyebrow={data.company.name} title="Create a project" description="Capture the project identity, location, timeline, pricing and marketing information." /><Card><CardContent className="p-5 sm:p-6"><ProjectForm company={data.company} project={null} developers={data.developers} amenities={data.amenities} defaultDeveloperId={defaultDeveloperId} /></CardContent></Card></div>;
}

export default function NewProjectPage({searchParams}: {searchParams: SearchParams}) { return <Suspense fallback={<main className="p-6"><PageSkeleton /></main>}><Content searchParams={searchParams} /></Suspense>; }
