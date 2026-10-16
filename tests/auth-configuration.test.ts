import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readFirebaseAdminConfiguration,
  resolveAppOrigin,
} from "../src/modules/auth/server/configuration-policy";

test("missing or mismatched Firebase project configuration fails closed", () => {
  for (const values of [
    {},
    { projectId: "   " },
    { publicProjectId: "public-project-only" },
    { projectId: "server-project", publicProjectId: "different-project" },
  ]) {
    assert.throws(() => readFirebaseAdminConfiguration(values));
  }
});

test("partial server credentials are rejected instead of falling back to another identity", () => {
  assert.throws(() => readFirebaseAdminConfiguration({ projectId: "test-project", clientEmail: "test@example.test" }));
  assert.throws(() => readFirebaseAdminConfiguration({ projectId: "test-project", privateKey: "test-only-invalid-key" }));
});

test("matching projects support managed application default credentials", () => {
  assert.deepEqual(readFirebaseAdminConfiguration({ projectId: " test-project ", publicProjectId: "test-project" }), {
    projectId: "test-project", credentials: undefined,
  });
});

test("explicit test-only credentials normalize escaped newlines without exposing values in errors", () => {
  const values = { projectId: "test-project", clientEmail: " test@example.test ", privateKey: "fake-line-one\\nfake-line-two" };
  const result = readFirebaseAdminConfiguration(values);
  assert.deepEqual(result.credentials, { projectId: "test-project", clientEmail: "test@example.test", privateKey: "fake-line-one\nfake-line-two" });
  assert.throws(() => readFirebaseAdminConfiguration({ ...values, publicProjectId: "different-project" }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message.includes(values.privateKey), false);
    assert.equal(error.message.includes(values.clientEmail.trim()), false);
    return true;
  });
});

test("Firebase Admin-prefixed settings configure the same project and credential pair", () => {
  const result = readFirebaseAdminConfiguration({
    adminProjectId: "test-project",
    publicProjectId: "test-project",
    adminClientEmail: "test@example.test",
    adminPrivateKey: "fake-line-one\\nfake-line-two",
  });
  assert.deepEqual(result, {
    projectId: "test-project",
    credentials: {
      projectId: "test-project",
      clientEmail: "test@example.test",
      privateKey: "fake-line-one\nfake-line-two",
    },
  });
});

test("conflicting canonical and Firebase Admin-prefixed settings are rejected", () => {
  assert.throws(() => readFirebaseAdminConfiguration({
    projectId: "first-project",
    adminProjectId: "second-project",
  }), (error: unknown) => error instanceof Error && "reason" in error &&
    error.reason === "ADMIN_CONFIGURATION_CONFLICT");
  assert.throws(() => readFirebaseAdminConfiguration({
    projectId: "test-project",
    clientEmail: "first@example.test",
    adminClientEmail: "second@example.test",
  }), (error: unknown) => error instanceof Error && "reason" in error &&
    error.reason === "ADMIN_CONFIGURATION_CONFLICT");
});

test("application origin must be explicitly configured, rather than inferred from attacker request headers", () => {
  assert.throws(() => resolveAppOrigin(undefined, false));
  assert.throws(() => resolveAppOrigin("", false));
  assert.throws(() => resolveAppOrigin("not-a-url", false));
});

test("application origin permits HTTP localhost in development and requires HTTPS in production", () => {
  assert.equal(resolveAppOrigin("http://localhost:3000", false), "http://localhost:3000");
  assert.equal(resolveAppOrigin("https://crm.example.test/", true), "https://crm.example.test");
  assert.throws(() => resolveAppOrigin("http://crm.example.test", true));
  assert.throws(() => resolveAppOrigin("http://localhost:3000", true));
});

test("application origin rejects credentials, paths, query strings, fragments and unsafe schemes", () => {
  for (const origin of [
    "https://user:password@crm.example.test",
    "https://crm.example.test/workspace",
    "https://crm.example.test?trusted=1",
    "https://crm.example.test#fragment",
    "javascript:alert(1)",
    "file:///tmp/example",
    "//crm.example.test",
  ]) {
    assert.throws(() => resolveAppOrigin(origin, false));
  }
});
