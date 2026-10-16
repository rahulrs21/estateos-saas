import assert from "node:assert/strict";
import { test } from "node:test";
import { CSRF_MAX_AGE_SECONDS, getAuthCookieConfig } from "../src/modules/auth/server/cookie-policy";
import {
  AuthRequestError,
  MAX_SESSION_BODY_BYTES,
  parseSessionRequest,
  validateCsrfRequest,
  validateMutationRequest,
} from "../src/modules/auth/server/request-policy";
import { SESSION_MAX_AGE_SECONDS } from "../src/modules/auth/server/session-policy";

const origin = "https://crm.example.test";
const csrfToken = "A".repeat(43);
const otherToken = "B".repeat(43);

function mutation(headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/auth/session`, {
    method: "POST",
    headers: { origin, "x-csrf-token": csrfToken, "content-type": "application/json", ...headers },
    body: JSON.stringify({ idToken: "id-token" }),
  });
}

function errorWithStatus(status: number) {
  return (error: unknown) => error instanceof AuthRequestError && error.status === status;
}

test("same-origin mutations require a matching valid CSRF token", () => {
  assert.doesNotThrow(() => validateMutationRequest(mutation({ "sec-fetch-site": "same-origin" }), { origin, csrfToken }));
});

for (const suppliedOrigin of [
  "https://attacker.test",
  "https://sub.crm.example.test",
  "http://crm.example.test",
  "https://crm.example.test:444",
  "null",
  "https://crm.example.test.attacker.test",
]) {
  test(`mutation rejects a noncanonical origin: ${suppliedOrigin}`, () => {
    assert.throws(() => validateMutationRequest(mutation({ origin: suppliedOrigin }), { origin, csrfToken }), errorWithStatus(403));
  });
}

test("a missing Origin header cannot be rescued by matching request URL, Host, or forwarded headers", () => {
  const request = mutation({
    host: "crm.example.test",
    "x-forwarded-host": "crm.example.test",
    "x-forwarded-proto": "https",
    "sec-fetch-site": "same-origin",
  });
  request.headers.delete("origin");
  assert.throws(() => validateMutationRequest(request, { origin, csrfToken }), errorWithStatus(403));
});

test("forwarded header spoofing cannot bless an attacker origin", () => {
  const request = mutation({
    origin: "https://attacker.test",
    host: "attacker.test",
    "x-forwarded-host": "crm.example.test",
    "x-forwarded-proto": "https",
  });
  assert.throws(() => validateMutationRequest(request, { origin, csrfToken }), errorWithStatus(403));
});

test("Fetch Metadata cross-site is denied even with otherwise valid origin and token", () => {
  assert.throws(() => validateMutationRequest(mutation({ "sec-fetch-site": "cross-site" }), { origin, csrfToken }), errorWithStatus(403));
});

test("mutations reject a missing, different, malformed, or wrong-length CSRF header", () => {
  for (const token of [otherToken, "", "bad", "!".repeat(43), "A".repeat(44)]) {
    assert.throws(() => validateMutationRequest(mutation({ "x-csrf-token": token }), { origin, csrfToken }), errorWithStatus(403));
  }
  const request = mutation();
  request.headers.delete("x-csrf-token");
  assert.throws(() => validateMutationRequest(request, { origin, csrfToken }), errorWithStatus(403));
});

test("a missing, malformed, or different CSRF cookie is denied", () => {
  for (const cookie of [undefined, "", "invalid", otherToken]) {
    assert.throws(() => validateMutationRequest(mutation(), { origin, csrfToken: cookie }), errorWithStatus(403));
  }
});

test("CSRF token issuance permits browser same-origin GETs and rejects known cross-origin requests", () => {
  assert.doesNotThrow(() => validateCsrfRequest(new Request(`${origin}/api/auth/csrf`, { headers: { "sec-fetch-site": "same-origin" } }), origin));
  assert.throws(() => validateCsrfRequest(new Request(`${origin}/api/auth/csrf`, { headers: { origin: "https://attacker.test" } }), origin), errorWithStatus(403));
  assert.throws(() => validateCsrfRequest(new Request(`${origin}/api/auth/csrf`, { headers: { "sec-fetch-site": "cross-site" } }), origin), errorWithStatus(403));
});

test("session request accepts only a JSON ID token", async () => {
  assert.deepEqual(await parseSessionRequest(mutation({ "content-type": "application/json; charset=UTF-8" })), { idToken: "id-token" });
});

for (const body of [
  { idToken: "token", role: "admin" },
  { idToken: "token", organizationId: "another-tenant" },
  { idToken: "token", uid: "another-user" },
  { idToken: "token", emailVerified: true },
  { idToken: "" },
  { idToken: "   " },
  { idToken: 123 },
  { role: "admin" },
  null,
  ["token"],
]) {
  test(`session body rejects client identity or malformed input: ${JSON.stringify(body)}`, async () => {
    const request = new Request(`${origin}/api/auth/session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    await assert.rejects(parseSessionRequest(request), errorWithStatus(400));
  });
}

test("session body rejects malformed JSON, form submissions, and empty bodies", async () => {
  const malformed = new Request(`${origin}/api/auth/session`, { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
  const empty = new Request(`${origin}/api/auth/session`, { method: "POST", headers: { "content-type": "application/json" } });
  await assert.rejects(parseSessionRequest(malformed), errorWithStatus(400));
  await assert.rejects(parseSessionRequest(empty), errorWithStatus(400));
  await assert.rejects(parseSessionRequest(mutation({ "content-type": "application/x-www-form-urlencoded" })), errorWithStatus(415));
});

test("session body bounds actual streamed bytes rather than trusting Content-Length", async () => {
  const oversized = new Request(`${origin}/api/auth/session`, {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "1" },
    body: JSON.stringify({ idToken: "A".repeat(MAX_SESSION_BODY_BYTES) }),
  });
  await assert.rejects(parseSessionRequest(oversized), errorWithStatus(413));
});

test("session body rejects a declared excessive size or invalid byte count", async () => {
  for (const length of [String(MAX_SESSION_BODY_BYTES + 1), "-1", "1.5", "invalid"]) {
    await assert.rejects(parseSessionRequest(mutation({ "content-length": length })), errorWithStatus(413));
  }
});

test("session parsing rejects invalid UTF-8 rather than silently altering token data", async () => {
  const request = new Request(`${origin}/api/auth/session`, { method: "POST", headers: { "content-type": "application/json" }, body: new Uint8Array([0xff]) });
  await assert.rejects(parseSessionRequest(request), errorWithStatus(400));
});

test("production cookies are host-only, secure, HttpOnly and expire", () => {
  const config = getAuthCookieConfig(true);
  assert.equal(config.session.name, "__Host-estateos_session");
  assert.equal(config.csrf.name, "__Host-estateos_csrf");
  assert.equal(config.session.options.maxAge, SESSION_MAX_AGE_SECONDS);
  assert.equal(config.csrf.options.maxAge, CSRF_MAX_AGE_SECONDS);
  assert.ok(config.session.options.maxAge > 0 && config.session.options.maxAge <= 14 * 86_400);
  for (const { options } of [config.session, config.csrf]) {
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, true);
    assert.equal(options.sameSite, "strict");
    assert.equal(options.path, "/");
    assert.equal("domain" in options, false);
  }
});

test("development cookies preserve HttpOnly, scope and expiry while supporting HTTP localhost", () => {
  const config = getAuthCookieConfig(false);
  for (const { name, options } of [config.session, config.csrf]) {
    assert.equal(name.startsWith("__Host-"), false);
    assert.equal(options.secure, false);
    assert.equal(options.httpOnly, true);
    assert.equal(options.sameSite, "strict");
    assert.equal(options.path, "/");
    assert.ok(options.maxAge > 0);
    assert.equal("domain" in options, false);
  }
});
