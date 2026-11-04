import { connectionsResponse, createConnectionResponse } from "@/modules/inbox/server/http";

export async function GET(request: Request) {
  return connectionsResponse(request);
}

export async function POST(request: Request) {
  return createConnectionResponse(request);
}
