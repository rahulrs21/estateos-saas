import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertExpectedOrganization, MAX_LEAD_BODY_BYTES, parseLeadJsonRequest,
} from "../src/modules/leads/server/request-policy";
import { WorkspaceError } from "../src/modules/organizations/server/errors";

const organizationA = "10000000-0000-4000-8000-000000000001";
const organizationB = "20000000-0000-4000-8000-000000000001";
const errorIs = (code: string, status: number) => (error: unknown) =>
  error instanceof WorkspaceError && error.code === code && error.status === status;

function request(body: string | Uint8Array<ArrayBuffer>, headers: Record<string, string> = {}) {
  return new Request("https://estateos.example.test/api/leads", {
    method: "POST", headers: { "content-type": "application/json", ...headers }, body,
  });
}

test("a lead form's company header is a stale-selection check, never tenant authority", () => {
  assert.doesNotThrow(() => assertExpectedOrganization(organizationA, organizationA));
  assert.doesNotThrow(() => assertExpectedOrganization(organizationA.replaceAll("-", ""), organizationA));
  assert.doesNotThrow(() => assertExpectedOrganization(organizationA, organizationA.replaceAll("-", "")));
  assert.throws(() => assertExpectedOrganization(organizationA, organizationB), errorIs("ORGANIZATION_CHANGED", 409));
  assert.throws(() => assertExpectedOrganization(organizationB, organizationA), errorIs("ORGANIZATION_CHANGED", 409));
  for (const expected of [null, "", "org-a", " OWNER ", `${organizationA},${organizationB}`]) {
    assert.throws(() => assertExpectedOrganization(expected, organizationA), errorIs("INVALID_INPUT", 400));
  }
});

test("lead mutation parsing accepts only JSON objects with an explicit JSON content type", async () => {
  assert.deepEqual(await parseLeadJsonRequest(request('{"fullName":"Local buyer"}')),
    { fullName: "Local buyer" });
  assert.deepEqual(await parseLeadJsonRequest(request('{}', { "content-type": "Application/JSON; charset=utf-8" })), {});
  for (const contentType of ["text/plain", "application/x-www-form-urlencoded", "application/jsonp", ""]) {
    await assert.rejects(() => parseLeadJsonRequest(request('{}', { "content-type": contentType })), errorIs("INVALID_CONTENT_TYPE", 415));
  }
  const missing = new Request("https://estateos.example.test/api/leads", { method: "POST", body: new Uint8Array([123, 125]) });
  await assert.rejects(() => parseLeadJsonRequest(missing), errorIs("INVALID_CONTENT_TYPE", 415));
});

test("malformed JSON, primitives, arrays, empty bodies and invalid UTF-8 fail safely", async () => {
  for (const body of ["", "{", "null", "[]", '"buyer"', "123", "true"]) {
    await assert.rejects(() => parseLeadJsonRequest(request(body)), errorIs("INVALID_BODY", 400));
  }
  await assert.rejects(() => parseLeadJsonRequest(request(new Uint8Array([0xff, 0xfe]))), errorIs("INVALID_BODY", 400));
});

test("the lead mutation body bound is measured in bytes at and beyond the configured limit", async () => {
  const prefix = '{"note":"';
  const suffix = '"}';
  const exact = prefix + "a".repeat(MAX_LEAD_BODY_BYTES - prefix.length - suffix.length) + suffix;
  assert.equal(new TextEncoder().encode(exact).byteLength, MAX_LEAD_BODY_BYTES);
  assert.equal(typeof (await parseLeadJsonRequest(request(exact))).note, "string");
  await assert.rejects(() => parseLeadJsonRequest(request(exact + " ")), errorIs("BODY_TOO_LARGE", 413));
  const multibyte = JSON.stringify({ note: "界".repeat(6000) });
  assert.ok(multibyte.length < MAX_LEAD_BODY_BYTES);
  assert.ok(new TextEncoder().encode(multibyte).byteLength > MAX_LEAD_BODY_BYTES);
  await assert.rejects(() => parseLeadJsonRequest(request(multibyte)), errorIs("BODY_TOO_LARGE", 413));
});

test("absent or forged short content lengths cannot bypass actual lead body limits", async () => {
  const body = JSON.stringify({ note: "x".repeat(MAX_LEAD_BODY_BYTES) });
  await assert.rejects(() => parseLeadJsonRequest(request(body)), errorIs("BODY_TOO_LARGE", 413));
  await assert.rejects(() => parseLeadJsonRequest(request(body, { "content-length": "1" })), errorIs("BODY_TOO_LARGE", 413));
  for (const contentLength of [String(MAX_LEAD_BODY_BYTES + 1), "-1", "garbage", "1.5", "1e9", "Infinity"]) {
    await assert.rejects(() => parseLeadJsonRequest(request('{}', { "content-length": contentLength })), errorIs("BODY_TOO_LARGE", 413));
  }
});

test("streamed lead bodies are accumulated within a shared bound and cancelled when oversized", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"note":"'));
      controller.enqueue(new TextEncoder().encode("x".repeat(MAX_LEAD_BODY_BYTES)));
    },
    cancel() { cancelled = true; },
  });
  const streamed = new Request("https://estateos.example.test/api/leads", {
    method: "POST", headers: { "content-type": "application/json" }, body, duplex: "half",
  } as RequestInit);
  await assert.rejects(() => parseLeadJsonRequest(streamed), errorIs("BODY_TOO_LARGE", 413));
  assert.equal(cancelled, true);
});
