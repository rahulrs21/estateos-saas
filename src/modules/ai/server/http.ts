import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { assertExpectedOrganization } from "@/lib/http/request-policy";
import { authCookies, getAppOrigin } from "@/modules/auth/server/config";
import { authJson } from "@/modules/auth/server/http";
import { validateMutationRequest } from "@/modules/auth/server/request-policy";
import { authorizeLeadRead, leadErrorResponse } from "@/modules/leads/server/http";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { validateInput } from "@/modules/organizations/server/validation";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { conversationListSchema } from "../policy";
import { aiConfiguration, checkModelAvailability } from "./anthropic";
import { deleteConversation, getConversation, listConversations, purgeExpiredConversations, usageSummary } from "./store";

const conversationIdSchema = z.string().trim().transform(canonicalUuid).pipe(z.uuid());

function queryInput(request: Request) {
  const input: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    if (key in input) throw new WorkspaceError("VALIDATION_ERROR", 400, "Each filter must have a single value.");
    input[key] = value;
  }
  return input;
}

export async function listConversationsResponse(request: Request) {
  try {
    await authorizeLeadRead(request);
    const input = validateInput(conversationListSchema, queryInput(request));
    const context = await requireActiveOrganizationRequest();
    const config = aiConfiguration();
    if (config.ok && input.offset === 0 && !input.search) await purgeExpiredConversations(context, config.config.retentionDays);
    return authJson({data: await listConversations(context, input)});
  } catch (error) { return leadErrorResponse(error); }
}

export async function getConversationResponse(request: Request, rawId: string) {
  try {
    await authorizeLeadRead(request);
    const conversationId = validateInput(conversationIdSchema, rawId);
    const context = await requireActiveOrganizationRequest();
    return authJson({data: await getConversation(context, conversationId, 200)});
  } catch (error) { return leadErrorResponse(error); }
}

export async function deleteConversationResponse(request: Request, rawId: string) {
  try {
    validateMutationRequest(request, {origin: getAppOrigin(), csrfToken: (await cookies()).get(authCookies().csrf.name)?.value});
    if (!await getSession()) throw new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
    const conversationId = validateInput(conversationIdSchema, rawId);
    const context = await requireActiveOrganizationRequest();
    assertExpectedOrganization(request.headers.get("x-estateos-organization"), context.organizationId);
    return authJson({data: await deleteConversation(context, conversationId)});
  } catch (error) { return leadErrorResponse(error); }
}

/** Configuration, model availability and allowance usage for the signed-in member. Never returns secrets. */
export async function statusResponse(request: Request) {
  try {
    await authorizeLeadRead(request);
    const context = await requireActiveOrganizationRequest();
    const config = aiConfiguration();
    if (!config.ok) {
      return authJson({data: {enabled: false, code: config.code,
        message: config.code === "AI_DISABLED" ? "The AI Copilot is turned off for this EstateOS environment." : "The AI Copilot is not configured. Ask an administrator to set the Anthropic settings."}});
    }
    const [model, usage] = await Promise.all([checkModelAvailability(config.config), usageSummary(context, config.config)]);
    return authJson({data: {
      enabled: true, model, usage, maxInputChars: config.config.maxInputChars,
      role: context.membership.role, organizationId: context.organizationId,
    }});
  } catch (error) { return leadErrorResponse(error); }
}
