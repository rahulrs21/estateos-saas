import { applyRequirementsResponse } from "@/modules/inbox/server/http";

export async function POST(request: Request, {params}: {params: Promise<{conversationId: string}>}) {
  return applyRequirementsResponse(request, (await params).conversationId);
}
