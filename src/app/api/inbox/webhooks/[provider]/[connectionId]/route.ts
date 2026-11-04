import { webhookGetResponse, webhookPostResponse } from "@/modules/inbox/server/http";

type Params = {params: Promise<{provider: string; connectionId: string}>};

/** The provider's subscription handshake. */
export async function GET(request: Request, {params}: Params) {
  const {provider, connectionId} = await params;
  return webhookGetResponse(request, provider, connectionId);
}

/** Signed provider events. No session: the provider's signature authenticates the request. */
export async function POST(request: Request, {params}: Params) {
  const {provider, connectionId} = await params;
  return webhookPostResponse(request, provider, connectionId);
}
