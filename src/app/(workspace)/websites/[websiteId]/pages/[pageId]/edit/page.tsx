import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { EditorShell } from "@/modules/websites/components/editor/editor-shell";
import { pageFontVariables } from "@/modules/websites/fonts";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Page editor", robots: { index: false, follow: false } };

type Params = Promise<{websiteId: string; pageId: string}>;
const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/** The editor loads the page through the API, which re-checks company membership and page access. */
async function AuthenticatedEditor({params}: {params: Params}) {
  const { activeCompany } = await requireCompanyWorkspace();
  const { pageId } = await params;
  if (!UUID.test(pageId)) notFound();
  return <EditorShell organizationId={activeCompany.id} pageId={pageId} fontClassName={pageFontVariables} />;
}

export default function PageEditorRoute({params}: {params: Params}) {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedEditor params={params} /></Suspense>;
}
