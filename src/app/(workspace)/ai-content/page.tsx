import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { CONTENT_TYPES, type ContentType } from "@/modules/ai/content/catalog";
import { ContentStudio, type StudioInitial } from "@/modules/ai/content/components/content-studio";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "AI Content Studio" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const id = (value: string | string[] | undefined) => typeof value === "string" && UUID.test(value) ? value : undefined;

/**
 * Query parameters only pre-fill the form (for example from a property page).
 * They grant nothing: the studio checks each record against the member's
 * access before showing it, and the server re-authorizes every ID on use.
 * Nothing is generated until the member clicks Generate.
 */
async function AuthenticatedStudio({searchParams}: {searchParams: SearchParams}) {
  const { activeCompany } = await requireCompanyWorkspace();
  const params = await searchParams;
  const type = typeof params.type === "string" && (CONTENT_TYPES as readonly string[]).includes(params.type) ? params.type as ContentType : undefined;
  const initial: StudioInitial = {
    contentType: type, purpose: typeof params.purpose === "string" ? params.purpose.slice(0, 40) : undefined,
    propertyId: id(params.propertyId), listingId: id(params.listingId), projectId: id(params.projectId), leadId: id(params.leadId), draftId: id(params.draft),
  };
  return <div className="space-y-5">
    <PageHeader eyebrow="Intelligence" title="AI Content Studio" description="Draft listing copy, project marketing, WhatsApp and email messages, social posts, ad copy and client proposals from your permitted CRM records. Every draft is editable and nothing is sent or published." />
    <ContentStudio organizationId={activeCompany.id} companyName={activeCompany.name} initial={initial} />
  </div>;
}

export default function AiContentPage({searchParams}: {searchParams: SearchParams}) {
  return <Suspense fallback={<PageSkeleton />}>
    <AuthenticatedStudio searchParams={searchParams} />
  </Suspense>;
}
