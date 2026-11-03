import { completeWorkTaskResponse } from "@/modules/automations/server/http";

export async function POST(request: Request, {params}: {params: Promise<{taskId: string}>}) {
  return completeWorkTaskResponse(request, (await params).taskId);
}
