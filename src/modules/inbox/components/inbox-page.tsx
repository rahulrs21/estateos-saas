import Link from "next/link";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";
import { InboxApp } from "./inbox-app";
import { StartWhatsAppConversation } from "./start-whatsapp";

/** The inbox page body (server): the company comes from the signed-in member's active workspace. */
export async function InboxPageBody({ conversationId }: { conversationId: string | null }) {
  const { activeCompany } = await requireCompanyWorkspace();
  return <div className="space-y-4">
    <PageHeader eyebrow="Communications" title="Inbox" description="Customer conversations you are allowed to see, from WhatsApp, email and website enquiries. Replies are sent only after approval, through a connected channel.">
      <StartWhatsAppConversation organizationId={activeCompany.id} />
      <Link href="/inbox/settings" className={buttonVariants({variant: "outline", size: "sm"})}><Settings aria-hidden="true" />Inbox settings</Link>
    </PageHeader>
    <InboxApp organizationId={activeCompany.id} conversationId={conversationId} />
  </div>;
}
