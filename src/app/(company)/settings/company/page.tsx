import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { CompanyForm } from "@/modules/organizations/components/company-form";
import { WorkspaceSwitcher } from "@/modules/organizations/components/workspace-switcher";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";
import { getCurrentOrganization } from "@/modules/organizations/server/service";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";

export const metadata: Metadata = { title: "Company settings" };

async function CompanySettings() {
  const workspace = await requireCompanyWorkspace();
  const { organization, membership } = await getCurrentOrganization();
  return <div className="mx-auto max-w-4xl space-y-6">
    <PageHeader title="Company settings" eyebrow={organization.name} description="Your company profile and workspace preferences." />
    <section aria-label="Company workspace selection" className="space-y-4 rounded-xl border bg-card p-5 sm:p-6"><WorkspaceSwitcher companies={workspace.companies} activeId={canonicalUuid(organization.id)} /><Link href="/onboarding/company?new=1" className="inline-block rounded text-sm font-medium text-primary">Create another company</Link></section>
    <CompanyForm key={organization.id} canEdit={["OWNER", "ADMIN"].includes(membership.role)} company={{
      id: canonicalUuid(organization.id), name: organization.name, slug: organization.slug,
      emirate: organization.emirate ?? null, contactPhone: organization.contactPhone ?? null,
      companyEmail: organization.companyEmail ?? null, companySize: organization.companySize ?? null,
    }} />
  </div>;
}
export default function CompanySettingsPage() {
  return <Suspense fallback={<PageSkeleton />}><CompanySettings /></Suspense>;
}
