import { connectResponse } from "@/modules/campaigns/server/meta-http";

/** Phase 7F.2: starts Facebook's sign-in for ad accounts (ads_read only). */
export async function POST(request: Request) {
  return connectResponse(request);
}
