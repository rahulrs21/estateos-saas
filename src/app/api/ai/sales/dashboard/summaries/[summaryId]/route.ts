import { connection } from "next/server";
import { getSummaryResponse } from "@/modules/ai/sales/server/http";

type Context = {params: Promise<{summaryId: string}>};

export async function GET(request: Request, context: Context) {
  await connection();
  return getSummaryResponse(request, (await context.params).summaryId);
}
