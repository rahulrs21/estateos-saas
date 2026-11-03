import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { MyTasksView } from "@/modules/automations/components/my-tasks";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Tasks" };

async function AuthenticatedTasks() {
  const { activeCompany } = await requireCompanyWorkspace();
  return <div className="space-y-5">
    <PageHeader eyebrow="Operations" title="My tasks" description="Your open lead follow-ups and work tasks, including those created by approved workflows. Managers also see the team queue." />
    <MyTasksView organizationId={activeCompany.id} />
  </div>;
}

export default function TasksPage() {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedTasks /></Suspense>;
}
