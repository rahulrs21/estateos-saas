import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireSession } from "@/lib/auth/session";
import { CampaignsAccess, CampaignsList } from "@/modules/campaigns/components/campaign-pages";
import { getCampaignsPage, type CampaignsPageData } from "@/modules/campaigns/server/service";
import { WorkspaceError } from "@/modules/organizations/server/errors";

export const metadata: Metadata = { title: "Campaigns" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Phase 7F.1: campaigns and cost per lead (docs/CAMPAIGNS_PLAN.md). */
async function CampaignsContent({ searchParams }: { searchParams: SearchParams }) {
  await requireSession();
  const params = Object.fromEntries(Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  let data: CampaignsPageData;
  try {
    data = await getCampaignsPage(params);
  } catch (error) {
    if (error instanceof WorkspaceError) return <CampaignsAccess message={error.message} />;
    throw error;
  }
  return <CampaignsList data={data} />;
}

export default function MarketingPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<PageSkeleton />}><CampaignsContent searchParams={searchParams} /></Suspense>;
}
