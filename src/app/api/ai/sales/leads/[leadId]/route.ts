import { connection } from "next/server";
import { leadIntelligenceResponse } from "@/modules/ai/sales/server/http";

type Context = {params: Promise<{leadId: string}>};

export async function GET(request: Request, context: Context) {
  await connection();
  return leadIntelligenceResponse(request, (await context.params).leadId);
}
