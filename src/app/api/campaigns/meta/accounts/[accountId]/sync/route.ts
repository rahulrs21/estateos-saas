import { syncResponse } from "@/modules/campaigns/server/meta-http";

type Context = { params: Promise<{ accountId: string }> };

/** Phase 7F.2: reads an ad account's recent spend now. */
export async function POST(request: Request, context: Context) {
  const { accountId } = await context.params;
  return syncResponse(request, accountId);
}
