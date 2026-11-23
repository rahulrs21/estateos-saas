import { importResponse } from "@/modules/lead-ads/server/http";

/** Checks a connected Page's forms for leads from the last 7 days now. */
export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  return importResponse(request, (await params).id);
}
