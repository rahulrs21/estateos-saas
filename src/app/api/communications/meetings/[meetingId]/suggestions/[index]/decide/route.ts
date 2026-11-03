import { decideMeetingSuggestionResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{meetingId: string; index: string}>}) {
  const {meetingId, index} = await params;
  return decideMeetingSuggestionResponse(request, meetingId, index);
}
