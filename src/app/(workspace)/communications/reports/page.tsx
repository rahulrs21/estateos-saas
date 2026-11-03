import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { CommunicationReports } from "@/modules/communications/components/communication-reports";
import { CommunicationsTabs } from "@/modules/communications/components/communications-tabs";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Communication reports", robots: { index: false, follow: false } };

async function AuthenticatedReports() {
  const { activeCompany } = await requireCompanyWorkspace();
  return <div className="space-y-5">
    <PageHeader eyebrow="Communications" title="Reports" description="Calls and meetings from stored records. Attempts, answered calls, conversations and outcomes are counted separately." />
    <CommunicationsTabs current="reports" role={activeCompany.role} />
    <CommunicationReports />
  </div>;
}

export default function ReportsPage() {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedReports /></Suspense>;
}
