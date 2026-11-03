import { listCallsResponse, logCallResponse } from "@/modules/communications/server/http";

export async function GET(request: Request) {
  return listCallsResponse(request);
}

export async function POST(request: Request) {
  return logCallResponse(request);
}
