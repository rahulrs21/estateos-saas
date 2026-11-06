import { replyActionResponse } from "@/modules/inbox/server/http";

/** check, submit, decide, cancel or send (anything else is not found). */
export async function POST(request: Request, {params}: {params: Promise<{conversationId: string; replyId: string; action: string}>}) {
  const {conversationId, replyId, action} = await params;
  return replyActionResponse(request, conversationId, replyId, action);
}
