import { countsResponse } from "@/modules/inbox/server/http";

export async function GET(request: Request) {
  return countsResponse(request);
}
