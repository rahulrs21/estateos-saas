import { crmMutationResponse, crmReadResponse } from "@/modules/leads/server/http";
import { getLeadCaptureForm, updateLeadCaptureForm } from "@/modules/lead-capture/server/service";

type RouteContext = { params: Promise<{ formId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  return crmReadResponse(request, () => getLeadCaptureForm({ formId }));
}

export async function PATCH(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  return crmMutationResponse(request, updateLeadCaptureForm, { formId });
}
