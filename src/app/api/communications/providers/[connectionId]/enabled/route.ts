import { providerEnabledResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{connectionId: string}>}) {
  return providerEnabledResponse(request, (await params).connectionId);
}
