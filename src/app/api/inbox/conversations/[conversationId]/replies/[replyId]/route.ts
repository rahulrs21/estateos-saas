import { deleteReplyResponse, updateReplyResponse } from "@/modules/inbox/server/http";

type Params = {params: Promise<{conversationId: string; replyId: string}>};
export async function PUT(request: Request, {params}: Params) {
  const {conversationId, replyId} = await params;
  return updateReplyResponse(request, conversationId, replyId);
}
/** Deletes a reply that was never sent (its author, or an owner, administrator or manager). */
export async function DELETE(request: Request, {params}: Params) {
  const {conversationId, replyId} = await params;
  return deleteReplyResponse(request, conversationId, replyId);
}
