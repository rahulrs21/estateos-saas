import { authJson } from "@/modules/auth/server/http";
import { parseWorkspaceJsonRequest } from "@/lib/http/request-policy";
import { mapWorkspaceDataError } from "@/modules/organizations/server/errors";
import { submitPageEnquiry } from "@/modules/websites/server/public";

type RouteContext = {params: Promise<{companySlug: string; pageSlug: string}>};

/**
 * Public landing page enquiries. The company and lead form come from the live
 * publication matching the URL, never from the request body. Responses say
 * only whether the enquiry was received.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const {companySlug, pageSlug} = await context.params;
    const rawBody = await parseWorkspaceJsonRequest(request);
    const result = await submitPageEnquiry({companySlug, pageSlug, idempotencyKey: request.headers.get("idempotency-key") ?? "", rawBody});
    return authJson({data: {accepted: true, duplicate: result.duplicate, message: result.message}}, result.duplicate ? 200 : 201);
  } catch (error) {
    const safe = mapWorkspaceDataError(error);
    const allowed = new Set([400, 404, 413, 415, 429, 503]);
    const status = allowed.has(safe.status) ? safe.status : 400;
    const message = safe.code === "RATE_LIMITED" ? "Please wait a moment before trying again."
      : safe.status === 413 ? "This request is too large."
        : safe.status === 404 ? "This form is unavailable."
          : safe.status === 503 ? "We could not send your enquiry right now. Please try again shortly."
            : "Check the required fields and consent, and try again.";
    const code = safe.code === "RATE_LIMITED" ? "RATE_LIMITED" : safe.status === 404 ? "FORM_UNAVAILABLE" : "SUBMISSION_FAILED";
    return authJson({error: {code, message}}, status);
  }
}
