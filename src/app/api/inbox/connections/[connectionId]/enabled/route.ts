import { connectionEnabledResponse } from "@/modules/inbox/server/http";

export async function POST(request: Request, {params}: {params: Promise<{connectionId: string}>}) {
  return connectionEnabledResponse(request, (await params).connectionId);
}
