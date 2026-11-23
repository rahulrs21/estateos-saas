import { metaLeadWebhookHandshakeResponse, metaLeadWebhookResponse } from "@/modules/lead-ads/server/webhook";

/** Meta's subscription check for the Page "leadgen" webhook. */
export async function GET(request: Request) {
  return metaLeadWebhookHandshakeResponse(request);
}

/** Signed lead notifications. No session: Meta's signature authenticates the request. */
export async function POST(request: Request) {
  return metaLeadWebhookResponse(request);
}
