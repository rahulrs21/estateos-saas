import { readMarkResponse } from "@/modules/inbox/server/http";

export async function POST(request: Request, {params}: {params: Promise<{conversationId: string}>}) {
  return readMarkResponse(request, (await params).conversationId);
}
