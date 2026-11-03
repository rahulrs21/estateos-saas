import { updateProviderResponse } from "@/modules/communications/server/http";

export async function PUT(request: Request, {params}: {params: Promise<{connectionId: string}>}) {
  return updateProviderResponse(request, (await params).connectionId);
}
