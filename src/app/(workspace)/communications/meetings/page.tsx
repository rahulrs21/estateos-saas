import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { CommunicationsTabs } from "@/modules/communications/components/communications-tabs";
import { MeetingList } from "@/modules/communications/components/meetings";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Meetings", robots: { index: false, follow: false } };

async function AuthenticatedMeetings() {
  const { activeCompany } = await requireCompanyWorkspace();
  return <div className="space-y-5">
    <PageHeader eyebrow="Communications" title="Meetings" description="Meetings with leads and contacts that you organize, attend or that concern your leads. The video call itself opens in the provider's app." />
    <CommunicationsTabs current="meetings" role={activeCompany.role} />
    <MeetingList />
  </div>;
}

export default function MeetingsPage() {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedMeetings /></Suspense>;
}
