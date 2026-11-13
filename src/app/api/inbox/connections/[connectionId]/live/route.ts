import { connectionLiveResponse } from "@/modules/inbox/server/http";

type Params = {params: Promise<{connectionId: string}>};
/** Phase 7B.2: switches a WhatsApp channel to real customers (OWNER only) or back to test numbers (OWNER or ADMIN). */
export async function POST(request: Request, {params}: Params) { return connectionLiveResponse(request, (await params).connectionId); }
