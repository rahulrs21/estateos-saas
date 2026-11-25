import { crmMutationResponse } from "@/modules/leads/server/http";
import { addCampaignSpend } from "@/modules/campaigns/server/service";

/** Phase 7F.1: spend entered by hand for a period (owners and administrators). */
export async function POST(request: Request) {
  return crmMutationResponse(request, addCampaignSpend, {}, 201);
}
