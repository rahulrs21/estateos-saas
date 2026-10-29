import { crmMutationResponse } from "@/modules/leads/server/http";
import { setLeadPrimaryInterest } from "@/modules/leads/server/property-service";
// Cache Components uses Node.js; per-route runtime exports are unsupported.
export async function POST(request: Request, context: {params: Promise<{leadId: string}>}) {
  return crmMutationResponse(request, setLeadPrimaryInterest, await context.params);
}
