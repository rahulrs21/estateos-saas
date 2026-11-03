import { recordConsentResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{callId: string}>}) {
  return recordConsentResponse(request, (await params).callId);
}
