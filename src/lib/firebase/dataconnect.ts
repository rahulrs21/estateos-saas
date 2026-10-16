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
export async function executeWorkspaceOperation<T>(operation: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await operation()).data;
  } catch (error) {
    throw mapWorkspaceDataError(error);
  }
}
