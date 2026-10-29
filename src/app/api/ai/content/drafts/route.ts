import { connection } from "next/server";
import { listDraftsResponse } from "@/modules/ai/content/server/http";

export async function GET(request: Request) {
  await connection();
  return listDraftsResponse(request);
}
