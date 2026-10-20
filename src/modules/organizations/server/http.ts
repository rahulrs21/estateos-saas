import "server-only";

import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { parseWorkspaceJsonRequest } from "@/lib/http/request-policy";
import { authCookies, getAppOrigin } from "@/modules/auth/server/config";
import { authJson } from "@/modules/auth/server/http";
import { AuthRequestError, validateMutationRequest } from "@/modules/auth/server/request-policy";
import { SessionPolicyError } from "@/modules/auth/server/session-policy";
import { WorkspaceError, mapWorkspaceDataError } from "./errors";

type Mutation = (input: unknown, expectedOrganizationId: string | null) => Promise<unknown>;

export async function companyMutationResponse(request: Request, mutation: Mutation, status = 200) {
  try {
    if (!await getSession()) throw new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
    const store = await cookies();
    validateMutationRequest(request, { origin: getAppOrigin(), csrfToken: store.get(authCookies().csrf.name)?.value });
    const input = await parseWorkspaceJsonRequest(request);
    const data = await mutation(input, request.headers.get("x-estateos-organization"));
    return authJson({ data }, status);
  } catch (error) {
    const safe = error instanceof WorkspaceError || error instanceof AuthRequestError || error instanceof SessionPolicyError
      ? error : mapWorkspaceDataError(error);
    return authJson({ error: { code: safe.code, message: safe.message } }, safe.status);
  }
}
