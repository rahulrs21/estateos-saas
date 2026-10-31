import { pageResponse, savePageResponse } from "@/modules/websites/server/http";

type Context = {params: Promise<{pageId: string}>};

export async function GET(request: Request, context: Context) { return pageResponse(request, (await context.params).pageId); }
export async function PUT(request: Request, context: Context) { return savePageResponse(request, (await context.params).pageId); }
