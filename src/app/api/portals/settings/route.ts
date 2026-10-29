import { crmReadResponse } from "@/modules/leads/server/http";
import { getPortalSettings } from "@/modules/portals/server/service";

export async function GET(request: Request) {
  return crmReadResponse(request, () => getPortalSettings());
}
