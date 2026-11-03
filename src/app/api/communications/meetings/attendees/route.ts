import { meetingAttendeesResponse } from "@/modules/communications/server/http";

export async function GET(request: Request) {
  return meetingAttendeesResponse(request);
}
