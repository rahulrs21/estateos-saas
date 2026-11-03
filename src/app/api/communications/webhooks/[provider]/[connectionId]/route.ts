import { webhookResponse } from "@/modules/communications/server/http";

/** Signed provider callbacks (Twilio, Retell). No session: the provider's signature authenticates the request. */
export async function POST(request: Request, {params}: {params: Promise<{provider: string; connectionId: string}>}) {
  const {provider, connectionId} = await params;
  return webhookResponse(request, provider, connectionId);
}
