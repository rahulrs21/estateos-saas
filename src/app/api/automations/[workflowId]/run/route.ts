import { runWorkflowResponse } from "@/modules/automations/server/http";

export async function POST(request: Request, {params}: {params: Promise<{workflowId: string}>}) {
  return runWorkflowResponse(request, (await params).workflowId);
}
