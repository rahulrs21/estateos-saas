import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, FileSearch } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { InventoryAccessState } from "@/modules/inventory/components/inventory-access-state";
import { PortalExportPreview, PortalPreviewPicker } from "@/modules/portals/components/portal-export-preview";
import { getPortalExportPreview, getPortalSettings } from "@/modules/portals/server/service";
import { portalProviders } from "@/modules/portals/types";

export const metadata: Metadata = { title: "Portal export preview" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function PreviewContent({searchParams}: {searchParams: SearchParams}) {
  const params = await searchParams;
  const requested = typeof params.provider === "string" ? params.provider : "PROPERTY_FINDER";
  const provider = (portalProviders as readonly string[]).includes(requested) ? requested : "PROPERTY_FINDER";
  const listingId = typeof params.listingId === "string" ? params.listingId : undefined;
  let preview;
  try {
    // Confirms administrator access even before a listing is chosen.
    if (listingId) preview = await getPortalExportPreview({listingId, provider});
    else await getPortalSettings();
  } catch (error) {
    if (error instanceof WorkspaceError) return <InventoryAccessState error={error} backHref="/settings/property-portals" />;
    throw error;
  }
  return <div className="space-y-6">
    <PageHeader eyebrow="Property portals" title="Export preview" description="Inspect normalized listing data, validation results and the draft JSON or XML payload for each portal.">
      <Link href="/settings/property-portals" className={buttonVariants({variant: "outline", size: "sm"})}><ArrowLeft aria-hidden="true" />Portal settings</Link>
    </PageHeader>
    <PortalPreviewPicker provider={provider} listingId={listingId} />
    {preview ? <PortalExportPreview data={preview} /> : <EmptyState icon={FileSearch} title="Choose a listing to preview" description="Search for a listing above. The preview is internal and never creates a public feed." />}
  </div>;
}

export default function PortalPreviewPage({searchParams}: {searchParams: SearchParams}) {
  return <Suspense fallback={<PageSkeleton />}><PreviewContent searchParams={searchParams} /></Suspense>;
}
