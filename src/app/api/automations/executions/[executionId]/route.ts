import { getExecutionResponse } from "@/modules/automations/server/http";

export async function GET(request: Request, {params}: {params: Promise<{executionId: string}>}) {
  return getExecutionResponse(request, (await params).executionId);
}
