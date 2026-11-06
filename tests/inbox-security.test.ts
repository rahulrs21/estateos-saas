import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_RETENTION_DAYS, ownedAttachmentPath, retentionCutoff } from "../src/modules/inbox/policy";

// Phase 7A.6 rules: retention cutoffs and the file guard the retention worker uses. Fictional IDs only.
const ORG = "11000000-0000-4000-8000-000000000001";
const OTHER = "21000000-0000-4000-8000-000000000001";
const NOW = Date.parse("2026-11-06T12:00:00Z");

test("retention: the company's period, else 730 days", () => {
  assert.equal(DEFAULT_RETENTION_DAYS, 730);
  assert.equal(retentionCutoff(30, NOW), "2026-10-07T12:00:00.000Z");
  assert.equal(retentionCutoff(null, NOW), new Date(NOW - 730 * 86_400_000).toISOString());
  assert.equal(retentionCutoff(undefined, NOW), retentionCutoff(730, NOW));
});

test("retention deletes only files in the company's own inbox folder", () => {
  const own = `organizations/${ORG}/inbox/attachments/abc.pdf`;
  assert.equal(ownedAttachmentPath(ORG, own), own);
  assert.equal(ownedAttachmentPath(ORG.replaceAll("-", ""), own), own, "an unhyphenated company ID is the same company");
  assert.equal(ownedAttachmentPath(ORG, `organizations/${OTHER}/inbox/attachments/abc.pdf`), null, "never another company's file");
  assert.equal(ownedAttachmentPath(ORG, `organizations/${ORG}/communications/recordings/x.mp3`), null, "never files outside the inbox");
  assert.equal(ownedAttachmentPath(ORG, `organizations/${ORG}/inbox/../communications/x.mp3`), null, "no path traversal");
  assert.equal(ownedAttachmentPath(ORG, `organizations/${ORG}/inbox\\..\\x`), null);
  assert.equal(ownedAttachmentPath(ORG, null), null);
  assert.equal(ownedAttachmentPath("not-a-company", own), null);
});
