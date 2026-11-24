import { dismissResponse } from "@/modules/lead-ads/server/http";

/** Dismisses a Meta lead that could not be imported. */
export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  return dismissResponse(request, (await params).id);
}
