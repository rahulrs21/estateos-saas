import { assistantResponse } from "@/modules/inbox/server/http";

export async function POST(request: Request, {params}: {params: Promise<{conversationId: string}>}) {
  return assistantResponse(request, (await params).conversationId);
}
