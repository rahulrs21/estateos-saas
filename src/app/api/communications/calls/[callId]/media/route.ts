import { callMediaResponse } from "@/modules/communications/server/http";

export async function GET(request: Request, {params}: {params: Promise<{callId: string}>}) {
  return callMediaResponse(request, (await params).callId);
}
