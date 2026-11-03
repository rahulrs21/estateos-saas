import { recordingContentResponse } from "@/modules/communications/server/http";

export async function GET(request: Request, {params}: {params: Promise<{recordingId: string}>}) {
  return recordingContentResponse(request, (await params).recordingId);
}
