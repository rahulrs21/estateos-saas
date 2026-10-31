import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { NewPageWizard, type WizardInitial } from "@/modules/websites/components/new-page-wizard";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "New landing page", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const id = (value: string | string[] | undefined) => typeof value === "string" && UUID.test(value) ? value : undefined;

/** Query parameters only pre-fill the form; the server re-authorizes every record when the page is created. */
async function AuthenticatedNewPage({searchParams}: {searchParams: SearchParams}) {
  const { activeCompany } = await requireCompanyWorkspace();
  const params = await searchParams;
  const mode = typeof params.mode === "string" && ["AI", "TEMPLATE", "BLANK", "DUPLICATE"].includes(params.mode) ? params.mode as WizardInitial["mode"] : undefined;
  const initial: WizardInitial = {mode, projectId: id(params.projectId), listingId: id(params.listingId), propertyId: id(params.propertyId)};
  return <div className="space-y-5">
    <PageHeader eyebrow="Websites" title="New landing page" description="Choose a CRM record and start from Claude, a template, a blank page or an existing page. The page is created as a private draft." />
    <NewPageWizard organizationId={activeCompany.id} initial={initial} />
  </div>;
}

export default function NewLandingPage({searchParams}: {searchParams: SearchParams}) {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedNewPage searchParams={searchParams} /></Suspense>;
}
