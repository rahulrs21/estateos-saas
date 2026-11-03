import "server-only";

import { cookies } from "next/headers";
import { connection } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertExpectedOrganization, parseWorkspaceJsonRequest } from "@/lib/http/request-policy";
import { authCookies, getAppOrigin } from "@/modules/auth/server/config";
import { authJson } from "@/modules/auth/server/http";
import { validateMutationRequest } from "@/modules/auth/server/request-policy";
import { authorizeLeadRead, leadErrorResponse } from "@/modules/leads/server/http";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { contactCallsView, getCall, leadCallsView, logCall, updateCall } from "./calls";
import { addSuppression, getCommunicationSettings, listSuppressions, saveCommunicationSettings, withdrawSuppression } from "./settings";
import type { Context } from "./data";

/*
 * Communication endpoints (docs/COMMUNICATION_HUB.md#api). Reads need a
 * verified session; mutations also need same-origin, the CSRF token and the
 * X-EstateOS-Organization header matching the server-resolved company. The
 * company always comes from the session, never from the request.
 */

const BODY_BYTES = 16 * 1024;

function errorResponse(endpoint: string, error: unknown) {
  if (!(error instanceof WorkspaceError)) {
    const detail = process.env.NODE_ENV !== "production" && error instanceof Error ? error.message.slice(0, 300) : undefined;
    console.error(JSON.stringify({event: "communications.unexpected_error", endpoint, name: error instanceof Error ? error.name : typeof error, ...(detail ? {detail} : {})}));
  }
  return leadErrorResponse(error);
}

async function readContext(request: Request) {
  await authorizeLeadRead(request);
  return requireActiveOrganizationRequest();
}

async function mutationContext(request: Request) {
  validateMutationRequest(request, {origin: getAppOrigin(), csrfToken: (await cookies()).get(authCookies().csrf.name)?.value});
  if (!await getSession()) throw new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
  const body = await parseWorkspaceJsonRequest(request, BODY_BYTES);
  const context = await requireActiveOrganizationRequest();
  assertExpectedOrganization(request.headers.get("x-estateos-organization"), context.organizationId);
  return {body, context};
}

function searchParams(request: Request) {
  const input: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    if (key in input) throw new WorkspaceError("VALIDATION_ERROR", 400, "Each filter must have a single value.");
    input[key] = value;
  }
  return input;
}

async function read(request: Request, endpoint: string, work: (context: Context, query: Record<string, string>) => Promise<unknown>) {
  await connection();
  try { return authJson({data: await work(await readContext(request), searchParams(request))}); } catch (error) { return errorResponse(endpoint, error); }
}

async function write(request: Request, endpoint: string, work: (context: Context, body: unknown) => Promise<unknown>, status = 200) {
  try { const {body, context} = await mutationContext(request); return authJson({data: await work(context, body)}, status); } catch (error) { return errorResponse(endpoint, error); }
}

export const leadCallsResponse = (request: Request, leadId: string) => read(request, "lead.calls", (context, query) => leadCallsView(context, leadId, query));
export const contactCallsResponse = (request: Request, contactId: string) => read(request, "contact.calls", (context, query) => contactCallsView(context, contactId, query));
export const logCallResponse = (request: Request) => write(request, "call.log", logCall, 201);
export const getCallResponse = (request: Request, id: string) => read(request, "call.get", context => getCall(context, id));
export const updateCallResponse = (request: Request, id: string) => write(request, "call.update", (context, body) => updateCall(context, id, body));
export const settingsResponse = (request: Request) => read(request, "settings.get", context => getCommunicationSettings(context));
export const saveSettingsResponse = (request: Request) => write(request, "settings.save", saveCommunicationSettings);
export const suppressionsResponse = (request: Request) => read(request, "suppressions.list", context => listSuppressions(context));
export const addSuppressionResponse = (request: Request) => write(request, "suppressions.add", addSuppression, 201);
export const withdrawSuppressionResponse = (request: Request, id: string) => write(request, "suppressions.withdraw", (context, body) => withdrawSuppression(context, id, body));
