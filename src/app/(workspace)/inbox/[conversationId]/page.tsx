import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { InboxPageBody } from "@/modules/inbox/components/inbox-page";

export const metadata: Metadata = { title: "Conversation", robots: { index: false, follow: false } };
type Params = Promise<{ conversationId: string }>;

async function Conversation({ params }: { params: Params }) {
  return <InboxPageBody conversationId={(await params).conversationId} />;
}

export default function ConversationPage({ params }: { params: Params }) {
  return <Suspense fallback={<PageSkeleton />}><Conversation params={params} /></Suspense>;
}
