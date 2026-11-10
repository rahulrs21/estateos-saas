import { mailboxSyncResponse } from "@/modules/inbox/server/http";

/** "Check now": imports new mail from a connected mailbox (rate-limited). */
export async function POST(request: Request, {params}: {params: Promise<{mailboxId: string}>}) {
  return mailboxSyncResponse(request, (await params).mailboxId);
}
