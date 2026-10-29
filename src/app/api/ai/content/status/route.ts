import { connection } from "next/server";
import { studioStatusResponse } from "@/modules/ai/content/server/http";

export async function GET(request: Request) {
  await connection();
  return studioStatusResponse(request);
}
