import { connection } from "next/server";
import { restoreVersionResponse } from "@/modules/ai/content/server/http";

type Context = { params: Promise<{ draftId: string }> };

export async function POST(request: Request, context: Context) {
  await connection();
  return restoreVersionResponse(request, (await context.params).draftId);
}
