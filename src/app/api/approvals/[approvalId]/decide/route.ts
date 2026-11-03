import { decideApprovalResponse } from "@/modules/automations/server/http";

export async function POST(request: Request, {params}: {params: Promise<{approvalId: string}>}) {
  return decideApprovalResponse(request, (await params).approvalId);
}
