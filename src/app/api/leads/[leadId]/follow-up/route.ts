import { leadMutationResponse } from "@/modules/leads/server/http";
import { scheduleLeadFollowUp, completeLeadFollowUp } from "@/modules/leads/server/service";

type Context = { params: Promise<{ leadId: string }> };
export async function POST(request: Request, context: Context) {
  return leadMutationResponse(request, scheduleLeadFollowUp, (await context.params).leadId);
}
export async function PATCH(request: Request, context: Context) {
  return leadMutationResponse(request, completeLeadFollowUp, (await context.params).leadId);
}
