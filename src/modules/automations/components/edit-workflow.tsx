"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { automationsGet, errorMessage, type WorkflowDetail, type WorkflowList } from "../client";
import { WorkflowEditor } from "./workflow-editor";

/** Loads the current version for editing; the server decides whether the member may edit it. */
export function EditWorkflow({workflowId, organizationId}: {workflowId: string; organizationId: string}) {
  const [data, setData] = useState<{detail: WorkflowDetail; agents: WorkflowList["agents"]} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => Promise.all([automationsGet<WorkflowDetail>(`/api/automations/${workflowId}`), automationsGet<WorkflowList>("/api/automations")])
    .then(([detail, list]) => { setData({detail, agents: list.agents}); setError(null); }, cause => setError(errorMessage(cause, "The workflow could not be loaded."))), [workflowId]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <EmptyState icon={AlertTriangle} title="The workflow could not be loaded" description={error}><Button variant="outline" onClick={() => { setError(null); void load(); }}>Try again</Button></EmptyState>;
  if (!data) return <PageSkeleton />;
  const {workflow, permissions} = data.detail;
  if (!permissions.edit) return <EmptyState icon={Lock} title="You can't edit this workflow" description="Drafts can be edited by their author; owners and administrators can edit any workflow that is not archived.">
    <Link className={buttonVariants({variant: "outline"})} href={`/automations/${workflowId}`}>Back to the workflow</Link>
  </EmptyState>;
  return <WorkflowEditor organizationId={organizationId} workflowId={workflowId} initial={workflow.definition} revision={workflow.revision} currentVersionNumber={workflow.currentVersionNumber} agents={data.agents} />;
}
