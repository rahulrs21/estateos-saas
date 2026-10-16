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

async function CreateLeadContent() {
  await requireSession();
  let data: LeadFormData;
  try {
    data = await getLeadFormData();
  } catch (error) {
    if (error instanceof WorkspaceError) return <LeadsAccessState error={error} />;
    throw error;
  }
  return <LeadForm key="new" data={data} />;
}

export default function CreateLeadPage() {
  return <Suspense fallback={<PageSkeleton />}><CreateLeadContent /></Suspense>;
}
