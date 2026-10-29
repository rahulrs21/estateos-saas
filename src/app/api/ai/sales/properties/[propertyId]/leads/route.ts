import { connection } from "next/server";
import { propertyLeadsResponse } from "@/modules/ai/sales/server/http";

type Context = {params: Promise<{propertyId: string}>};

export async function GET(request: Request, context: Context) {
  await connection();
  return propertyLeadsResponse(request, (await context.params).propertyId);
}
