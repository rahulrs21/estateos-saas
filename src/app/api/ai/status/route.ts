import { connection } from "next/server";
import { statusResponse } from "@/modules/ai/server/http";

export async function GET(request: Request) {
  await connection();
  return statusResponse(request);
}
