import { createProviderResponse, providersResponse } from "@/modules/communications/server/http";

export async function GET(request: Request) {
  return providersResponse(request);
}

export async function POST(request: Request) {
  return createProviderResponse(request);
}
