import { connection } from "next/server";
import { listConversationsResponse } from "@/modules/ai/server/http";

export async function GET(request: Request) {
  await connection();
  return listConversationsResponse(request);
}
