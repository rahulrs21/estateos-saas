import { transitionWorkflowResponse } from "@/modules/automations/server/http";

export async function POST(request: Request, {params}: {params: Promise<{workflowId: string}>}) {
  return transitionWorkflowResponse(request, (await params).workflowId);
}
