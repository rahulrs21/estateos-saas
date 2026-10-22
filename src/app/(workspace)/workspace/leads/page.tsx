import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireSession } from "@/lib/auth/session";
import { LeadsAccessState } from "@/modules/leads/components/leads-access-state";
import { LeadsList } from "@/modules/leads/components/leads-list";
import { getLeadsPageData } from "@/modules/leads/server/views";
import type { LeadListData } from "@/modules/leads/types";
import { WorkspaceError } from "@/modules/organizations/server/errors";

export const metadata: Metadata = { title: "Leads" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function LeadsContent({ searchParams }: { searchParams: SearchParams }) {
  await requireSession();
  let data: LeadListData;
  try {
    data = await getLeadsPageData(await searchParams);
  } catch (error) {
    if (error instanceof WorkspaceError) return <LeadsAccessState error={error} scope="list" />;
    throw error;
  }
  return <LeadsList data={data} />;
}

export default function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<PageSkeleton />}>
    <LeadsContent searchParams={searchParams} />
  </Suspense>;
}
