import { connection } from "next/server";
import { propertyViewingsResponse } from "@/modules/ai/sales/server/http";

type Context = {params: Promise<{propertyId: string}>};

export async function GET(request: Request, context: Context) {
  await connection();
  return propertyViewingsResponse(request, (await context.params).propertyId);
}
