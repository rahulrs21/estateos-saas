import "server-only";

import { connectorConfig } from "@dataconnect/admin-generated";
import { getDataConnect, type OperationOptions } from "firebase-admin/data-connect";
import { getSession } from "@/lib/auth/session";
import { assertSafeDataConnectEnvironment } from "@/modules/organizations/server/dataconnect-policy";
import { mapWorkspaceDataError, WorkspaceError } from "@/modules/organizations/server/errors";
import { getFirebaseAdminApp } from "./admin";

/**
 * Resolve identity from the verified HttpOnly session, never function arguments.
 * Every generated operation must receive options: omitting impersonation bypasses
 * SQL Connect authorization when using the Admin SDK.
 */
export async function requireSqlConnectRequest() {
  const user = await getSession();
  if (!user) throw new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
  assertSafeDataConnectEnvironment({
    nodeEnv: process.env.NODE_ENV,
    emulatorHost: process.env.DATA_CONNECT_EMULATOR_HOST,
  });
  const email = user.email.trim().toLowerCase();
  const options: OperationOptions = {
    impersonate: {
      authClaims: {
        sub: user.uid,
        uid: user.uid,
        email,
        email_verified: true,
        firebase: { sign_in_provider: "password", identities: { email: [email] } },
      },
    },
  };
  try {
    const dc = getDataConnect(connectorConfig, getFirebaseAdminApp());
    return { dc, options, user: { ...user, email } };
  } catch (error) {
    throw mapWorkspaceDataError(error);
  }
}

/** A sanitized boundary; do not return provider errors containing query details. */
export async function executeWorkspaceOperation<T>(
  operation: () => Promise<{ data: T }>,
  operationName = "unknown",
): Promise<T> {
  try {
    return (await operation()).data;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      const rawCode = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
        ? error.code
        : "";
      const allowedCodes = new Set([
        "data-connect/aborted",
        "data-connect/invalid-argument",
        "data-connect/invalid-credential",
        "data-connect/internal-error",
        "data-connect/permission-denied",
        "data-connect/unauthenticated",
        "data-connect/not-found",
        "data-connect/unknown-error",
        "data-connect/query-error",
      ]);
      const providerCode = allowedCodes.has(rawCode) ? rawCode : "unclassified";
      const safeOperationName = /^[A-Za-z][A-Za-z0-9:_-]{0,79}$/.test(operationName)
        ? operationName
        : "unknown";
      // Keep server diagnostics useful without logging provider messages,
      // variables, credentials, customer data or raw query details.
      // Use a single string because Next.js's development overlay serializes
      // object arguments as `{}`, hiding these otherwise safe diagnostic fields.
      console.error(`EstateOS SQL Connect operation failed: operation=${safeOperationName} code=${providerCode}`);
    }
    throw mapWorkspaceDataError(error);
  }
}
