import { disconnectResponse } from "@/modules/campaigns/server/meta-http";

type Context = { params: Promise<{ accountId: string }> };

/** Phase 7F.2: disconnects an ad account (its token is deleted; spend already read stays). */
export async function POST(request: Request, context: Context) {
  const { accountId } = await context.params;
  return disconnectResponse(request, accountId);
}
