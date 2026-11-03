import { addSuppressionResponse, suppressionsResponse } from "@/modules/communications/server/http";

export async function GET(request: Request) {
  return suppressionsResponse(request);
}

export async function POST(request: Request) {
  return addSuppressionResponse(request);
}