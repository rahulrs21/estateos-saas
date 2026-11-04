import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { DevCommunicationTests } from "@/modules/communications/components/dev-communication-tests";
import { devToolsEnabled } from "@/modules/communications/dev/guard";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Communication tests (developer)", robots: { index: false, follow: false } };

async function AuthenticatedDevTests() {
  if (!devToolsEnabled()) notFound();
  const { activeCompany } = await requireCompanyWorkspace();
  const administrator = activeCompany.role === "OWNER" || activeCompany.role === "ADMIN";
  return <div className="space-y-5">
    <PageHeader eyebrow="Developer tools" title="Communication tests" description="Simulated calls on fictional leads and the Phase 6F verification results. Local emulators only; never available in production." />
    {administrator ? <DevCommunicationTests organizationId={activeCompany.id} />
      : <p className="rounded-lg border p-4 text-sm text-muted-foreground">Only owners and administrators can use the communication simulator.</p>}
  </div>;
}

export default function DevCommunicationTestsPage() {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedDevTests /></Suspense>;
}
