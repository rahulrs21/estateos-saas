import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { WebsitesOverview } from "@/modules/websites/components/websites-overview";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Websites", robots: { index: false, follow: false } };

/** The page resolves only the verified company; every request is authorized again on the server. */
async function AuthenticatedWebsites() {
  const { activeCompany } = await requireCompanyWorkspace();
  return <div className="space-y-5">
    <PageHeader eyebrow="Marketing" title="Websites" description="Landing pages built from your CRM records, with Claude-assisted design, a visual editor, review and publishing. Drafts are private; only approved, published pages are public." />
    <WebsitesOverview organizationId={activeCompany.id} />
  </div>;
}

export default function WebsitesPage() {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedWebsites /></Suspense>;
}
