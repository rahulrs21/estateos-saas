import { connection } from "next/server";
import { analyzeResponse } from "@/modules/ai/sales/server/http";

type Context = {params: Promise<{leadId: string}>};

export async function POST(request: Request, context: Context) {
  await connection();
  return analyzeResponse(request, (await context.params).leadId);
}
