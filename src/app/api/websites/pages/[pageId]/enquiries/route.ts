import { enquiriesResponse } from "@/modules/websites/server/http";

type Context = {params: Promise<{pageId: string}>};

export async function GET(request: Request, context: Context) { return enquiriesResponse(request, (await context.params).pageId); }
