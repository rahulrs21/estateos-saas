import { crmMutationResponse } from "@/modules/leads/server/http";
import { savePortalConnection } from "@/modules/portals/server/service";

export async function POST(request: Request) {
  return crmMutationResponse(request, savePortalConnection);
}
