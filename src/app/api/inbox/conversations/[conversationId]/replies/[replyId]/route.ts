import { updateReplyResponse } from "@/modules/inbox/server/http";

export async function PUT(request: Request, {params}: {params: Promise<{conversationId: string; replyId: string}>}) {
  const {conversationId, replyId} = await params;
  return updateReplyResponse(request, conversationId, replyId);
}
