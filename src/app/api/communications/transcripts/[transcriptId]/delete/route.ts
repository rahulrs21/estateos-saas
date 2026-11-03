import { deleteTranscriptResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{transcriptId: string}>}) {
  return deleteTranscriptResponse(request, (await params).transcriptId);
}
