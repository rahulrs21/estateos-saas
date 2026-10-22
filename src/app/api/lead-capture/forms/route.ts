import { crmMutationResponse, crmReadResponse } from "@/modules/leads/server/http";
import { createLeadCaptureForm, listLeadCaptureForms } from "@/modules/lead-capture/server/service";

export function GET(request: Request) {
  return crmReadResponse(request, () => listLeadCaptureForms());
}

export function POST(request: Request) {
  return crmMutationResponse(request, createLeadCaptureForm, {}, 201);
}
