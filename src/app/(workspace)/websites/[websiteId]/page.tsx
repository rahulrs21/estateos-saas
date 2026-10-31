import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { WebsitesOverview } from "@/modules/websites/components/websites-overview";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Website settings", robots: { index: false, follow: false } };

/** One website per company in this release; the ID in the address is informational and grants nothing. */
async function AuthenticatedWebsite() {
  const { activeCompany } = await requireCompanyWorkspace();
  return <div className="space-y-5">
    <PageHeader eyebrow="Websites" title="Website" description="Settings for your company website and its landing pages." />
    <WebsitesOverview organizationId={activeCompany.id} view="settings" />
  </div>;
}

export default function WebsitePage() {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedWebsite /></Suspense>;
}
