import { leadCallsResponse } from "@/modules/communications/server/http";

export async function GET(request: Request, {params}: {params: Promise<{leadId: string}>}) {
  return leadCallsResponse(request, (await params).leadId);
}