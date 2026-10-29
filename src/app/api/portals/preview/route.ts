import { crmReadResponse } from "@/modules/leads/server/http";
import { getPortalExportPreview } from "@/modules/portals/server/service";

// Internal administrator preview only: requires a session and is never a public feed URL.
export async function GET(request: Request) {
  return crmReadResponse(request, getPortalExportPreview);
}
