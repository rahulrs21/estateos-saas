import { getMeetingResponse, updateMeetingResponse } from "@/modules/communications/server/http";

type Params = {params: Promise<{meetingId: string}>};

export async function GET(request: Request, {params}: Params) {
  return getMeetingResponse(request, (await params).meetingId);
}

export async function PUT(request: Request, {params}: Params) {
  return updateMeetingResponse(request, (await params).meetingId);
}
