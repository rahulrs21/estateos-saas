import { crmMutationResponse } from "@/modules/leads/server/http";
import { previewLeadDistribution } from "@/modules/leads/distribution/service";

export async function POST(request: Request) {
  return crmMutationResponse(request, previewLeadDistribution);
}
