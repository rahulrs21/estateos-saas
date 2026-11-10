import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { InboxSettingsView } from "@/modules/inbox/components/inbox-settings";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Inbox settings", robots: { index: false, follow: false } };

async function AuthenticatedSettings() {
  const { activeCompany } = await requireCompanyWorkspace();
  return <div className="space-y-5">
    <PageHeader eyebrow="Communications" title="Inbox settings" description="Inbox rules, mailboxes and channel accounts. A channel sends only once it is verified and sending is turned on, and in test mode only to the server's test recipients.">
      <Link href="/inbox" className={buttonVariants({variant: "outline", size: "sm"})}><ArrowLeft aria-hidden="true" />Back to inbox</Link>
    </PageHeader>
    <InboxSettingsView organizationId={activeCompany.id} />
  </div>;
}

export default function InboxSettingsPage() {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedSettings /></Suspense>;
}
