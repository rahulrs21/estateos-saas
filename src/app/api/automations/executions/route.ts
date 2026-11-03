import { listExecutionsResponse } from "@/modules/automations/server/http";

export async function GET(request: Request) {
  return listExecutionsResponse(request);
}
