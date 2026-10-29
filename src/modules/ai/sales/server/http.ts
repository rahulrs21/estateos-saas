import "server-only";

import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { assertExpectedOrganization, parseWorkspaceJsonRequest } from "@/lib/http/request-policy";
import { authCookies, getAppOrigin } from "@/modules/auth/server/config";
import { authJson } from "@/modules/auth/server/http";
import { validateMutationRequest } from "@/modules/auth/server/request-policy";
import { authorizeLeadRead, leadErrorResponse } from "@/modules/leads/server/http";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { validateInput } from "@/modules/organizations/server/validation";
import { emptyBodySchema, priorityReviewSchema, qualificationInputSchema, resolveScope, salesIdSchema, scopeSchema, viewingBriefSchema } from "../policy";
import {
  analyzeLeadResponse, enforceSalesRateLimit, evaluateLeadResponse, getLeadIntelligence, getSummary, pipelineSummaryResponse, propertyMatchingLeads,
  propertyViewings, salesDashboard, scoringConfig, viewingBriefResponse,
} from "./service";
import { recordPriorityReview, saveQualificationDetails } from "./store";

/*
 * Sales intelligence endpoints (docs/AI_SALES_INTELLIGENCE.md). Reads need a
 * verified session; mutations also need same-origin, the CSRF token and the
 * X-EstateOS-Organization header matching the server-resolved company. The
 * company and role always come from the session, never from the request.
 */

function logUnexpected(endpoint: string, error: unknown) {
  if (error instanceof WorkspaceError) return;
  const detail = process.env.NODE_ENV !== "production" && error instanceof Error ? error.message.slice(0, 300) : undefined;
  console.error(JSON.stringify({event: "ai.sales.unexpected_error", endpoint, name: error instanceof Error ? error.name : typeof error, ...(detail ? {detail} : {})}));
}

const respond = async (endpoint: string, work: () => Promise<unknown>, status = 200) => {
  try { return authJson({data: await work()}, status); } catch (error) { logUnexpected(endpoint, error); return leadErrorResponse(error); }
};

async function readContext(request: Request) {
  await authorizeLeadRead(request);
  return requireActiveOrganizationRequest();
}

async function mutationContext(request: Request) {
  validateMutationRequest(request, {origin: getAppOrigin(), csrfToken: (await cookies()).get(authCookies().csrf.name)?.value});
  if (!await getSession()) throw new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
  const body = await parseWorkspaceJsonRequest(request);
  const context = await requireActiveOrganizationRequest();
  assertExpectedOrganization(request.headers.get("x-estateos-organization"), context.organizationId);
  return {body, context};
}

export const leadIntelligenceResponse = (request: Request, leadId: string) => respond("lead", async () => {
  const context = await readContext(request);
  return getLeadIntelligence(context, validateInput(salesIdSchema, leadId));
});

export const evaluateResponse = (request: Request, leadId: string) => respond("evaluate", async () => {
  const {body, context} = await mutationContext(request);
  validateInput(emptyBodySchema, body);
  scoringConfig();
  await enforceSalesRateLimit(request, context, "evaluate");
  return evaluateLeadResponse(context, validateInput(salesIdSchema, leadId));
});

export const analyzeResponse = (request: Request, leadId: string) => respond("analyze", async () => {
  const {body, context} = await mutationContext(request);
  validateInput(emptyBodySchema, body);
  return analyzeLeadResponse(request, context, validateInput(salesIdSchema, leadId));
});

export const qualificationResponse = (request: Request, leadId: string) => respond("qualification", async () => {
  const {body, context} = await mutationContext(request);
  const input = validateInput(qualificationInputSchema, body);
  const id = validateInput(salesIdSchema, leadId);
  await saveQualificationDetails(context, {leadId: id, ...input});
  return getLeadIntelligence(context, id);
});

export const reviewResponse = (request: Request, leadId: string) => respond("review", async () => {
  const {body, context} = await mutationContext(request);
  const input = validateInput(priorityReviewSchema, body);
  const id = validateInput(salesIdSchema, leadId);
  const view = await getLeadIntelligence(context, id);
  const assessment = view.latestAssessment;
  if (!assessment || assessment.id.replaceAll("-", "") !== input.assessmentId.replaceAll("-", "").toLowerCase()) {
    throw new WorkspaceError("CONFLICT", 409, "Review the latest assessment. Reload the lead and try again.");
  }
  await recordPriorityReview(context, {leadId: id, assessmentId: assessment.id, suggestedPriority: assessment.priority, reviewedPriority: input.reviewedPriority, reason: input.reason});
  return getLeadIntelligence(context, id);
}, 201);

export const viewingBriefRouteResponse = (request: Request, viewingId: string) => respond("viewing-brief", async () => {
  const {body, context} = await mutationContext(request);
  const input = validateInput(viewingBriefSchema, body);
  return viewingBriefResponse(request, context, validateInput(salesIdSchema, viewingId), input.leadId);
});

export const propertyLeadsResponse = (request: Request, propertyId: string) => respond("property-leads", async () => {
  const context = await readContext(request);
  return propertyMatchingLeads(context, validateInput(salesIdSchema, propertyId));
});

export const propertyViewingsResponse = (request: Request, propertyId: string) => respond("property-viewings", async () => {
  const context = await readContext(request);
  return propertyViewings(context, validateInput(salesIdSchema, propertyId));
});

function scopeFrom(request: Request, role: string) {
  const values = new URL(request.url).searchParams.getAll("scope");
  if (values.length > 1) throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose one scope.");
  return resolveScope(validateInput(scopeSchema, values[0] ?? undefined), role);
}

export const dashboardResponse = (request: Request) => respond("dashboard", async () => {
  const context = await readContext(request);
  return salesDashboard(context, scopeFrom(request, context.membership.role));
});

export const summaryResponse = (request: Request) => respond("summary", async () => {
  const {body, context} = await mutationContext(request);
  validateInput(emptyBodySchema, body);
  return pipelineSummaryResponse(request, context, scopeFrom(request, context.membership.role));
}, 201);

export const getSummaryResponse = (request: Request, id: string) => respond("summary-read", async () => {
  const context = await readContext(request);
  return getSummary(context, validateInput(salesIdSchema, id));
});
