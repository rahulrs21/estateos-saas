import { connection } from "next/server";
import { dashboardResponse } from "@/modules/ai/sales/server/http";

export async function GET(request: Request) {
  await connection();
  return dashboardResponse(request);
}
