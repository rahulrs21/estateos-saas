import { contactCallsResponse } from "@/modules/communications/server/http";

export async function GET(request: Request, {params}: {params: Promise<{contactId: string}>}) {
  return contactCallsResponse(request, (await params).contactId);
}