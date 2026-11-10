import { mailboxSendingResponse } from "@/modules/inbox/server/http";

/** Sending on or off for a connected mailbox (Phase 7C.1: test recipients only). */
export async function POST(request: Request, {params}: {params: Promise<{mailboxId: string}>}) {
  return mailboxSendingResponse(request, (await params).mailboxId);
}
