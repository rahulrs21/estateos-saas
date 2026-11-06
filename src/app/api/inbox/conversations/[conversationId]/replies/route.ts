import { createReplyResponse, repliesResponse } from "@/modules/inbox/server/http";

type Params = {params: Promise<{conversationId: string}>};
export async function GET(request: Request, {params}: Params) { return repliesResponse(request, (await params).conversationId); }
export async function POST(request: Request, {params}: Params) { return createReplyResponse(request, (await params).conversationId); }
