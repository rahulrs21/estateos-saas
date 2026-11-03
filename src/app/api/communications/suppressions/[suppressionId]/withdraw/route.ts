import { withdrawSuppressionResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{suppressionId: string}>}) {
  return withdrawSuppressionResponse(request, (await params).suppressionId);
}