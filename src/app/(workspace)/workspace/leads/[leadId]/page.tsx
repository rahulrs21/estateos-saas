import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireSession } from "@/lib/auth/session";
import { LeadDetail } from "@/modules/leads/components/lead-detail";
import { LeadsAccessState } from "@/modules/leads/components/leads-access-state";
import { getLeadDetailData } from "@/modules/leads/server/views";
import type { LeadDetailData } from "@/modules/leads/types";
import { WorkspaceError } from "@/modules/organizations/server/errors";

export const metadata: Metadata = { title: "Lead details" };

type DetailProps = { params: Promise<{ leadId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function LeadDetailContent({ params, searchParams }: DetailProps) {
  await requireSession();
  let data: LeadDetailData;
  try {
    const { leadId } = await params;
    const query = await searchParams;
    data = await getLeadDetailData(leadId, query.activityPage, query.followUpPage);
  } catch (error) {
    if (error instanceof WorkspaceError) return <LeadsAccessState error={error} scope="detail" />;
    throw error;
  }
  return <LeadDetail data={data} />;
}

export default function LeadDetailPage(props: DetailProps) {
  return <Suspense fallback={<PageSkeleton />}><LeadDetailContent {...props} /></Suspense>;
}
