import { connection } from "next/server";
import { summaryResponse } from "@/modules/ai/sales/server/http";

export async function POST(request: Request) {
  await connection();
  return summaryResponse(request);
}
