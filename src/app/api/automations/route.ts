import { createWorkflowResponse, listWorkflowsResponse } from "@/modules/automations/server/http";

export async function GET(request: Request) {
  return listWorkflowsResponse(request);
}

export async function POST(request: Request) {
  return createWorkflowResponse(request);
}
