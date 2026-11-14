import { sendNowResponse } from "@/modules/inbox/server/http";

/** The message box's Send: draft, check, and approve and send when the company does not require approval (otherwise it goes for approval). */
export async function POST(request: Request, {params}: {params: Promise<{conversationId: string}>}) {
  return sendNowResponse(request, (await params).conversationId);
}
