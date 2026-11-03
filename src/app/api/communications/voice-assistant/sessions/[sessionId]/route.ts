import { voiceTestSessionResponse } from "@/modules/communications/server/http";

export async function GET(request: Request, {params}: {params: Promise<{sessionId: string}>}) {
  return voiceTestSessionResponse(request, (await params).sessionId);
}
