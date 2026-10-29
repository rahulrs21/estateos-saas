import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { InventoryAccessState } from "@/modules/inventory/components/inventory-access-state";
import { DeveloperForm } from "@/modules/inventory/components/inventory-forms";
import { getDeveloperFormData } from "@/modules/inventory/server/views";

export const metadata: Metadata = {title: "Edit developer"};
type Params = Promise<{id: string}>;

async function Content({params}: {params: Params}) {
  const {id} = await params;
  let data: Awaited<ReturnType<typeof getDeveloperFormData>> | null = null;
  let failure: WorkspaceError | null = null;
  try { data = await getDeveloperFormData(id); }
  catch (error) { if (error instanceof WorkspaceError) failure = error; else throw error; }
  if (failure) return <InventoryAccessState error={failure} backHref="/developers" />;
  if (!data) throw new Error("Developer form data was not loaded.");
  if (!data.developer) return <InventoryAccessState error={new WorkspaceError("NOT_FOUND", 404, "This developer is unavailable.")} backHref="/developers" />;
  if (!data.canManage) return <InventoryAccessState error={new WorkspaceError("FORBIDDEN", 403, "Only company owners and administrators can manage developers.")} backHref={`/developers/${data.developer.id}`} />;
  return <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8"><Link href={`/developers/${data.developer.id}`} className="text-sm text-muted-foreground hover:text-foreground">← Developer details</Link><PageHeader eyebrow={data.company.name} title="Edit developer" description="Update the company information for this developer." /><Card><CardContent className="p-5 sm:p-6"><DeveloperForm company={data.company} developer={data.developer} /></CardContent></Card></div>;
}

export default function EditDeveloperPage({params}: {params: Params}) { return <Suspense fallback={<main className="p-6"><PageSkeleton /></main>}><Content params={params} /></Suspense>; }
