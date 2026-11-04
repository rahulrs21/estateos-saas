import { stateResponse } from "@/modules/inbox/server/http";

export async function POST(request: Request, {params}: {params: Promise<{conversationId: string}>}) {
  return stateResponse(request, (await params).conversationId);
}
