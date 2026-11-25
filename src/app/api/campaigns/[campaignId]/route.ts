import { crmMutationResponse } from "@/modules/leads/server/http";
import { updateCampaign } from "@/modules/campaigns/server/service";

type Context = { params: Promise<{ campaignId: string }> };

/** Phase 7F.1: change a campaign's details (owners and administrators). */
export async function PATCH(request: Request, context: Context) {
  const { campaignId } = await context.params;
  return crmMutationResponse(request, updateCampaign, { id: campaignId });
}
