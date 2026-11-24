import { retryResponse } from "@/modules/lead-ads/server/http";

/** Retries a Meta lead that could not be imported. */
export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  return retryResponse(request, (await params).id);
}
