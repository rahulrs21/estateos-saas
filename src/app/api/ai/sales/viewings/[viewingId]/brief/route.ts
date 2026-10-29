import { connection } from "next/server";
import { viewingBriefRouteResponse } from "@/modules/ai/sales/server/http";

type Context = {params: Promise<{viewingId: string}>};

export async function POST(request: Request, context: Context) {
  await connection();
  return viewingBriefRouteResponse(request, (await context.params).viewingId);
}
