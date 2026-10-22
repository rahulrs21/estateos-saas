import { crmMutationResponse, crmReadResponse } from "@/modules/leads/server/http";
import { getLeadDistributionSettings, saveLeadDistributionSettings } from "@/modules/leads/distribution/service";

export async function GET(request: Request) {
  return crmReadResponse(request, () => getLeadDistributionSettings());
}

export async function PATCH(request: Request) {
  return crmMutationResponse(request, saveLeadDistributionSettings);
}
