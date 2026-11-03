import { dashboardResponse } from "@/modules/communications/server/http";

export async function GET(request: Request) {
  return dashboardResponse(request);
}
