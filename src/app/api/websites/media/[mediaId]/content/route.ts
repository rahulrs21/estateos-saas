import { mediaContentResponse } from "@/modules/websites/server/http";

type Context = {params: Promise<{mediaId: string}>};

export async function GET(request: Request, context: Context) { return mediaContentResponse(request, (await context.params).mediaId); }
