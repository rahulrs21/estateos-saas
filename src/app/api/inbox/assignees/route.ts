import { assigneesResponse } from "@/modules/inbox/server/http";

export async function GET(request: Request) {
  return assigneesResponse(request);
}
