import { reviewSummaryResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{summaryId: string}>}) {
  return reviewSummaryResponse(request, (await params).summaryId);
}
