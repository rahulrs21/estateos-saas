import { connection } from "next/server";
import { deleteDraftResponse, getDraftResponse, saveDraftResponse } from "@/modules/ai/content/server/http";

type Context = { params: Promise<{ draftId: string }> };

export async function GET(request: Request, context: Context) {
  await connection();
  return getDraftResponse(request, (await context.params).draftId);
}

export async function PATCH(request: Request, context: Context) {
  await connection();
  return saveDraftResponse(request, (await context.params).draftId);
}

export async function DELETE(request: Request, context: Context) {
  await connection();
  return deleteDraftResponse(request, (await context.params).draftId);
}
