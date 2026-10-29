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

export const metadata: Metadata = {title: "Edit project"};
type Params = Promise<{id: string}>;

async function Content({params}: {params: Params}) {
  const {id} = await params;
  let data: Awaited<ReturnType<typeof getProjectFormData>> | null = null;
  let failure: WorkspaceError | null = null;
  try { data = await getProjectFormData(id); }
  catch (error) { if (error instanceof WorkspaceError) failure = error; else throw error; }
  if (failure) return <InventoryAccessState error={failure} backHref="/projects" />;
  if (!data) throw new Error("Project form data was not loaded.");
  if (!data.project) return <InventoryAccessState error={new WorkspaceError("NOT_FOUND", 404, "This project is unavailable.")} backHref="/projects" />;
  if (!data.canManage) return <InventoryAccessState error={new WorkspaceError("FORBIDDEN", 403, "Only company owners and administrators can manage projects.")} backHref={`/projects/${data.project.id}`} />;
  return <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8"><Link href={`/projects/${data.project.id}`} className="text-sm text-muted-foreground hover:text-foreground">← Project details</Link><PageHeader eyebrow={data.company.name} title="Edit project" description="Update this project’s details and references." /><Card><CardContent className="p-5 sm:p-6"><ProjectForm company={data.company} project={data.project} developers={data.developers} amenities={data.amenities} /></CardContent></Card></div>;
}

export default function EditProjectPage({params}: {params: Params}) { return <Suspense fallback={<main className="p-6"><PageSkeleton /></main>}><Content params={params} /></Suspense>; }
