import { crmMutationResponse } from "@/modules/leads/server/http";
import { updateCampaignSpend } from "@/modules/campaigns/server/service";

type Context = { params: Promise<{ spendId: string }> };

/** Phase 7F.1: change a spend entry entered by hand (owners and administrators). */
export async function PATCH(request: Request, context: Context) {
  const { spendId } = await context.params;
  return crmMutationResponse(request, updateCampaignSpend, { id: spendId });
}
