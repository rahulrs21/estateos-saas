import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { InboxPageBody } from "@/modules/inbox/components/inbox-page";

export const metadata: Metadata = { title: "Inbox", robots: { index: false, follow: false } };

export default function InboxPage() {
  return <Suspense fallback={<PageSkeleton />}><InboxPageBody conversationId={null} /></Suspense>;
}
