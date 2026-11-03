import { myTasksResponse } from "@/modules/automations/server/http";

export async function GET(request: Request) {
  return myTasksResponse(request);
}
