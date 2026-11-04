import { noteResponse } from "@/modules/inbox/server/http";

export async function POST(request: Request, {params}: {params: Promise<{conversationId: string}>}) {
  return noteResponse(request, (await params).conversationId);
}
