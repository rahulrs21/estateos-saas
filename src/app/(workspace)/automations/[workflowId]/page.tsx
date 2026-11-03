import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { WorkflowDetailView } from "@/modules/automations/components/workflow-detail";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Workflow", robots: { index: false, follow: false } };

type Params = Promise<{workflowId: string}>;
const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/** The view loads the workflow through the API, which re-checks company membership and role. */
async function AuthenticatedWorkflow({params}: {params: Params}) {
  const { activeCompany } = await requireCompanyWorkspace();
  const { workflowId } = await params;
  if (!UUID.test(workflowId)) notFound();
  return <WorkflowDetailView organizationId={activeCompany.id} workflowId={workflowId} />;
}

export default function WorkflowPage({params}: {params: Params}) {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedWorkflow params={params} /></Suspense>;
}
