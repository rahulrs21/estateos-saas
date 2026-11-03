import { uploadTranscriptResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{callId: string}>}) {
  return uploadTranscriptResponse(request, (await params).callId);
}
