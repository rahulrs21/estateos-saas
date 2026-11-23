import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { MetaLeadAdsSettings } from "@/modules/lead-ads/components/meta-lead-ads-settings";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { assertOrganizationAdministrator } from "@/modules/organizations/server/permission-policy";

export const metadata: Metadata = { title: "Meta Lead Ads" };

async function MetaLeadAdsContent() {
  const context = await requireActiveOrganizationRequest();
  assertOrganizationAdministrator(context.membership);
  return <div className="space-y-6">
    <PageHeader eyebrow="Company settings" title="Meta Lead Ads" description="Bring leads from Facebook and Instagram lead ads straight into EstateOS." />
    <MetaLeadAdsSettings organizationId={canonicalUuid(context.organizationId)} />
  </div>;
}

export default function MetaLeadAdsPage() {
  return <Suspense fallback={<PageSkeleton />}><MetaLeadAdsContent /></Suspense>;
}
