import { conversationTemplatesResponse } from "@/modules/inbox/server/http";

type Params = {params: Promise<{conversationId: string}>};
/** The approved WhatsApp templates of the conversation's channel, for a member who may see it (Phase 7B.2). */
export async function GET(request: Request, {params}: Params) { return conversationTemplatesResponse(request, (await params).conversationId); }
