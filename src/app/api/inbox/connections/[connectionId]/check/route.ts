import { connectionCheckResponse } from "@/modules/inbox/server/http";

/** The live check with the provider (Phase 7B): read-only; nothing is sent to anyone. */
export async function POST(request: Request, {params}: {params: Promise<{connectionId: string}>}) {
  return connectionCheckResponse(request, (await params).connectionId);
}
