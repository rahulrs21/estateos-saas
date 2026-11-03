import { interruptVoiceTurnResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{sessionId: string}>}) {
  return interruptVoiceTurnResponse(request, (await params).sessionId);
}
