import { callbackResponse } from "@/modules/lead-ads/server/http";

/** Facebook's return after sign-in (authenticated by the sealed state cookie, not the session). */
export async function GET(request: Request) {
  return callbackResponse(request);
}
