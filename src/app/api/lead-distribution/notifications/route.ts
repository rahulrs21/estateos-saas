import { crmReadResponse } from "@/modules/leads/server/http";
import { listNotifications } from "@/modules/leads/distribution/service";

export async function GET(request: Request) {
  return crmReadResponse(request, listNotifications);
}
