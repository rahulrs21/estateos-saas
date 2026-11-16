import "server-only";

import { sqlConnectHandle } from "@/lib/firebase/sql-connect-handle";
import * as sdk from "@dataconnect/admin-generated";
import { type OperationOptions } from "firebase-admin/data-connect";
import type { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { assertSafeDataConnectEnvironment } from "@/modules/organizations/server/dataconnect-policy";
import { mapWorkspaceDataError } from "@/modules/organizations/server/errors";
import { assertActiveMembership, type StoredMembership } from "@/modules/organizations/server/permission-policy";

/*
 * Database access for the automation engine (docs/WORKFLOW_SECURITY.md#worker-identity).
 * Bookkeeping uses NO_ACCESS operations through the Admin SDK (server only).
 * Side effects run in the executor's context: the same impersonated identity
 * a signed-in request has, so every existing role check applies to them.
 */

export {sdk};
export type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;

export function adminDataConnect() {
  assertSafeDataConnectEnvironment({nodeEnv: process.env.NODE_ENV, emulatorHost: process.env.DATA_CONNECT_EMULATOR_HOST});
  return sqlConnectHandle();
}

/** A database failure with the check token (for example AUTOMATION_LEASE_LOST) the engine reacts to. */
export class AutomationDbError extends Error {
  constructor(readonly token: string | null, readonly providerCode: string | null, readonly cause: unknown, private readonly uniqueViolation = false) {
    super(token ?? providerCode ?? "AUTOMATION_DATABASE_ERROR");
    this.name = "AutomationDbError";
  }
  /** The row already exists: a repeated delivery or step. Reported as already-exists, or as a query error naming a unique constraint. */
  get duplicate() { return this.providerCode === "data-connect/already-exists" || this.uniqueViolation; }
}

const UNIQUE_VIOLATION = /unique constraint|duplicate key/i;

const TOKEN = /\b((?:AUTOMATION|EXECUTOR|LEAD|DISTRIBUTION|ASSIGNMENT|CLOSED|WORK_TASK)_[A-Z_]+|LEAD_NOT_FOUND)\b/;

/** Runs an operation and keeps the raw check token for the engine (never shown to users as is). */
export async function raw<T>(operation: () => Promise<{data: T}>): Promise<T> {
  try {
    return (await operation()).data;
  } catch (error) {
    const provider = typeof error === "object" && error !== null ? error as {code?: unknown; message?: unknown} : {};
    const message = typeof provider.message === "string" ? provider.message : "";
    const token = TOKEN.exec(message)?.[1] ?? null;
    throw new AutomationDbError(token, typeof provider.code === "string" ? provider.code : null, error, !token && UNIQUE_VIOLATION.test(message));
  }
}

/** For member requests: safe, mapped errors. */
export async function member<T>(operation: () => Promise<{data: T}>): Promise<T> {
  try { return (await operation()).data; } catch (error) { throw mapWorkspaceDataError(error); }
}

/** The workflow executor could not act (missing, suspended or without the role an action needs). */
export class ExecutorUnavailableError extends Error {
  constructor(readonly reason: string) { super("EXECUTOR_NOT_AUTHORIZED"); this.name = "ExecutorUnavailableError"; }
}

function impersonation(uid: string, email: string): OperationOptions {
  return {impersonate: {authClaims: {sub: uid, uid, email, email_verified: true, firebase: {sign_in_provider: "password", identities: {email: [email]}}}}};
}

/**
 * The same Context shape as requireActiveOrganizationRequest(), for the
 * member a workflow runs as. Their membership is re-read from the database
 * every time, so a suspended or demoted executor cannot act.
 */
export async function executorContext(organizationId: string, executorUid: string): Promise<Context> {
  const dc = adminDataConnect();
  const {userProfile} = await raw(() => sdk.automationExecutorProfile(dc, {uid: executorUid}));
  if (!userProfile) throw new ExecutorUnavailableError("PROFILE_MISSING");
  const email = userProfile.email.trim().toLowerCase();
  const options = impersonation(executorUid, email);
  const [profile, organizationContext] = await Promise.all([
    raw(() => sdk.getMyProfile(dc, options)).then(data => data.userProfile),
    raw(() => sdk.getOrganizationContext(dc, {organizationId}, options)),
  ]);
  const row = organizationContext.ownMembership;
  const membership: StoredMembership | null = row ? {id: row.id, organizationId: row.organizationId, userUid: row.userProfileUid ?? null, email: row.email, role: row.role, status: row.status} : null;
  try { assertActiveMembership(membership, organizationId, executorUid); } catch { throw new ExecutorUnavailableError("MEMBERSHIP_INACTIVE"); }
  // Only OWNERs and ADMINs can activate; an executor who no longer holds either role stops the workflow.
  if (!["OWNER", "ADMIN"].includes(membership!.role)) throw new ExecutorUnavailableError("ROLE_CHANGED");
  if (!profile || !organizationContext.organization) throw new ExecutorUnavailableError("ORGANIZATION_UNAVAILABLE");
  return {
    request: {dc, options, user: {uid: executorUid, email, emailVerified: true as const, name: userProfile.displayName}},
    profile, membership, organizationId, organization: organizationContext.organization,
  } as Context;
}
