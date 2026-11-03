import { voiceTurnResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{sessionId: string}>}) {
  return voiceTurnResponse(request, (await params).sessionId);
}
