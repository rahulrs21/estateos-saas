import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { getLeadDistributionSettings } from "@/modules/leads/distribution/service";
import { LeadDistributionSettings } from "@/modules/leads/distribution/components/lead-distribution-settings";

export const metadata: Metadata = { title: "Lead distribution" };

async function DistributionSettingsPageContent() {
  const data = await getLeadDistributionSettings();
  return <div className="space-y-6">
    <PageHeader eyebrow="Company settings" title="Lead distribution" description="Control how new leads reach your team, review assignment history and set agent availability." />
    <LeadDistributionSettings data={data} />
  </div>;
}

export default function DistributionSettingsPage() {
  return <Suspense fallback={<PageSkeleton />}><DistributionSettingsPageContent /></Suspense>;
}
