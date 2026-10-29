import { connection } from "next/server";
import { getVersionResponse } from "@/modules/ai/content/server/http";

type Context = { params: Promise<{ draftId: string; versionNumber: string }> };

export async function GET(request: Request, context: Context) {
  await connection();
  const params = await context.params;
  return getVersionResponse(request, params.draftId, params.versionNumber);
}
