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

export const metadata: Metadata = {title: "Add developer"};

async function Content() {
  let data: Awaited<ReturnType<typeof getDeveloperFormData>> | null = null;
  let failure: WorkspaceError | null = null;
  try { data = await getDeveloperFormData(); }
  catch (error) { if (error instanceof WorkspaceError) failure = error; else throw error; }
  if (failure) return <InventoryAccessState error={failure} backHref="/developers" />;
  if (!data) throw new Error("Developer form data was not loaded.");
  if (!data.canManage) return <InventoryAccessState error={new WorkspaceError("FORBIDDEN", 403, "Only company owners and administrators can manage developers.")} />;
  return <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8"><Link href="/developers" className="text-sm text-muted-foreground hover:text-foreground">← Developers</Link><PageHeader eyebrow={data.company.name} title="Add a developer" description="Save the developer’s company details in your organization workspace." /><Card><CardContent className="p-5 sm:p-6"><DeveloperForm company={data.company} developer={null} /></CardContent></Card></div>;
}

export default function NewDeveloperPage() { return <Suspense fallback={<main className="p-6"><PageSkeleton /></main>}><Content /></Suspense>; }
