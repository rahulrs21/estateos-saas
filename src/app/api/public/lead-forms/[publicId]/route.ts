import { authJson } from "@/modules/auth/server/http";
import { parseWorkspaceJsonRequest } from "@/lib/http/request-policy";
import { mapWorkspaceDataError } from "@/modules/organizations/server/errors";
import { resolvePublicForm, submitPublicLead } from "@/modules/lead-capture/server/service";

type RouteContext = { params: Promise<{ publicId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { publicId } = await context.params;
    const form = await resolvePublicForm(publicId);
    if (!form) return authJson({ error: { code: "FORM_UNAVAILABLE", message: "This form is unavailable." } }, 404);
    return authJson({ data: form });
  } catch (error) {
    const safe = mapWorkspaceDataError(error);
    return authJson({ error: { code: "FORM_UNAVAILABLE", message: "This form is temporarily unavailable." } }, safe.status);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { publicId } = await context.params;
    const rawBody = await parseWorkspaceJsonRequest(request);
    const idempotencyKey = request.headers.get("idempotency-key") ?? "";
    const result = await submitPublicLead({ publicId, idempotencyKey, rawBody });
    return authJson({ data: { accepted: result.accepted, duplicate: result.duplicate, message: result.message } }, result.duplicate ? 200 : 201);
  } catch (error) {
    const safe = mapWorkspaceDataError(error);
    const allowed = new Set([400, 404, 413, 415, 429, 503]);
    const status = allowed.has(safe.status) ? safe.status : 400;
    const message = safe.code === "RATE_LIMITED" ? "Please wait a moment before trying again."
      : safe.status === 413 ? "This request is too large."
        : safe.status === 404 ? "This form is unavailable."
          : safe.status === 503 ? "We could not submit your inquiry right now. Please try again shortly."
            : "Check the required fields, consent, and try again.";
    const code = safe.code === "RATE_LIMITED" ? "RATE_LIMITED" : safe.status === 404 ? "FORM_UNAVAILABLE" : "SUBMISSION_FAILED";
    return authJson({ error: { code, message } }, status);
  }
}
