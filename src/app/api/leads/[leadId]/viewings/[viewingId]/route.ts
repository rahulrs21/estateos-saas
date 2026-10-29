import { crmMutationResponse } from "@/modules/leads/server/http";
import { updateLeadPropertyViewing } from "@/modules/leads/server/property-service";
// Cache Components uses Node.js; per-route runtime exports are unsupported.
export async function PATCH(request: Request, context: {params: Promise<{leadId: string; viewingId: string}>}) {
  return crmMutationResponse(request, updateLeadPropertyViewing, await context.params);
}
