import { getConversationResponse } from "@/modules/inbox/server/http";

export async function GET(request: Request, {params}: {params: Promise<{conversationId: string}>}) {
  return getConversationResponse(request, (await params).conversationId);
}
