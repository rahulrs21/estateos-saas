import { disconnectResponse } from "@/modules/lead-ads/server/http";

/** Disconnects a Facebook Page (its leads stay). */
export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  return disconnectResponse(request, (await params).id);
}
