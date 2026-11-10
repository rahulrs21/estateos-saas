import { mailboxDisconnectResponse } from "@/modules/inbox/server/http";

/** Disconnects a mailbox: the grant is revoked at the provider and wiped. */
export async function POST(request: Request, {params}: {params: Promise<{mailboxId: string}>}) {
  return mailboxDisconnectResponse(request, (await params).mailboxId);
}
