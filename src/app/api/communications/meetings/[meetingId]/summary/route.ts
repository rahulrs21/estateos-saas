import { summarizeMeetingResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{meetingId: string}>}) {
  return summarizeMeetingResponse(request, (await params).meetingId);
}
