import { connection } from "next/server";
import { qualificationResponse } from "@/modules/ai/sales/server/http";

type Context = {params: Promise<{leadId: string}>};

export async function PUT(request: Request, context: Context) {
  await connection();
  return qualificationResponse(request, (await context.params).leadId);
}
