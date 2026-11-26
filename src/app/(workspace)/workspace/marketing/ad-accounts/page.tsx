import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireSession } from "@/lib/auth/session";
import { AdAccounts } from "@/modules/campaigns/components/ad-accounts";
import { CampaignsAccess } from "@/modules/campaigns/components/campaign-pages";
import { listMetaAdAccounts, type MetaAdAccountsView } from "@/modules/campaigns/server/meta-ads";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { WorkspaceError } from "@/modules/organizations/server/errors";

export const metadata: Metadata = { title: "Ad accounts" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Phase 7F.2: connected Meta ad accounts (owners and administrators; docs/CAMPAIGNS_PLAN.md). */
async function AdAccountsContent({ searchParams }: { searchParams: SearchParams }) {
  await requireSession();
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
  const kind = first(params.meta);
  let data: MetaAdAccountsView, organizationId: string;
  try {
    const context = await requireActiveOrganizationRequest();
    organizationId = canonicalUuid(context.organizationId);
    data = await listMetaAdAccounts(context);
  } catch (error) {
    if (error instanceof WorkspaceError) return <CampaignsAccess message={error.message} />;
    throw error;
  }
  const reason = first(params.reason);
  return <AdAccounts data={data} organizationId={organizationId}
    notice={{ kind: kind === "connected" || kind === "failed" ? kind : null, reason: reason && /^[A-Z0-9_]{1,60}$/.test(reason) ? reason : null }} />;
}

export default function AdAccountsPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<PageSkeleton />}><AdAccountsContent searchParams={searchParams} /></Suspense>;
}
