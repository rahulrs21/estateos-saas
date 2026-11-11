import Link from "next/link";
import { Settings } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";
import { InboxApp } from "./inbox-app";
import { StartWhatsAppConversation } from "./start-whatsapp";

/** The inbox page body (server): the company comes from the signed-in member's active workspace. */
export async function InboxPageBody({ conversationId }: { conversationId: string | null }) {
  const { activeCompany } = await requireCompanyWorkspace();
  return <div className="-mt-3 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><h1 className="text-xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-xs text-muted-foreground">WhatsApp, email and website enquiries in one place. Replies are sent only after approval.</p></div>
      <div className="flex flex-wrap items-center gap-2"><StartWhatsAppConversation organizationId={activeCompany.id} />
        <Link href="/inbox/settings" className={buttonVariants({variant: "outline", size: "sm"})}><Settings aria-hidden="true" />Inbox settings</Link></div>
    </div>
    <InboxApp organizationId={activeCompany.id} conversationId={conversationId} />
  </div>;
}
