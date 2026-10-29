import { crmMutationResponse } from "@/modules/leads/server/http";
import { recordListingValidation } from "@/modules/portals/server/service";

export async function POST(request: Request) {
  return crmMutationResponse(request, recordListingValidation);
}
