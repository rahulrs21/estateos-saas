import { assignResponse } from "@/modules/inbox/server/http";

export async function POST(request: Request, {params}: {params: Promise<{conversationId: string}>}) {
  return assignResponse(request, (await params).conversationId);
}
