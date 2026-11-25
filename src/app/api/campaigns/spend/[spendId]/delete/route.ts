import { crmMutationResponse } from "@/modules/leads/server/http";
import { deleteCampaignSpend } from "@/modules/campaigns/server/service";

type Context = { params: Promise<{ spendId: string }> };

/** Phase 7F.1: remove a spend entry entered by hand (owners and administrators). */
export async function POST(request: Request, context: Context) {
  const { spendId } = await context.params;
  return crmMutationResponse(request, deleteCampaignSpend, { id: spendId });
}
