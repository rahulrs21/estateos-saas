import { leadMutationResponse } from "@/modules/leads/server/http";
import { assignLead } from "@/modules/leads/server/service";

export async function PATCH(request: Request, context: { params: Promise<{ leadId: string }> }) {
  return leadMutationResponse(request, assignLead, (await context.params).leadId);
}
