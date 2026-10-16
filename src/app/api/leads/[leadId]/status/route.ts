import { leadMutationResponse } from "@/modules/leads/server/http";
import { changeLeadStatus } from "@/modules/leads/server/service";

export async function PATCH(request: Request, context: { params: Promise<{ leadId: string }> }) {
  return leadMutationResponse(request, changeLeadStatus, (await context.params).leadId);
}
