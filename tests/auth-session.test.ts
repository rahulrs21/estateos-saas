import assert from "node:assert/strict";
import { test } from "node:test";
import {
  exchangeSessionToken,
  revokeAuthenticationSession,
  verifyAuthenticationSession,
  type SessionAuthGateway,
} from "../src/modules/auth/server/session-core";
import { SESSION_MAX_AGE_SECONDS } from "../src/modules/auth/server/session-policy";

const now = 1_800_000_000;
type Claims = Awaited<ReturnType<SessionAuthGateway["verifyIdToken"]>>;

function verifiedClaims(overrides: Partial<Claims> = {}): Claims {
  return {
    uid: "verified-user-id",
    email: "agent@example.test",
    email_verified: true,
    firebase: { sign_in_provider: "password" },
    auth_time: now - 30,
    ...overrides,
  };
}

// A test-only Firebase port; the production service always uses the Admin SDK.
function gateway(options: {
  claims?: Claims;
  tokenFailure?: Error;
  sessionFailure?: Error;
  createFailure?: Error;
  revokeFailure?: Error;
} = {}) {
  const calls = {
    tokens: [] as { token: string; checkRevoked: boolean }[],
    sessions: [] as { cookie: string; checkRevoked: boolean }[],
    creations: [] as { token: string; expiresIn: number }[],
    revocations: [] as string[],
  };
  const auth: SessionAuthGateway = {
    async verifyIdToken(token, checkRevoked) {
      calls.tokens.push({ token, checkRevoked });
      if (options.tokenFailure) throw options.tokenFailure;
      return options.claims ?? verifiedClaims();
    },
    async verifySessionCookie(cookie, checkRevoked) {
      calls.sessions.push({ cookie, checkRevoked });
      if (options.sessionFailure) throw options.sessionFailure;
      return options.claims ?? verifiedClaims();
    },
    async createSessionCookie(token, { expiresIn }) {
      calls.creations.push({ token, expiresIn });
      if (options.createFailure) throw options.createFailure;
      return "firebase-signed-session-cookie";
    },
    async revokeRefreshTokens(uid) {
      calls.revocations.push(uid);
      if (options.revokeFailure) throw options.revokeFailure;
    },
  };
  return { auth, calls };
}

test("session exchange verifies revocation, allows only verified identity and sets a bounded expiry", async () => {
  const { auth, calls } = gateway();
  const result = await exchangeSessionToken("real-id-token", auth, now);
  assert.deepEqual(calls.tokens, [{ token: "real-id-token", checkRevoked: true }]);
  assert.deepEqual(calls.creations, [{ token: "real-id-token", expiresIn: SESSION_MAX_AGE_SECONDS * 1_000 }]);
  assert.deepEqual(result, {
    cookie: "firebase-signed-session-cookie",
    user: { uid: "verified-user-id", email: "agent@example.test", emailVerified: true },
  });
});

for (const [label, claims] of [
  ["unverified email", verifiedClaims({ email_verified: false })],
  ["missing verification claim", verifiedClaims({ email_verified: undefined })],
  ["missing user identity", verifiedClaims({ uid: "" })],
  ["missing email", verifiedClaims({ email: undefined })],
  ["a non-password provider", verifiedClaims({ firebase: { sign_in_provider: "google.com" } })],
  ["a missing provider", verifiedClaims({ firebase: undefined })],
  ["a stale sign-in", verifiedClaims({ auth_time: now - 301 })],
  ["a future sign-in", verifiedClaims({ auth_time: now + 60 })],
  ["a missing sign-in time", verifiedClaims({ auth_time: undefined })],
  ["an invalid sign-in time", verifiedClaims({ auth_time: Number.NaN })],
] as const) {
  test(`session exchange rejects ${label} before issuing a cookie`, async () => {
    const { auth, calls } = gateway({ claims });
    await assert.rejects(exchangeSessionToken("id-token", auth, now));
    assert.equal(calls.creations.length, 0);
  });
}

for (const code of ["auth/id-token-expired", "auth/id-token-revoked", "auth/user-disabled", "auth/argument-error"]) {
  test(`session exchange rejects Firebase ${code}`, async () => {
    const failure = Object.assign(new Error("Firebase rejected credentials"), { code });
    const { auth, calls } = gateway({ tokenFailure: failure });
    await assert.rejects(exchangeSessionToken("forged-or-invalid-token", auth, now));
    assert.equal(calls.creations.length, 0);
  });
}

test("failed Firebase cookie creation never produces an authenticated result", async () => {
  const { auth } = gateway({ createFailure: new Error("Firebase unavailable") });
  await assert.rejects(exchangeSessionToken("id-token", auth, now));
});

test("a missing session is unauthorized without attempting Firebase verification", async () => {
  const { auth, calls } = gateway();
  assert.equal(await verifyAuthenticationSession(undefined, auth), null);
  assert.equal(await verifyAuthenticationSession("", auth), null);
  assert.equal(calls.sessions.length, 0);
});

test("an established session verifies revocation and does not require a new sign-in every five minutes", async () => {
  const { auth, calls } = gateway({ claims: verifiedClaims({ auth_time: now - 86_400 }) });
  assert.deepEqual(await verifyAuthenticationSession("signed-cookie", auth), {
    uid: "verified-user-id", email: "agent@example.test", emailVerified: true,
  });
  assert.deepEqual(calls.sessions, [{ cookie: "signed-cookie", checkRevoked: true }]);
});

for (const code of ["auth/session-cookie-expired", "auth/session-cookie-revoked", "auth/user-disabled", "auth/user-not-found", "auth/argument-error"]) {
  test(`protected access denies Firebase ${code}`, async () => {
    const failure = Object.assign(new Error("Firebase rejected session"), { code });
    const { auth } = gateway({ sessionFailure: failure });
    assert.equal(await verifyAuthenticationSession("untrusted-cookie", auth), null);
  });
}

test("protected access denies unverified or wrong-provider cookies even after SDK verification", async () => {
  for (const claims of [
    verifiedClaims({ email_verified: false }),
    verifiedClaims({ firebase: { sign_in_provider: "anonymous" } }),
  ]) {
    assert.equal(await verifyAuthenticationSession("signed-cookie", gateway({ claims }).auth), null);
  }
});

test("logout derives the UID from a verified cookie and enables revocation checks", async () => {
  const { auth, calls } = gateway();
  const user = await revokeAuthenticationSession("signed-cookie", auth);
  assert.deepEqual(user, { uid: "verified-user-id", email: "agent@example.test", emailVerified: true });
  assert.deepEqual(calls.sessions, [{ cookie: "signed-cookie", checkRevoked: true }]);
  assert.deepEqual(calls.revocations, ["verified-user-id"]);
});

test("logout without a verified session cannot revoke a client-selected user", async () => {
  const failure = Object.assign(new Error("forged cookie"), { code: "auth/invalid-session-cookie" });
  const { auth, calls } = gateway({ sessionFailure: failure });
  assert.equal(await revokeAuthenticationSession(undefined, auth), null);
  assert.equal(await revokeAuthenticationSession("forged-cookie", auth), null);
  assert.equal(calls.revocations.length, 0);
});

test("an unavailable verifier fails closed rather than returning an authenticated identity", async () => {
  const { auth, calls } = gateway({ sessionFailure: new Error("Firebase unavailable") });
  await assert.rejects(verifyAuthenticationSession("signed-cookie", auth), { status: 503 });
  await assert.rejects(revokeAuthenticationSession("signed-cookie", auth), { status: 503 });
  assert.equal(calls.revocations.length, 0);
});

test("logout propagates provider revocation failures so the endpoint cannot claim successful revocation", async () => {
  const { auth } = gateway({ revokeFailure: new Error("revocation unavailable") });
  await assert.rejects(revokeAuthenticationSession("signed-cookie", auth));
});

test("verified custom roles and organization IDs are never turned into authorization", async () => {
  const claims = { ...verifiedClaims(), name: "  Test Agent  ", role: "admin", organizationId: "other-tenant" };
  const { auth } = gateway({ claims });
  const user = await verifyAuthenticationSession("signed-cookie", auth);
  assert.deepEqual(Object.keys(user ?? {}).sort(), ["email", "emailVerified", "name", "uid"]);
  assert.equal(user?.name, "Test Agent");
  assert.deepEqual((await exchangeSessionToken("id-token", auth, now)).user, user);
});
