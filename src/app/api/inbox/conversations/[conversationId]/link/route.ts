import { linkResponse } from "@/modules/inbox/server/http";

export async function POST(request: Request, {params}: {params: Promise<{conversationId: string}>}) {
  return linkResponse(request, (await params).conversationId);
}
