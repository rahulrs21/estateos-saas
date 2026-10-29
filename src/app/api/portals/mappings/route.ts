import { crmMutationResponse } from "@/modules/leads/server/http";
import { setPortalFieldMapping } from "@/modules/portals/server/service";

export async function POST(request: Request) {
  return crmMutationResponse(request, setPortalFieldMapping);
}
