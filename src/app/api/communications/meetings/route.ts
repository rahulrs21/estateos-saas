import { createMeetingResponse, listMeetingsResponse } from "@/modules/communications/server/http";

export async function GET(request: Request) {
  return listMeetingsResponse(request);
}

export async function POST(request: Request) {
  return createMeetingResponse(request);
}
