import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { CallList } from "@/modules/communications/components/call-list";
import { CommunicationsTabs } from "@/modules/communications/components/communications-tabs";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Calls", robots: { index: false, follow: false } };

async function AuthenticatedCalls() {
  const { activeCompany } = await requireCompanyWorkspace();
  return <div className="space-y-5">
    <PageHeader eyebrow="Communications" title="Calls" description="Every call you may see, newest first. Times are in Dubai." />
    <CommunicationsTabs current="calls" role={activeCompany.role} />
    <CallList organizationId={activeCompany.id} />
  </div>;
}

export default function CallsPage() {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedCalls /></Suspense>;
}
