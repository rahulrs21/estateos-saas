import { deleteRecordingResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{recordingId: string}>}) {
  return deleteRecordingResponse(request, (await params).recordingId);
}
