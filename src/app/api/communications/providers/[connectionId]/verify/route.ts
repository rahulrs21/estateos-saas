import { verifyProviderResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{connectionId: string}>}) {
  return verifyProviderResponse(request, (await params).connectionId);
}
