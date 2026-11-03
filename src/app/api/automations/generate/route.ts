import { generateWorkflowResponse } from "@/modules/automations/server/http";

export async function POST(request: Request) {
  return generateWorkflowResponse(request);
}
