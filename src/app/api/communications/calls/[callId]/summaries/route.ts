import { callSummariesResponse, generateSummaryResponse } from "@/modules/communications/server/http";

type Params = {params: Promise<{callId: string}>};

export async function GET(request: Request, {params}: Params) {
  return callSummariesResponse(request, (await params).callId);
}

export async function POST(request: Request, {params}: Params) {
  return generateSummaryResponse(request, (await params).callId);
}
