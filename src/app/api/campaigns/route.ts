import { crmMutationResponse } from "@/modules/leads/server/http";
import { createCampaign } from "@/modules/campaigns/server/service";

/** Phase 7F.1: add a campaign (owners and administrators; docs/CAMPAIGNS_PLAN.md). */
export async function POST(request: Request) {
  return crmMutationResponse(request, createCampaign, {}, 201);
}
