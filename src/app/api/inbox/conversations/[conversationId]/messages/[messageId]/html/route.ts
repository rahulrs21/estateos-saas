import { messageHtmlResponse } from "@/modules/inbox/server/http";

/** An email's cleaned HTML for a member who may see the conversation (shown only in a sandboxed frame). */
export async function GET(request: Request, {params}: {params: Promise<{conversationId: string; messageId: string}>}) {
  const {conversationId, messageId} = await params;
  return messageHtmlResponse(request, conversationId, messageId);
}
