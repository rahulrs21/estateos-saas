import { updateLineResponse } from "@/modules/communications/server/http";

export async function PUT(request: Request, {params}: {params: Promise<{lineId: string}>}) {
  return updateLineResponse(request, (await params).lineId);
}
