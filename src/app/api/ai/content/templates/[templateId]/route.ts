import { connection } from "next/server";
import { deleteTemplateResponse, updateTemplateResponse } from "@/modules/ai/content/server/http";

type Context = { params: Promise<{ templateId: string }> };

export async function PATCH(request: Request, context: Context) {
  await connection();
  return updateTemplateResponse(request, (await context.params).templateId);
}

export async function DELETE(request: Request, context: Context) {
  await connection();
  return deleteTemplateResponse(request, (await context.params).templateId);
}
