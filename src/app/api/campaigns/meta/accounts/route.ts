import { accountsResponse } from "@/modules/campaigns/server/meta-http";

/** Phase 7F.2: the company's connected Meta ad accounts (owners and administrators). */
export async function GET(request: Request) {
  return accountsResponse(request);
}
