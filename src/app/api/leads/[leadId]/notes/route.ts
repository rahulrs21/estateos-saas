import { leadMutationResponse } from "@/modules/leads/server/http";
import { addLeadNote } from "@/modules/leads/server/service";

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  return leadMutationResponse(request, addLeadNote, (await context.params).leadId, 201);
}
