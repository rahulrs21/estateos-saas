import { meetingStatusResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{meetingId: string}>}) {
  return meetingStatusResponse(request, (await params).meetingId);
}
