import { connectionTemplatesResponse } from "@/modules/inbox/server/http";

type Params = {params: Promise<{connectionId: string}>};
/** The approved WhatsApp templates of a channel, for an owner or administrator starting a conversation (Phase 7B.2). */
export async function GET(request: Request, {params}: Params) { return connectionTemplatesResponse(request, (await params).connectionId); }
