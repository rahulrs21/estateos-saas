import "server-only";

import { timingSafeEqual } from "node:crypto";
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
import { decideApproval, listApprovals } from "./approvals";
import { runAutomationTick } from "./engine";
import { runCommunicationMaintenance } from "@/modules/communications/server/media";
import { retryInboxEvents } from "@/modules/inbox/server/webhooks";
import { applyInboxRetention } from "@/modules/inbox/server/retention";
import { syncMailboxes } from "@/modules/inbox/server/mail-sync";
import { generateWorkflowDraft } from "./generate";
import { completeWorkTask, listMyTasks } from "./tasks";
import {
  WorkflowValidationError, automationMetrics, createWorkflow, getExecution, getWorkflow, listExecutions, listWorkflows, runWorkflow, saveWorkflow, transitionWorkflow,
} from "./workflows";

/*
 * Automation endpoints (docs/WORKFLOW_BUILDER.md#api). Reads need a verified
 * session; mutations also need same-origin, the CSRF token and the
 * X-EstateOS-Organization header matching the server-resolved company. The
 * worker tick is a separate, secret-authenticated endpoint.
 */

/** A definition of 24 steps fits well within this. */
const WORKFLOW_BODY_BYTES = 64 * 1024;

function logUnexpected(endpoint: string, error: unknown) {
  if (error instanceof WorkspaceError || error instanceof WorkflowValidationError) return;
  const detail = process.env.NODE_ENV !== "production" && error instanceof Error ? error.message.slice(0, 300) : undefined;
  console.error(JSON.stringify({event: "automations.unexpected_error", endpoint, name: error instanceof Error ? error.name : typeof error, ...(detail ? {detail} : {})}));
}

function errorResponse(endpoint: string, error: unknown) {
  logUnexpected(endpoint, error);
  if (error instanceof WorkflowValidationError) return authJson({error: {code: error.code, message: error.message, issues: error.issues}}, 400);
  return leadErrorResponse(error);
}

async function readContext(request: Request) {
  await authorizeLeadRead(request);
  return requireActiveOrganizationRequest();
}

async function mutationContext(request: Request) {
  validateMutationRequest(request, {origin: getAppOrigin(), csrfToken: (await cookies()).get(authCookies().csrf.name)?.value});
  if (!await getSession()) throw new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
  const body = await parseWorkspaceJsonRequest(request, WORKFLOW_BODY_BYTES);
  const context = await requireActiveOrganizationRequest();
  assertExpectedOrganization(request.headers.get("x-estateos-organization"), context.organizationId);
  return {body, context};
}

const searchParams = (request: Request) => {
  const input: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    if (key in input) throw new WorkspaceError("VALIDATION_ERROR", 400, "Each filter must have a single value.");
    input[key] = value;
  }
  return input;
};

export async function listWorkflowsResponse(request: Request) {
  await connection();
  try { return authJson({data: await listWorkflows(await readContext(request), searchParams(request))}); } catch (error) { return errorResponse("list", error); }
}

export async function createWorkflowResponse(request: Request) {
  try { const {body, context} = await mutationContext(request); return authJson({data: await createWorkflow(context, body)}, 201); } catch (error) { return errorResponse("create", error); }
}

export async function getWorkflowResponse(request: Request, id: string) {
  await connection();
  try { return authJson({data: await getWorkflow(await readContext(request), id)}); } catch (error) { return errorResponse("get", error); }
}

export async function saveWorkflowResponse(request: Request, id: string) {
  try { const {body, context} = await mutationContext(request); return authJson({data: await saveWorkflow(context, id, body)}); } catch (error) { return errorResponse("save", error); }
}

export async function transitionWorkflowResponse(request: Request, id: string) {
  try { const {body, context} = await mutationContext(request); return authJson({data: await transitionWorkflow(context, id, body)}); } catch (error) { return errorResponse("transition", error); }
}

export async function runWorkflowResponse(request: Request, id: string) {
  try { const {body, context} = await mutationContext(request); return authJson({data: await runWorkflow(context, id, body)}, 202); } catch (error) { return errorResponse("run", error); }
}

export async function listExecutionsResponse(request: Request) {
  await connection();
  try { return authJson({data: await listExecutions(await readContext(request), searchParams(request))}); } catch (error) { return errorResponse("executions", error); }
}

export async function getExecutionResponse(request: Request, id: string) {
  await connection();
  try { return authJson({data: await getExecution(await readContext(request), id)}); } catch (error) { return errorResponse("execution", error); }
}

export async function metricsResponse(request: Request) {
  await connection();
  try { return authJson({data: await automationMetrics(await readContext(request))}); } catch (error) { return errorResponse("metrics", error); }
}

/** A Claude proposal for the editor; nothing is saved. */
export async function generateWorkflowResponse(request: Request) {
  try { const {body, context} = await mutationContext(request); return authJson({data: await generateWorkflowDraft(request, context, body)}); } catch (error) { return errorResponse("generate", error); }
}

export async function approvalsResponse(request: Request) {
  await connection();
  try { return authJson({data: await listApprovals(await readContext(request), searchParams(request))}); } catch (error) { return errorResponse("approvals", error); }
}

export async function decideApprovalResponse(request: Request, id: string) {
  try { const {body, context} = await mutationContext(request); return authJson({data: await decideApproval(context, id, body)}); } catch (error) { return errorResponse("approval.decide", error); }
}

export async function myTasksResponse(request: Request) {
  await connection();
  try { return authJson({data: await listMyTasks(await readContext(request))}); } catch (error) { return errorResponse("tasks", error); }
}

export async function completeWorkTaskResponse(request: Request, id: string) {
  try { const {context} = await mutationContext(request); return authJson({data: await completeWorkTask(context, id)}); } catch (error) { return errorResponse("task.complete", error); }
}

/**
 * The worker tick (docs/AUTOMATION_OPERATIONS.md#worker). Authenticated with
 * AUTOMATION_WORKER_SECRET (at least 32 characters, compared in constant time);
 * without a configured secret the endpoint is off. It processes one bounded
 * batch and returns counts only.
 */
export async function tickResponse(request: Request) {
  await connection();
  const secret = process.env.AUTOMATION_WORKER_SECRET ?? "";
  if (secret.length < 32) return Response.json({error: {code: "WORKER_NOT_CONFIGURED", message: "The automation worker is not configured."}}, {status: 503});
  const presented = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const expected = Buffer.from(secret);
  const given = Buffer.from(presented);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return Response.json({error: {code: "UNAUTHENTICATED", message: "Not allowed."}}, {status: 401});
  try {
    // Inbox events whose application failed are retried first, so the workflow events they write run in this tick (docs/UNIFIED_INBOX.md#ingestion).
    const inbox = await retryInboxEvents().catch(error => {
      console.error(JSON.stringify({event: "inbox.retry_failed", name: error instanceof Error ? error.name : typeof error}));
      return null;
    });
    // Connected mailboxes are checked for new mail (docs/EMAIL_INTEGRATION_PLAN.md#sync) before the workflows run, so the events they write run in this tick too.
    const mailboxes = await syncMailboxes().catch(error => {
      console.error(JSON.stringify({event: "inbox.mailbox_sync_failed", name: error instanceof Error ? error.name : typeof error}));
      return null;
    });
    const result = await runAutomationTick();
    if (result.errors.length) console.error(JSON.stringify({event: "automations.tick_errors", count: result.errors.length, first: result.errors[0]?.slice(0, 600)}));
    // The same worker removes call recordings and transcripts past retention (docs/CALL_PRIVACY_COMPLIANCE.md#retention); its failure never fails the automation tick.
    const communications = await runCommunicationMaintenance().catch(error => {
      console.error(JSON.stringify({event: "communications.maintenance_failed", name: error instanceof Error ? error.name : typeof error}));
      return null;
    });
    // Inbox content past each company's retention period (docs/INBOX_SECURITY.md#retention); its failure never fails the tick either.
    const inboxRetention = await applyInboxRetention().catch(error => {
      console.error(JSON.stringify({event: "inbox.retention_failed", name: error instanceof Error ? error.name : typeof error}));
      return null;
    });
    return Response.json({data: {...result, errors: result.errors.length, communications, inbox, inboxRetention, mailboxes}}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) {
    console.error(JSON.stringify({event: "automations.tick_failed", name: error instanceof Error ? error.name : typeof error, detail: error instanceof Error ? error.message.slice(0, 200) : undefined}));
    return Response.json({error: {code: "TICK_FAILED", message: "The automation tick failed; it will be retried."}}, {status: 503});
  }
}
