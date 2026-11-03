import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { CommunicationSettingsView } from "@/modules/communications/components/communication-settings";
import { CommunicationsTabs } from "@/modules/communications/components/communications-tabs";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Communication settings", robots: { index: false, follow: false } };

async function AuthenticatedSettings() {
  const { activeCompany } = await requireCompanyWorkspace();
  return <div className="space-y-5">
    <PageHeader eyebrow="Communications" title="Calling settings" description="Calling rules, the do-not-call list, calling providers and company lines. Live calling stays off until a provider is verified and an owner or administrator confirms the arrangements." />
    <CommunicationsTabs current="settings" role={activeCompany.role} />
    <CommunicationSettingsView organizationId={activeCompany.id} />
  </div>;
}

export default function CommunicationSettingsPage() {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedSettings /></Suspense>;
}
