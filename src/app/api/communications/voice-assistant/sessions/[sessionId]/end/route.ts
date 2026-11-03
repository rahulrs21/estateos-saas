import { endVoiceTestResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{sessionId: string}>}) {
  return endVoiceTestResponse(request, (await params).sessionId);
}
