import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {test} from "node:test";

test("Firebase Storage rules reject browser uploads and reads of private inventory paths", async () => {
  const bucket = "demo-estateos-test.appspot.com";
  const objectPath = `organizations/test-org/properties/test-property/${randomUUID()}.jpg`;
  const root = `http://127.0.0.1:19599/v0/b/${bucket}/o`;
  const upload = await fetch(`${root}?uploadType=media&name=${encodeURIComponent(objectPath)}`, {
    method: "POST",
    headers: {"content-type": "image/jpeg"},
    body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  assert.ok([401, 403].includes(upload.status), `Expected Storage rules to reject a public write, got ${upload.status}.`);

  const read = await fetch(`${root}/${encodeURIComponent(objectPath)}`);
  assert.ok([401, 403].includes(read.status), `Expected Storage rules to reject a public read, got ${read.status}.`);
});
