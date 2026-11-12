import { mailboxStartResponse } from "@/modules/inbox/server/http";

/** Starts connecting a Microsoft 365 / Outlook mailbox: returns Microsoft's sign-in URL (EstateOS never asks for a password). */
export async function POST(request: Request) {
  return mailboxStartResponse(request, "MICROSOFT_365");
}
