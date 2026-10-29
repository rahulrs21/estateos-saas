import { connection } from "next/server";
import { setDraftStatusResponse } from "@/modules/ai/content/server/http";

type Context = { params: Promise<{ draftId: string }> };

export async function POST(request: Request, context: Context) {
  await connection();
  return setDraftStatusResponse(request, (await context.params).draftId);
}
