import { connection } from "next/server";
import { deleteConversationResponse, getConversationResponse } from "@/modules/ai/server/http";

type Context = { params: Promise<{ conversationId: string }> };

export async function GET(request: Request, context: Context) {
  await connection();
  return getConversationResponse(request, (await context.params).conversationId);
}

export async function DELETE(request: Request, context: Context) {
  await connection();
  return deleteConversationResponse(request, (await context.params).conversationId);
}
