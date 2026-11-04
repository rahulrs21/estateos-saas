import { simulatorEventResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{callId: string}>}) {
  return simulatorEventResponse(request, (await params).callId);
}
