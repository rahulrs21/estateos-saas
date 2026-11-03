"use client";

import type { automationMetrics, getExecution, getWorkflow, listExecutions, listWorkflows } from "./server/workflows";
import type { listMyTasks } from "./server/tasks";

interface ApiError { error?: {code?: string; message?: string; issues?: string[]} }

export class AutomationRequestError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number, public readonly issues: string[] = []) { super(message); }
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  let body: ApiError & {data?: T} = {};
  try { body = await response.json(); } catch { /* non-JSON error page */ }
  if (!response.ok || body.data === undefined) {
    throw new AutomationRequestError(body.error?.message || fallback, body.error?.code || "REQUEST_FAILED", response.status, body.error?.issues ?? []);
  }
  return body.data;
}

export async function automationsGet<T>(path: string, fallback = "Automation could not be loaded.") {
  return readJson<T>(await fetch(path, {credentials: "same-origin", cache: "no-store"}), fallback);
}

/** Mutations carry the CSRF token and the company the page was opened for; the server checks both. */
export async function automationsSend<T>(path: string, organizationId: string, method: "POST" | "PUT", body: unknown = {}, fallback = "The request could not be completed.") {
  const csrf = await fetch("/api/auth/csrf", {credentials: "same-origin", cache: "no-store"});
  const token = ((await csrf.json().catch(() => ({}))) as {csrfToken?: string}).csrfToken;
  if (!csrf.ok || !token) throw new AutomationRequestError("Could not prepare a secure request. Reload and try again.", "CSRF_UNAVAILABLE", csrf.status);
  return readJson<T>(await fetch(path, {
    method, credentials: "same-origin", cache: "no-store", body: JSON.stringify(body),
    headers: {"X-CSRF-Token": token, "X-EstateOS-Organization": organizationId, "Content-Type": "application/json"},
  }), fallback);
}

export const errorMessage = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;
export const errorIssues = (error: unknown) => error instanceof AutomationRequestError ? error.issues : [];

export type WorkflowList = Awaited<ReturnType<typeof listWorkflows>>;
export type WorkflowDetail = Awaited<ReturnType<typeof getWorkflow>>;
export type ExecutionList = Awaited<ReturnType<typeof listExecutions>>;
export type ExecutionDetail = Awaited<ReturnType<typeof getExecution>>;
export type Metrics = Awaited<ReturnType<typeof automationMetrics>>;
export type MyTasks = Awaited<ReturnType<typeof listMyTasks>>;

export const WORKFLOW_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft", IN_REVIEW: "In review", APPROVED: "Approved", ACTIVE: "Active", PAUSED: "Paused", ARCHIVED: "Archived",
};
export const EXECUTION_STATUS_LABELS: Record<string, string> = {
  QUEUED: "Queued", RUNNING: "Running", WAITING: "Waiting", APPROVAL_REQUIRED: "Needs approval", PAUSED: "Paused", SUCCEEDED: "Succeeded", SKIPPED: "Skipped", FAILED: "Failed", CANCELLED: "Cancelled",
};
/** Readable explanations of stored error codes (never raw provider messages). */
export const ERROR_CODE_LABELS: Record<string, string> = {
  EXECUTOR_NOT_AUTHORIZED: "The member who activated the workflow no longer has the authority to run it. It was paused.",
  LEAD_NOT_FOUND: "The lead no longer exists or is archived.",
  AUTOMATION_TARGET_INVALID: "The record this step needs is missing or belongs elsewhere.",
  AUTOMATION_RECIPIENT_INVALID: "The notification recipient is not an active member.",
  DISTRIBUTION_AGENT_UNAVAILABLE: "The agent chosen by the distribution rule is no longer available.",
  ACTION_NOT_AVAILABLE: "This action is not available yet.",
  WORKFLOW_NOT_ACTIVE: "The workflow was archived or returned to draft before this execution finished.",
  EXECUTION_EXPIRED: "The execution ran longer than the 90-day limit.",
  DEFINITION_INVALID: "The stored workflow version is no longer valid.",
  NO_ALLOWED_TIME: "Business and quiet hours leave no time for this step to run.",
  CHAIN_DEPTH_LIMIT: "Skipped to prevent a loop: events created by workflows go at most three levels deep.",
  AUTOMATION_DAILY_LIMIT: "The company's daily execution limit was reached.",
  STEP_FAILED: "The step failed after retries.",
};
export const describeError = (code: string | null | undefined) => code ? ERROR_CODE_LABELS[code] ?? `Error code ${code}.` : "";

export const dateTime = (iso: string | null | undefined, timeZone = "Asia/Dubai") => iso
  ? new Intl.DateTimeFormat("en-GB", {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone}).format(new Date(iso)) : "—";
export const duration = (ms: number | null | undefined) => ms === null || ms === undefined ? "—" : ms < 1000 ? `${ms} ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 60_000)} min`;
