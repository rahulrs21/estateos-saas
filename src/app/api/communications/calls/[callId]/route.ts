import { getCallResponse, updateCallResponse } from "@/modules/communications/server/http";

type Params = {params: Promise<{callId: string}>};

export async function GET(request: Request, {params}: Params) {
  return getCallResponse(request, (await params).callId);
}

export async function PUT(request: Request, {params}: Params) {
  return updateCallResponse(request, (await params).callId);
}