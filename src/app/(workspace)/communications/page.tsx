import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { CommunicationsDashboard } from "@/modules/communications/components/communications-dashboard";
import { CommunicationsTabs } from "@/modules/communications/components/communications-tabs";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Communications", robots: { index: false, follow: false } };

/** The page resolves only the verified company; every request is authorized again on the server. */
async function AuthenticatedCommunications() {
  const { activeCompany } = await requireCompanyWorkspace();
  return <div className="space-y-5">
    <PageHeader eyebrow="Operations" title="Communications" description="Calls with your customers from your company's records: what was attempted, answered and agreed, and what needs following up." />
    <CommunicationsTabs current="overview" role={activeCompany.role} />
    <CommunicationsDashboard />
  </div>;
}

export default function CommunicationsPage() {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedCommunications /></Suspense>;
}
