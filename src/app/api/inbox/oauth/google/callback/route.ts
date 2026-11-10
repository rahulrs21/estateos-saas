import { oauthCallbackResponse } from "@/modules/inbox/server/http";

/** Google's OAuth return for connecting a mailbox (authenticated by the sealed state cookie). */
export async function GET(request: Request) {
  return oauthCallbackResponse(request);
}
