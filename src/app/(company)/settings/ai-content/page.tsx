import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { ContentSettings } from "@/modules/ai/content/components/content-settings";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "AI content settings" };

/** Everyone can read the approved brand details; only owners and administrators can change them (enforced on the server). */
async function Settings() {
  const { activeCompany } = await requireCompanyWorkspace();
  return <div className="mx-auto max-w-4xl space-y-6">
    <PageHeader title="AI content" eyebrow={activeCompany.name} description="Approved brand details and templates used by the AI Content Studio." />
    <ContentSettings organizationId={activeCompany.id} />
  </div>;
}

export default function AiContentSettingsPage() {
  return <Suspense fallback={<PageSkeleton />}><Settings /></Suspense>;
}
