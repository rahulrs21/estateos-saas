import { pageActionResponse } from "@/modules/websites/server/http";

type Context = {params: Promise<{pageId: string; action: string}>};

export async function POST(request: Request, context: Context) {
  const {pageId, action} = await context.params;
  return pageActionResponse(request, pageId, action);
}
