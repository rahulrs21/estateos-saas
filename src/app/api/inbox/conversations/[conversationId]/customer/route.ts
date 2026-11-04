import { customerResponse } from "@/modules/inbox/server/http";

export async function GET(request: Request, {params}: {params: Promise<{conversationId: string}>}) {
  return customerResponse(request, (await params).conversationId);
}
