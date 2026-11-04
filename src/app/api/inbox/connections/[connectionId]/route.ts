import { updateConnectionResponse } from "@/modules/inbox/server/http";

export async function PUT(request: Request, {params}: {params: Promise<{connectionId: string}>}) {
  return updateConnectionResponse(request, (await params).connectionId);
}
