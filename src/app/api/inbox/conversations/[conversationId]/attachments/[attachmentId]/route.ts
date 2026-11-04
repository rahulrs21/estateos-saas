import { attachmentResponse } from "@/modules/inbox/server/http";

export async function GET(request: Request, {params}: {params: Promise<{conversationId: string; attachmentId: string}>}) {
  const {conversationId, attachmentId} = await params;
  return attachmentResponse(request, conversationId, attachmentId);
}
