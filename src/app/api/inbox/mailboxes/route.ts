import { mailboxesResponse } from "@/modules/inbox/server/http";

/** Company and personal mailboxes the member may see (never a token). */
export async function GET(request: Request) {
  return mailboxesResponse(request);
}
