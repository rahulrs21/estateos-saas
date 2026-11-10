import { mailboxStartResponse } from "@/modules/inbox/server/http";

/** Starts connecting a Gmail mailbox: returns Google's consent URL (EstateOS never asks for a password). */
export async function POST(request: Request) {
  return mailboxStartResponse(request);
}
