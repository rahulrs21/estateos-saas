import { getWorkflowResponse, saveWorkflowResponse } from "@/modules/automations/server/http";

type Params = {params: Promise<{workflowId: string}>};

export async function GET(request: Request, {params}: Params) {
  return getWorkflowResponse(request, (await params).workflowId);
}

export async function PUT(request: Request, {params}: Params) {
  return saveWorkflowResponse(request, (await params).workflowId);
}
