import { messagesResponse } from "@/modules/inbox/server/http";

export async function GET(request: Request, {params}: {params: Promise<{conversationId: string}>}) {
  return messagesResponse(request, (await params).conversationId);
}
