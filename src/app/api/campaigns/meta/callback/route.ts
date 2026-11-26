import { callbackResponse } from "@/modules/campaigns/server/meta-http";

/** Phase 7F.2: Facebook's return after sign-in (authenticated by the sealed state cookie, not the session). */
export async function GET(request: Request) {
  return callbackResponse(request);
}
