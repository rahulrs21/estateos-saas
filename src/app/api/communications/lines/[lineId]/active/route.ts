import { lineActiveResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{lineId: string}>}) {
  return lineActiveResponse(request, (await params).lineId);
}
