import { connection } from "next/server";
import { evaluateResponse } from "@/modules/ai/sales/server/http";

type Context = {params: Promise<{leadId: string}>};

export async function POST(request: Request, context: Context) {
  await connection();
  return evaluateResponse(request, (await context.params).leadId);
}
