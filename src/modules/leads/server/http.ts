import "server-only";

import { cookies } from "next/headers";
import { authCookies, getAppOrigin } from "@/modules/auth/server/config";
import { authJson } from "@/modules/auth/server/http";
import { getSession } from "@/lib/auth/session";
import { SessionPolicyError } from "@/modules/auth/server/session-policy";
import { AuthRequestError, validateCsrfRequest, validateMutationRequest } from "@/modules/auth/server/request-policy";
import { WorkspaceError, mapWorkspaceDataError } from "@/modules/organizations/server/errors";
import { parseLeadJsonRequest } from "./request-policy";

export function leadErrorResponse(error: unknown) {
  const safe = error instanceof WorkspaceError || error instanceof SessionPolicyError || error instanceof AuthRequestError
    ? error : mapWorkspaceDataError(error);
  return authJson({ error: { code: safe.code, message: safe.message } }, safe.status);
}

export async function authorizeLeadRead(request: Request) {
  validateCsrfRequest(request, getAppOrigin());
  if (!await getSession()) throw new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
}

type Mutation = (input: unknown, expectedOrganizationId: string | null) => Promise<unknown>;

/** Every entry point enforces HTTP protections; services repeat data authorization. */
export async function leadMutationResponse(request: Request, mutation: Mutation, leadId?: string, successStatus = 200) {
  return crmMutationResponse(request, mutation, leadId ? {leadId} : {}, successStatus);
}

export async function crmMutationResponse(request: Request, mutation: Mutation, identifiers: Record<string, string> = {}, successStatus = 200) {
  try {
    const cookieStore = await cookies();
    validateMutationRequest(request, {
      origin: getAppOrigin(), csrfToken: cookieStore.get(authCookies().csrf.name)?.value,
    });
    if (!await getSession()) throw new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
    const body = await parseLeadJsonRequest(request);
    if ("leadId" in body || Object.keys(identifiers).some(key => key in body)) throw new WorkspaceError("VALIDATION_ERROR", 400, "Use the record identifiers in the request URL.");
    const data = await mutation({...body, ...identifiers}, request.headers.get("x-estateos-organization"));
    return authJson({ data }, successStatus);
  } catch (error) {
    return leadErrorResponse(error);
  }
}

export async function crmReadResponse(request: Request, operation: (input: unknown) => Promise<unknown>, identifiers: Record<string, string> = {}) {
  try {
    await authorizeLeadRead(request);
    const input: Record<string, unknown> = {};
    for (const [key, value] of new URL(request.url).searchParams) {
      if (key in input || key in identifiers) throw new WorkspaceError("VALIDATION_ERROR", 400, "Each filter must have a single value.");
      input[key] = value;
    }
    return authJson({data: await operation({...input, ...identifiers})});
  } catch (error) { return leadErrorResponse(error); }
}
