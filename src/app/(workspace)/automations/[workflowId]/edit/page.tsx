import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { EditWorkflow } from "@/modules/automations/components/edit-workflow";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Edit workflow", robots: { index: false, follow: false } };

type Params = Promise<{workflowId: string}>;
const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

async function AuthenticatedEdit({params}: {params: Params}) {
  const { activeCompany } = await requireCompanyWorkspace();
  const { workflowId } = await params;
  if (!UUID.test(workflowId)) notFound();
  return <div className="space-y-5">
    <PageHeader eyebrow="Automation" title="Edit workflow" description="Saving creates a new draft version. An approved version keeps running until the new one is approved." />
    <EditWorkflow organizationId={activeCompany.id} workflowId={workflowId} />
  </div>;
}

export default function EditWorkflowPage({params}: {params: Params}) {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedEdit params={params} /></Suspense>;
}
