import { pendingActionResponse } from "@/modules/websites/server/http";

type Context = {params: Promise<{pendingId: string; action: string}>};

export async function POST(request: Request, context: Context) {
  const {pendingId, action} = await context.params;
  return pendingActionResponse(request, pendingId, action);
}
