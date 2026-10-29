import { crmMutationResponse, crmReadResponse } from "@/modules/leads/server/http";
import { getLeadPropertyData, saveLeadPropertyInterest } from "@/modules/leads/server/property-service";
// Cache Components uses Node.js; per-route runtime exports are unsupported.
type Context = {params: Promise<{leadId: string}>};
export async function GET(request: Request, context: Context) {
  return crmReadResponse(request, getLeadPropertyData, await context.params);
}
export async function POST(request: Request, context: Context) {
  return crmMutationResponse(request, saveLeadPropertyInterest, await context.params);
}
