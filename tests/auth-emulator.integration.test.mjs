import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { startAuthHttpServer } from "./fixtures/auth-http-server.mjs";

assert.notEqual(process.env.NODE_ENV, "production");
assert.equal(process.env.GCLOUD_PROJECT, "demo-estateos");
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:19099");
assert.ok(process.env.ESTATEOS_AUTH_TEST_OUTPUT, "Run with npm run test:auth:emulator");
const require = createRequire(import.meta.url);
// Use the same SDK module format as the compiled provider operations so Firebase
// error instances remain consistent across the Node test boundary.
const { initializeApp, deleteApp } = require("firebase/app");
const { applyActionCode, confirmPasswordReset, connectAuthEmulator, initializeAuth, inMemoryPersistence, signOut } = require("firebase/auth");
const compiled = relative => require(join(process.env.ESTATEOS_AUTH_TEST_OUTPUT, "src/modules/auth", relative));
const { registerAccount, requestPasswordReset, resendAccountVerification, verifiedSignInToken } = compiled("firebase-operations.js");
const { exchangeSessionToken, verifyAuthenticationSession, revokeAuthenticationSession } = compiled("server/session-core.js");
const origin = "http://127.0.0.1:19099";
const continueUrl = "http://localhost:3000/login";

test("real Firebase Auth Emulator registration and session lifecycle", async t => {
  const suffix = randomBytes(8).toString("hex");
  const email = `estateos-${suffix}@example.test`;
  const password = `Aa1!${randomBytes(24).toString("base64url")}`;
  const client = initializeApp({ projectId: "demo-estateos", apiKey: "local-emulator-only" }, `auth-test-${suffix}`);
  const auth = initializeAuth(client, { persistence: inMemoryPersistence });
  connectAuthEmulator(auth, origin, { disableWarnings: true });
  const admin = initializeAdminApp({ projectId: "demo-estateos" }, `auth-admin-${suffix}`);
  const provider = getAuth(admin);
  let cookie;
  let httpServer;
  async function codeFor(kind) {
    const response = await fetch(`${origin}/emulator/v1/projects/demo-estateos/oobCodes`);
    assert.equal(response.status, 200);
    const { oobCodes } = await response.json();
    const action = oobCodes.filter(row => row.email === email && row.requestType === kind).at(-1);
    assert.ok(action, "The real emulator generated the expected email action");
    return action.oobCode;
  }
  try {
    await t.test("registration stores the full name, sends verification and clears browser identity without granting roles", async () => {
      await registerAccount(auth, { fullName: "Test Agent", email, password }, continueUrl);
      const user = await provider.getUserByEmail(email);
      assert.equal(user.displayName, "Test Agent");
      assert.equal(user.emailVerified, false);
      assert.deepEqual(user.customClaims ?? {}, {});
      assert.equal(auth.currentUser, null);
      await codeFor("VERIFY_EMAIL");
    });
    await t.test("duplicate email registration is rejected and clears browser state", async () => {
      await assert.rejects(registerAccount(auth, { fullName: "Test Agent", email, password }, continueUrl), { code: "auth/email-already-in-use" });
      assert.equal(auth.currentUser, null);
    });
    await t.test("unverified login is rejected by both client policy and the real server exchange", async () => {
      await assert.rejects(verifiedSignInToken(auth, email, password), { code: "EMAIL_NOT_VERIFIED" });
      const unverifiedToken = await auth.currentUser.getIdToken(true);
      await assert.rejects(exchangeSessionToken(unverifiedToken, provider), { code: "EMAIL_NOT_VERIFIED" });
      await signOut(auth);
      await resendAccountVerification(auth, email, password, continueUrl);
      assert.equal(auth.currentUser, null);
    });
    await t.test("invalid credentials are rejected by Firebase", async () => {
      await assert.rejects(verifiedSignInToken(auth, email, randomBytes(24).toString("hex")), error => ["auth/invalid-credential", "auth/wrong-password", "auth/invalid-login-credentials"].includes(error.code));
    });
    await t.test("email verification enables recent verified login and revocation-checked server sessions", async () => {
      await applyActionCode(auth, await codeFor("VERIFY_EMAIL"));
      const token = await verifiedSignInToken(auth, email, password);
      const result = await exchangeSessionToken(token, provider);
      cookie = result.cookie;
      assert.equal(result.user.email, email);
      assert.equal(result.user.emailVerified, true);
      assert.deepEqual(await verifyAuthenticationSession(cookie, provider), result.user);
      await assert.rejects(exchangeSessionToken(token, provider, Date.now() / 1000 + 600), { code: "RECENT_LOGIN_REQUIRED" });
      await signOut(auth);
    });
    await t.test("real Next session, CSRF, workspace and logout endpoints enforce authorization", async () => {
      httpServer = await startAuthHttpServer();
      const appOrigin = httpServer.origin;
      const token = await verifiedSignInToken(auth, email, password);
      await signOut(auth);
      const call = (path, options) => fetch(appOrigin + path, { ...options, signal: AbortSignal.timeout(45000) });
      const pair = (response, name) => response.headers.getSetCookie().find(value => value.startsWith(name + "=")).split(";", 1)[0];
      assert.equal((await call("/api/auth/session")).status, 401);
      assert.equal((await call("/api/leads")).status, 401);
      for (const path of ["/workspace/dashboard", "/workspace/leads", "/workspace/tasks"]) {
        const response = await call(path);
        assert.ok([200, 307].includes(response.status));
        const html = await response.text();
        assert.ok(html.includes("/login") && (html.includes("NEXT_REDIRECT") || html.includes("Welcome back")), "Anonymous workspace rendering redirects before private content");
      }
      assert.equal((await call("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }) })).status, 403);
      async function csrf(session = "") {
        const response = await call("/api/auth/csrf");
        assert.equal(response.status, 200);
        const { csrfToken } = await response.json();
        return { Origin: appOrigin, "X-CSRF-Token": csrfToken, Cookie: [session, pair(response, "estateos_csrf")].filter(Boolean).join("; ") };
      }
      const session = await call("/api/auth/session", { method: "POST", headers: { ...await csrf(), "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }) });
      assert.equal(session.status, 200);
      const cookieHeader = session.headers.getSetCookie().find(value => value.startsWith("estateos_session="));
      assert.match(cookieHeader, /HttpOnly/i);
      assert.match(cookieHeader, /SameSite=strict/i);
      assert.match(cookieHeader, /Max-Age=432000/i);
      const sessionCookie = pair(session, "estateos_session");
      assert.equal((await call("/api/auth/session", { headers: { Cookie: sessionCookie } })).status, 200);
      const dashboard = await call("/workspace/dashboard", { headers: { Cookie: sessionCookie } });
      assert.equal(dashboard.status, 200);
      assert.ok((await dashboard.text()).includes("Dashboard"));
      const login = await call("/login", { headers: { Cookie: sessionCookie } });
      assert.ok((await login.text()).includes("/workspace/dashboard"));
      assert.equal((await call("/api/auth/logout", { method: "POST", headers: { Cookie: sessionCookie } })).status, 403);
      await new Promise(resolve => setTimeout(resolve, 1200));
      const logout = await call("/api/auth/logout", { method: "POST", headers: await csrf(sessionCookie) });
      assert.equal(logout.status, 200);
      assert.match(logout.headers.getSetCookie().find(value => value.startsWith("estateos_session=")), /Max-Age=0/i);
      assert.equal((await call("/api/auth/session", { headers: { Cookie: sessionCookie } })).status, 401);
      const absentLogout = await call("/api/auth/logout", { method: "POST", headers: await csrf() });
      assert.equal(absentLogout.status, 200);
      // Refresh the direct-provider session after all-device logout for the next case.
      const fresh = await verifiedSignInToken(auth, email, password);
      cookie = (await exchangeSessionToken(fresh, provider)).cookie;
      await signOut(auth);
    });
    await t.test("logout revokes the actual session and forged cookies fail closed", async () => {
      await new Promise(resolve => setTimeout(resolve, 1200)); // Firebase revocation timestamps use whole seconds.
      const user = await revokeAuthenticationSession(cookie, provider);
      assert.equal(user.email, email);
      assert.equal(await verifyAuthenticationSession(cookie, provider), null);
      assert.equal(await verifyAuthenticationSession("invalid-cookie", provider), null);
      assert.equal(await revokeAuthenticationSession(undefined, provider), null);
    });
    await t.test("password reset sends a real action and invalidates the old password", async () => {
      await requestPasswordReset(auth, email, continueUrl);
      const nextPassword = `Aa1!${randomBytes(24).toString("base64url")}`;
      await confirmPasswordReset(auth, await codeFor("PASSWORD_RESET"), nextPassword);
      await assert.rejects(verifiedSignInToken(auth, email, password));
      assert.ok(await verifiedSignInToken(auth, email, nextPassword));
      await signOut(auth);
      await requestPasswordReset(auth, `absent-${suffix}@example.test`, continueUrl);
    });
  } finally {
    await httpServer?.stop();
    await signOut(auth);
    await deleteApp(client);
    await deleteAdminApp(admin);
  }
});
