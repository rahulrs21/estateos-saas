import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AuthConfigurationError,
  classifyAuthConfigurationError,
  type AuthConfigurationReason,
} from "../src/modules/auth/server/configuration-error";
import {
  readFirebaseAdminConfiguration,
  resolveAppOrigin,
} from "../src/modules/auth/server/configuration-policy";
import {
  exchangeSessionToken,
  revokeAuthenticationSession,
  verifyAuthenticationSession,
  type SessionAuthGateway,
} from "../src/modules/auth/server/session-core";

const PUBLIC_CONFIGURATION_MESSAGE = "Authentication setup is incomplete. Contact your administrator.";

function assertConfigurationError(reason: AuthConfigurationReason) {
  return (error: unknown) => {
    assert.ok(error instanceof AuthConfigurationError);
    assert.equal(error.reason, reason);
    assert.equal(error.code, "AUTH_CONFIGURATION_ERROR");
    assert.equal(error.status, 503);
    assert.equal(error.message, PUBLIC_CONFIGURATION_MESSAGE);
    return true;
  };
}

test("origin failures provide allowlisted diagnostics without reflecting input", () => {
  assert.throws(() => resolveAppOrigin(undefined, false), assertConfigurationError("APP_ORIGIN_MISSING"));
  assert.throws(() => resolveAppOrigin("", false), assertConfigurationError("APP_ORIGIN_MISSING"));
  for (const origin of [
    "not-an-origin-secret",
    "https://private-user:private-password@example.test",
    "https://example.test/private-path",
    "https://example.test?private-query=secret",
    "http://example.test",
  ]) {
    assert.throws(() => resolveAppOrigin(origin, true), assertConfigurationError("APP_ORIGIN_INVALID"));
  }
});

test("Admin project and credential failures have separate safe diagnostics", () => {
  assert.throws(() => readFirebaseAdminConfiguration({}), assertConfigurationError("ADMIN_PROJECT_MISSING"));
  assert.throws(() => readFirebaseAdminConfiguration({ projectId: "   " }), assertConfigurationError("ADMIN_PROJECT_MISSING"));
  assert.throws(() => readFirebaseAdminConfiguration({
    projectId: "server-project", publicProjectId: "different-project",
  }), assertConfigurationError("ADMIN_PROJECT_MISMATCH"));
  for (const partial of [
    { clientEmail: "private-account@example.test" },
    { privateKey: "test-only-private-key-secret" },
  ]) {
    assert.throws(() => readFirebaseAdminConfiguration({
      projectId: "test-project", ...partial,
    }), assertConfigurationError("ADMIN_CREDENTIALS_INCOMPLETE"));
  }
});

test("classification preserves trusted configuration errors", () => {
  const error = new AuthConfigurationError("ADMIN_PROJECT_MISSING");
  assert.equal(classifyAuthConfigurationError(error), error);
});

for (const [code, reason] of [
  ["app/invalid-credential", "ADMIN_CREDENTIALS_INVALID"],
  ["auth/invalid-credential", "ADMIN_CREDENTIALS_INVALID"],
  ["auth/insufficient-permission", "ADMIN_PERMISSION_DENIED"],
] as const) {
  test(`classification sanitizes ${code} without keeping provider secrets`, () => {
    const providerError = Object.assign(new Error("test-only-private-provider-payload"), {
      code, privateKey: "test-only-private-key", credentialPath: "test-only-private-path",
    });
    const result = classifyAuthConfigurationError(providerError);
    assertConfigurationError(reason)(result);
    assert.notEqual(result, providerError);
    assert.deepEqual(Object.keys(result ?? {}).sort(), ["code", "name", "reason", "status"]);
    assert.equal(JSON.stringify(result).includes("test-only-private"), false);
    assert.equal(result?.message.includes("test-only-private"), false);
    assert.equal("cause" in (result ?? {}), false);
  });
}

test("invalid user tokens and unknown errors are not classified as configuration failures", () => {
  for (const error of [
    { code: "auth/invalid-id-token" },
    { code: "auth/id-token-expired" },
    { code: "auth/id-token-revoked" },
    { code: "auth/invalid-session-cookie" },
    { code: "auth/user-disabled" },
    { code: "auth/internal-error", message: "test-only-private-payload" },
    new Error("Could not load credentials test-only-private-key"),
    { code: 503 }, undefined, null, "auth/invalid-credential",
  ]) {
    assert.equal(classifyAuthConfigurationError(error), undefined);
  }
});

function failingGateway(failure: unknown) {
  let cookieCreations = 0;
  const auth: SessionAuthGateway = {
    async verifyIdToken() { throw failure; },
    async verifySessionCookie() { throw failure; },
    async createSessionCookie() { cookieCreations += 1; return "should-never-be-issued"; },
    async revokeRefreshTokens() { throw new Error("Unverified identities must not be revoked."); },
  };
  return { auth, cookieCreations: () => cookieCreations };
}

test("configuration failures never create sessions, authenticate cookies or claim logout success", async () => {
  for (const [failure, reason] of [
    [new AuthConfigurationError("ADMIN_PROJECT_MISSING"), "ADMIN_PROJECT_MISSING"],
    [{ code: "app/invalid-credential", message: "test-only-private-key" }, "ADMIN_CREDENTIALS_INVALID"],
    [{ code: "auth/invalid-credential", message: "test-only-private-path" }, "ADMIN_CREDENTIALS_INVALID"],
    [{ code: "auth/insufficient-permission", message: "test-only-private-provider-payload" }, "ADMIN_PERMISSION_DENIED"],
  ] as const) {
    const { auth, cookieCreations } = failingGateway(failure);
    await assert.rejects(exchangeSessionToken("test-token", auth), assertConfigurationError(reason));
    await assert.rejects(verifyAuthenticationSession("test-cookie", auth), assertConfigurationError(reason));
    await assert.rejects(revokeAuthenticationSession("test-cookie", auth), assertConfigurationError(reason));
    assert.equal(cookieCreations(), 0);
  }
});

test("invalid ID tokens remain unauthorized rather than becoming configuration failures", async () => {
  const { auth, cookieCreations } = failingGateway({ code: "auth/invalid-id-token" });
  await assert.rejects(exchangeSessionToken("invalid-token", auth), {
    code: "INVALID_SESSION", status: 401,
  });
  assert.equal(cookieCreations(), 0);
});

test("unknown provider failures remain generic and expose no raw details", async () => {
  const { auth, cookieCreations } = failingGateway(new Error("test-only-private-provider-payload"));
  await assert.rejects(exchangeSessionToken("test-token", auth), {
    code: "AUTH_UNAVAILABLE", status: 503,
    message: "Authentication is temporarily unavailable. Please try again.",
  });
  assert.equal(cookieCreations(), 0);
});
