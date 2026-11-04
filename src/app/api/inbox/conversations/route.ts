import { listConversationsResponse } from "@/modules/inbox/server/http";

export async function GET(request: Request) {
  return listConversationsResponse(request);
}
