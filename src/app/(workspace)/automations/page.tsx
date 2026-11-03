import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { AutomationsOverview } from "@/modules/automations/components/automations-overview";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Automation", robots: { index: false, follow: false } };

/** The page resolves only the verified company; every request is authorized again on the server. */
async function AuthenticatedAutomations() {
  await requireCompanyWorkspace();
  return <div className="space-y-5">
    <PageHeader eyebrow="Intelligence" title="Automation" description="Workflows that act on CRM events with your approval: assignments, tasks, reminders and internal notes. Nothing runs until it is reviewed, approved and activated, and workflows never message clients." />
    <AutomationsOverview />
  </div>;
}

export default function AutomationsPage() {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedAutomations /></Suspense>;
}
