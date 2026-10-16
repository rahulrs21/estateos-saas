import assert from "node:assert/strict";
import { test } from "node:test";
import { loginSchema, resetPasswordSchema, signupSchema } from "../src/modules/auth/validation";
import { authErrorMessage, AuthFlowError } from "../src/modules/auth/errors";

test("registration validates full name, email and confirmation without trimming passwords", () => {
  const input = { fullName: "  Test Agent  ", email: " agent@example.test ", password: " Long passphrase ", confirmPassword: " Long passphrase " };
  assert.deepEqual(signupSchema.parse(input), { ...input, fullName: "Test Agent", email: "agent@example.test" });
  for (const invalid of [{ fullName: " " }, { fullName: "x".repeat(121) }, { email: "invalid" }, { password: "short" }, { confirmPassword: "different" }]) {
    assert.equal(signupSchema.safeParse({ ...input, ...invalid }).success, false);
  }
});

test("login accepts existing passwords without imposing registration policy", () => {
  assert.equal(loginSchema.safeParse({ email: "agent@example.test", password: "older" }).success, true);
  assert.equal(loginSchema.safeParse({ email: "agent@example.test", password: "" }).success, false);
  assert.equal(resetPasswordSchema.safeParse({ email: "invalid" }).success, false);
  assert.equal(resetPasswordSchema.parse({ email: " agent@example.test " }).email, "agent@example.test");
});

test("friendly provider errors hide raw details and do not enumerate invalid login identities", () => {
  const messages = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].map(code => authErrorMessage({ code, message: "sensitive provider detail" }));
  assert.equal(new Set(messages).size, 1);
  for (const code of ["auth/email-already-in-use", "auth/weak-password", "auth/network-request-failed", "auth/too-many-requests", "unexpected"]) {
    assert.ok(!authErrorMessage({ code, message: "sensitive provider detail" }).includes("sensitive provider detail"));
  }
  assert.equal(authErrorMessage(new AuthFlowError("EMAIL_NOT_VERIFIED", "Verify your email.")), "Verify your email.");
});
