import { connectionSendingResponse } from "@/modules/inbox/server/http";

export async function POST(request: Request, {params}: {params: Promise<{connectionId: string}>}) {
  return connectionSendingResponse(request, (await params).connectionId);
}
