import { connection } from "next/server";
import { regenerateDraftResponse } from "@/modules/ai/content/server/generate";

type Context = { params: Promise<{ draftId: string }> };

export async function POST(request: Request, context: Context) {
  await connection();
  return regenerateDraftResponse(request, (await context.params).draftId);
}
