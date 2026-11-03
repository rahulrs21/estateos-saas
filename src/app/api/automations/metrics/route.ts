import { metricsResponse } from "@/modules/automations/server/http";

export async function GET(request: Request) {
  return metricsResponse(request);
}
