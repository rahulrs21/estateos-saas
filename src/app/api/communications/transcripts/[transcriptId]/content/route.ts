import { transcriptContentResponse } from "@/modules/communications/server/http";

export async function GET(request: Request, {params}: {params: Promise<{transcriptId: string}>}) {
  return transcriptContentResponse(request, (await params).transcriptId);
}
