import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { CommunicationsTabs } from "@/modules/communications/components/communications-tabs";
import { MeetingDetail } from "@/modules/communications/components/meetings";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Meeting", robots: { index: false, follow: false } };
type Params = Promise<{ meetingId: string }>;

async function AuthenticatedMeeting({ params }: { params: Params }) {
  const { activeCompany } = await requireCompanyWorkspace();
  return <div className="space-y-5">
    <PageHeader eyebrow="Communications" title="Meeting" description="Details, notes and an optional Claude summary of the notes." />
    <CommunicationsTabs current="meetings" role={activeCompany.role} />
    <MeetingDetail meetingId={(await params).meetingId} organizationId={activeCompany.id} />
  </div>;
}

export default function MeetingPage({ params }: { params: Params }) {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedMeeting params={params} /></Suspense>;
}
