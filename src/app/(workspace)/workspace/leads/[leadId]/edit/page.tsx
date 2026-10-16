import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireSession } from "@/lib/auth/session";
import { LeadForm } from "@/modules/leads/components/lead-form";
import { LeadsAccessState } from "@/modules/leads/components/leads-access-state";
import { getLeadFormData } from "@/modules/leads/server/views";
import type { LeadFormData } from "@/modules/leads/types";
import { WorkspaceError } from "@/modules/organizations/server/errors";

export const metadata: Metadata = { title: "Edit lead" };

type EditProps = { params: Promise<{ leadId: string }> };

async function EditLeadContent({ params }: EditProps) {
  await requireSession();
  let data: LeadFormData;
  try {
    const { leadId } = await params;
    data = await getLeadFormData(leadId);
  } catch (error) {
    if (error instanceof WorkspaceError) return <LeadsAccessState error={error} />;
    throw error;
  }
  return <LeadForm key={data.lead?.id} data={data} />;
}

export default function EditLeadPage(props: EditProps) {
  return <Suspense fallback={<PageSkeleton />}><EditLeadContent {...props} /></Suspense>;
}
