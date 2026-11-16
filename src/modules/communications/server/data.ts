import "server-only";

import { sqlConnectHandle } from "@/lib/firebase/sql-connect-handle";
import * as sdk from "@dataconnect/admin-generated-messaging";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import type { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { assertSafeDataConnectEnvironment } from "@/modules/organizations/server/dataconnect-policy";

/*
 * Database access for communications (docs/COMMUNICATION_HUB.md#security).
 * Member operations run as the signed-in member (impersonated), so the
 * database re-checks their membership and record access on every call.
 * Server-only (NO_ACCESS) operations receive the company EstateOS resolved
 * from the verified session, never one supplied by the browser.
 */

export {sdk};
export type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;

export function serverDataConnect() {
  assertSafeDataConnectEnvironment({nodeEnv: process.env.NODE_ENV, emulatorHost: process.env.DATA_CONNECT_EMULATOR_HOST});
  return sqlConnectHandle();
}

/** A member operation with safe, mapped errors. */
export function asMember<T>(context: Context, name: string, operation: (dc: Context["request"]["dc"], options: Context["request"]["options"]) => Promise<{data: T}>) {
  return executeWorkspaceOperation(() => operation(context.request.dc, context.request.options), name);
}

/** A server-only operation, with mapped errors. */
export function asServer<T>(name: string, operation: (dc: ReturnType<typeof serverDataConnect>) => Promise<{data: T}>) {
  const dc = serverDataConnect();
  return executeWorkspaceOperation(() => operation(dc), name);
}

/** The row already exists: a repeated request with the same idempotency key. */
export function isDuplicate(error: unknown) {
  const provider = typeof error === "object" && error !== null ? error as {code?: unknown; message?: unknown} : {};
  return provider.code === "data-connect/already-exists" || (typeof provider.message === "string" && /unique constraint|duplicate key/i.test(provider.message));
}

export const isAdministrator = (context: Context) => context.membership.role === "OWNER" || context.membership.role === "ADMIN";
