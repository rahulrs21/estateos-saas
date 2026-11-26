import { crmReadResponse } from "@/modules/leads/server/http";
import { searchWorkspace } from "@/modules/search/server/service";

/** Header search: GET /api/search?q=… (session, CSRF/origin and per-operation role checks as other CRM reads). */
export async function GET(request: Request) {
  return crmReadResponse(request, searchWorkspace);
}
