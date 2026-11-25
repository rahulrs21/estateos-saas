import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireSession } from "@/lib/auth/session";
import { CampaignDetail, CampaignsAccess } from "@/modules/campaigns/components/campaign-pages";
import { getCampaignPage, type CampaignPageData } from "@/modules/campaigns/server/service";
import { WorkspaceError } from "@/modules/organizations/server/errors";

export const metadata: Metadata = { title: "Campaign" };
type Params = Promise<{ key: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Phase 7F.1: one campaign, its spend and its figures (docs/CAMPAIGNS_PLAN.md). */
async function CampaignContent({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  await requireSession();
  const { key } = await params;
  const query = Object.fromEntries(Object.entries(await searchParams).map(([name, value]) => [name, Array.isArray(value) ? value[0] : value]));
  let data: CampaignPageData;
  try {
    data = await getCampaignPage(decodeURIComponent(key), query);
  } catch (error) {
    if (error instanceof WorkspaceError) return <CampaignsAccess message={error.message} />;
    throw error;
  }
  return <CampaignDetail data={data} />;
}

export default function CampaignPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return <Suspense fallback={<PageSkeleton />}><CampaignContent params={params} searchParams={searchParams} /></Suspense>;
}
