import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { CallDetail } from "@/modules/communications/components/call-detail";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Call details", robots: { index: false, follow: false } };
type Params = Promise<{ callId: string }>;

async function AuthenticatedCall({ params }: { params: Params }) {
  const { activeCompany } = await requireCompanyWorkspace();
  return <CallDetail callId={(await params).callId} organizationId={activeCompany.id} />;
}

export default function CallPage({ params }: { params: Params }) {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedCall params={params} /></Suspense>;
}
