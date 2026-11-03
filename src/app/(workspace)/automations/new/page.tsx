import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { NewWorkflow } from "@/modules/automations/components/new-workflow";
import { listWorkflows } from "@/modules/automations/server/workflows";
import { aiConfiguration } from "@/modules/ai/server/anthropic";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "New workflow", robots: { index: false, follow: false } };

type Search = Promise<{template?: string | string[]}>;

async function AuthenticatedNewWorkflow({searchParams}: {searchParams: Search}) {
  const { activeCompany } = await requireCompanyWorkspace();
  const { agents } = await listWorkflows(await requireActiveOrganizationRequest(), {});
  const template = (await searchParams).template;
  return <div className="space-y-5">
    <PageHeader eyebrow="Automation" title="New workflow" description="Choose a template or start blank. Saving creates a draft; it runs only after review, approval and activation." />
    <NewWorkflow organizationId={activeCompany.id} agents={agents} initialTemplate={typeof template === "string" ? template : null} aiEnabled={aiConfiguration().ok} />
  </div>;
}

export default function NewWorkflowPage({searchParams}: {searchParams: Search}) {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedNewWorkflow searchParams={searchParams} /></Suspense>;
}
