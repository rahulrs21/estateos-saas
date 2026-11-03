import { uploadRecordingResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{callId: string}>}) {
  return uploadRecordingResponse(request, (await params).callId);
}
