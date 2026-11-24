import { updateFormResponse } from "@/modules/lead-ads/server/http";

/** Saves a Meta lead form's settings (on or off, branch, question mapping). */
export async function PATCH(request: Request, {params}: {params: Promise<{id: string}>}) {
  return updateFormResponse(request, (await params).id);
}
