import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { ApprovalsView } from "@/modules/automations/components/approvals-view";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Approvals", robots: { index: false, follow: false } };

/** The page resolves only the verified company; the list and every decision are authorized again on the server. */
async function AuthenticatedApprovals() {
  const { activeCompany } = await requireCompanyWorkspace();
  return <div className="space-y-5">
    <PageHeader eyebrow="Automation" title="Approvals" description="Workflow steps that wait for a person. Approving applies exactly the change shown; if the record changed in the meantime, EstateOS asks again instead of applying it." />
    <ApprovalsView organizationId={activeCompany.id} />
  </div>;
}

export default function ApprovalsPage() {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedApprovals /></Suspense>;
}
