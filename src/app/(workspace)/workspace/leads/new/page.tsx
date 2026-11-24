import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireSession } from "@/lib/auth/session";
import { LeadForm } from "@/modules/leads/components/lead-form";
import { LeadsAccessState } from "@/modules/leads/components/leads-access-state";
import { getLeadFormData } from "@/modules/leads/server/views";
import type { LeadFormData } from "@/modules/leads/types";
import { WorkspaceError } from "@/modules/organizations/server/errors";

export const metadata: Metadata = { title: "Create lead" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function CreateLeadContent({ searchParams }: { searchParams: SearchParams }) {
  await requireSession();
  // Phase 7E.2: Create lead from an inbox conversation (?conversation=…).
  const conversation = (await searchParams).conversation;
  let data: LeadFormData;
  try {
    data = await getLeadFormData(undefined, { fromConversationId: typeof conversation === "string" && conversation ? conversation : undefined });
  } catch (error) {
    if (error instanceof WorkspaceError) return <LeadsAccessState error={error} />;
    throw error;
  }
  return <LeadForm key="new" data={data} />;
}

export default function CreateLeadPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<PageSkeleton />}><CreateLeadContent searchParams={searchParams} /></Suspense>;
}
