import assert from "node:assert/strict";
import { test } from "node:test";
import { captureFormSchema, defaultCaptureFields, parsePublicSubmission, type CaptureFormInput } from "../src/modules/lead-capture/validation";
import { localDateStartUtc } from "../src/modules/lead-capture/reporting-policy";

function form(overrides: Partial<CaptureFormInput> = {}): CaptureFormInput {
  return {
    name: "Website inquiry", status: "ACTIVE", branchId: null, projectId: null, fields: defaultCaptureFields,
    consentText: "I agree that the agency may contact me about this inquiry.",
    privacyPolicyUrl: "https://agency.example/privacy", successMessage: "Thank you. Your inquiry has been received.",
    ...overrides,
  };
}

test("lead capture form config requires full name, a contact method, clear consent and HTTPS policy URL", () => {
  assert.equal(captureFormSchema.safeParse(form()).success, true);
  assert.equal(captureFormSchema.safeParse(form({ privacyPolicyUrl: "http://agency.example/privacy" })).success, false);
  assert.equal(captureFormSchema.safeParse(form({ fields: defaultCaptureFields.map((field) => field.key === "FULL_NAME" ? { ...field, required: false } : field) })).success, false);
  assert.equal(captureFormSchema.safeParse(form({ fields: defaultCaptureFields.filter((field) => field.key !== "PHONE" && field.key !== "EMAIL") })).success, false);
  assert.equal(captureFormSchema.safeParse(form({ fields: [...defaultCaptureFields, defaultCaptureFields[0]] })).success, false);
});

test("public submission accepts only configured values and sanitizes attribution", () => {
  const result = parsePublicSubmission(defaultCaptureFields, {
    fields: { FULL_NAME: "  A buyer  ", EMAIL: " Buyer@Example.Test ", PHONE: "+971 50 123 4567", MESSAGE: "Two bedroom apartment" },
    consent: true, honeypot: "", elapsedMs: 1500,
    attribution: { landingPageUrl: "https://homes.example/dubai?utm_source=paid#contact", utmSource: "  portal\n" },
  });
  assert.equal(result?.fullName, "A buyer");
  assert.equal(result?.email, "buyer@example.test");
  assert.equal(result?.message, "Two bedroom apartment");
  assert.equal(result?.attribution.landingPageUrl, "https://homes.example/dubai");
  assert.equal(result?.attribution.utmSource, "portal");
  assert.equal(parsePublicSubmission(defaultCaptureFields, {
    fields: { FULL_NAME: "Buyer", EMAIL: "buyer@example.test", role: "OWNER" }, consent: true, elapsedMs: 1500,
  }), null);
});

test("submission rejects missing consent, missing contact, spam traps and inverted budgets", () => {
  const payload = { fields: { FULL_NAME: "Buyer", EMAIL: "buyer@example.test" }, consent: true, honeypot: "", elapsedMs: 1500 };
  assert.equal(parsePublicSubmission(defaultCaptureFields, { ...payload, consent: false }), null);
  assert.equal(parsePublicSubmission(defaultCaptureFields, { ...payload, fields: { FULL_NAME: "Buyer" } }), null);
  assert.equal(parsePublicSubmission(defaultCaptureFields, { ...payload, honeypot: "filled by bot" }), null);
  assert.equal(parsePublicSubmission(defaultCaptureFields, { ...payload, elapsedMs: 200 }), null);
  const budgetFields = defaultCaptureFields.map((field) => ({ ...field, enabled: field.enabled || field.key === "BUDGET_MIN" || field.key === "BUDGET_MAX" }));
  assert.equal(parsePublicSubmission(budgetFields, { ...payload, fields: { FULL_NAME: "Buyer", EMAIL: "buyer@example.test", BUDGET_MIN: 900, BUDGET_MAX: 500 } }), null);
});

test("analytics calendar bounds use the selected timezone, including DST changes", () => {
  assert.equal(localDateStartUtc("2026-10-21", "Asia/Dubai").toISOString(), "2026-10-20T20:00:00.000Z");
  assert.equal(localDateStartUtc("2026-03-08", "America/New_York").toISOString(), "2026-03-08T05:00:00.000Z");
  assert.equal(localDateStartUtc("2026-03-09", "America/New_York").toISOString(), "2026-03-09T04:00:00.000Z");
});

