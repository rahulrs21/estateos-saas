import { withdrawConsentResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{consentId: string}>}) {
  return withdrawConsentResponse(request, (await params).consentId);
}
