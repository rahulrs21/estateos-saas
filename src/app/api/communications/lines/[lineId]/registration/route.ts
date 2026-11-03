import { lineRegistrationResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{lineId: string}>}) {
  return lineRegistrationResponse(request, (await params).lineId);
}
