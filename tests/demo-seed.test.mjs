import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  assertDemoSeedTarget, assertEmulatorsRunning, canonicalId, demoOrganizationSlug, dubaiTime, fixtureUuid, loadFixtures, validateFixtures,
} from "../scripts/demo-seed-lib.mjs";
import { exportedObjectCount, recoverStorageExport, root, storageFingerprint } from "../scripts/local-db-lib.mjs";

const local = { nodeEnv: "development", projectId: "demo-estateos", dataConnectHost: "127.0.0.1:9399", storageHost: "127.0.0.1:9199" };

test("seed refuses production, non-demo projects, remote hosts and a redirected storage emulator", () => {
  assert.equal(assertDemoSeedTarget(local), true);
  assert.throws(() => assertDemoSeedTarget({ ...local, nodeEnv: "production" }), /production/);
  assert.throws(() => assertDemoSeedTarget({ ...local, projectId: "estateos-development-f8c93" }), /demo-\*/);
  assert.throws(() => assertDemoSeedTarget({ ...local, projectId: undefined }), /demo-\*/);
  assert.throws(() => assertDemoSeedTarget({ ...local, dataConnectHost: "10.0.0.5:9399" }), /SQL Connect emulator must be on 127\.0\.0\.1/);
  assert.throws(() => assertDemoSeedTarget({ ...local, storageHost: "storage.googleapis.com:443" }), /Storage emulator/);
  assert.throws(() => assertDemoSeedTarget({ ...local, presetStorageHost: "http://example.com:9199" }), /STORAGE_EMULATOR_HOST/);
  assert.equal(assertDemoSeedTarget({ ...local, presetStorageHost: "http://127.0.0.1:9199" }), true);
});

test("seed requires the local emulators to be running on the configured ports", () => {
  const hosts = { dataConnectHost: "127.0.0.1:9399", storageHost: "127.0.0.1:9199" };
  assert.doesNotThrow(() => assertEmulatorsRunning({ dataconnect: { host: "127.0.0.1", port: 9399 }, storage: { host: "127.0.0.1", port: 9199 } }, hosts));
  assert.throws(() => assertEmulatorsRunning({ storage: { host: "127.0.0.1", port: 9199 } }, hosts), /SQL Connect emulator is not running/);
  assert.throws(() => assertEmulatorsRunning({ dataconnect: { host: "127.0.0.1", port: 19499 }, storage: { host: "127.0.0.1", port: 9199 } }, hosts), /not running/);
  assert.throws(() => assertEmulatorsRunning({ dataconnect: { host: "127.0.0.1", port: 9399 } }, hosts), /Storage emulator is not running/);
});

test("the committed fixtures are valid, fictional and complete", () => {
  const fixtures = loadFixtures();
  assert.deepEqual(validateFixtures(fixtures), []);
  const { manifest } = fixtures;
  assert.equal(manifest.counts.developers, 5);
  assert.equal(manifest.counts.projects, 10);
  assert.equal(manifest.counts.properties, 30);
  assert.equal(manifest.counts.listings, 30);
  assert.equal(manifest.counts.contacts, 50);
  assert.equal(manifest.counts.leads, 50);
  for (const field of ["projectPhases", "buildings", "leadNotes", "shortlistEntries", "viewings", "followUps"]) assert.ok(manifest.counts[field] > 0, field);
  assert.match(manifest.notice, /fictional/i);
  for (const listing of fixtures.listings) assert.match(listing.description, /Fictional demo record/);
});

test("fixture validation catches broken references and real-looking contact details", () => {
  const fixtures = structuredClone(loadFixtures());
  fixtures.projects[0].developerKey = "DEV-99";
  fixtures.contacts[0].email = "someone@gmail.com";
  fixtures.contacts[1].phone = "+971 50 123 4567";
  fixtures.listings[0].publicationStatus = "PUBLISHED";
  fixtures.leads[1].contactKey = fixtures.leads[0].contactKey;
  const viewingLead = fixtures.leads.find(lead => lead.viewings.length);
  viewingLead.shortlist = [];
  const problems = validateFixtures(fixtures).join("\n");
  for (const expected of [/missing developer DEV-99/, /CT-001 email/, /CT-002 phone/, /must not be published/, /more than one lead/, /needs a shortlist entry/]) assert.match(problems, expected);
});

test("fixture photos exist as PNG files under public/demo-assets", () => {
  for (const property of loadFixtures().properties) {
    for (const photo of property.photos) {
      const bytes = readFileSync(join(root, "public", photo.asset));
      assert.ok(bytes.subarray(1, 4).toString() === "PNG", photo.asset);
      assert.ok(photo.asset.startsWith("demo-assets/"));
    }
  }
});

test("fixture identifiers are stable and per company", () => {
  const a = fixtureUuid("02bde19c-0058-487d-9dae-f135da2c41e0", "lead:LD-001");
  assert.equal(a, fixtureUuid("02BDE19C0058487D9DAEF135DA2C41E0", "lead:LD-001"), "dashed and dashless IDs give the same fixture ID");
  assert.notEqual(a, fixtureUuid("02bde19c0058487d9daef135da2c41e1", "lead:LD-001"));
  assert.notEqual(a, fixtureUuid("02bde19c0058487d9daef135da2c41e0", "lead:LD-002"));
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(canonicalId("AB-cd"), "abcd");
  assert.equal(demoOrganizationSlug("demo-realty-sample", "uid-1"), demoOrganizationSlug("demo-realty-sample", "uid-1"));
  assert.notEqual(demoOrganizationSlug("demo-realty-sample", "uid-1"), demoOrganizationSlug("demo-realty-sample", "uid-2"));
  assert.match(demoOrganizationSlug("demo-realty-sample", "uid-1"), /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("viewings and follow-ups are scheduled in Dubai time and always in the future", () => {
  const now = new Date("2026-10-28T21:30:00Z"); // 01:30 on 29 October in Dubai
  assert.equal(dubaiTime(now, 1, "10:30"), "2026-10-30T06:30:00.000Z");
  assert.equal(dubaiTime(new Date("2026-12-31T10:00:00Z"), 2, "09:00"), "2027-01-02T05:00:00.000Z");
  assert.ok(Date.parse(dubaiTime(now, 1, "00:00")) > now.getTime());
});

test("seed command refuses production and requires an email, without touching any emulator", () => {
  const production = spawnSync(process.execPath, [join(root, "scripts", "seed-demo.mjs"), "--email", "x@example.com"], {
    cwd: root, encoding: "utf8", env: { ...process.env, NODE_ENV: "production" }, windowsHide: true,
  });
  assert.notEqual(production.status, 0);
  assert.match(`${production.stdout}${production.stderr}`, /production/);
  const usage = spawnSync(process.execPath, [join(root, "scripts", "seed-demo.mjs")], { cwd: root, encoding: "utf8", windowsHide: true });
  assert.notEqual(usage.status, 0);
  assert.match(usage.stderr, /Usage: npm run seed:demo/);
});

test("storage fingerprint changes on add, replace and delete but not on order", () => {
  const a = { name: "a.png", generation: "1", metageneration: "1" };
  const b = { name: "b.png", generation: "1", metageneration: "1" };
  assert.equal(storageFingerprint([a, b]), storageFingerprint([b, a]));
  assert.notEqual(storageFingerprint([a]), storageFingerprint([a, b]));
  assert.notEqual(storageFingerprint([a, b]), storageFingerprint([a, { ...b, generation: "2" }]));
  assert.notEqual(storageFingerprint([a, b]), storageFingerprint([a, { ...b, metageneration: "2" }]));
});

test("an interrupted storage save always leaves the newest complete copy in place", () => {
  const directory = mkdtempSync(join(tmpdir(), "estateos-storage-save-"));
  const exportDir = join(directory, "storage-export");
  const save = (path, objects) => {
    mkdirSync(join(path, "storage_export", "metadata", "bucket"), { recursive: true });
    writeFileSync(join(path, "firebase-export-metadata.json"), JSON.stringify({ storage: { path: "storage_export" } }));
    for (let i = 0; i < objects; i += 1) writeFileSync(join(path, "storage_export", "metadata", "bucket", `object-${i}.json`), "{}");
  };
  try {
    // Crash after the old copy was moved aside but before the new copy was moved in.
    save(`${exportDir}.saving`, 3);
    save(`${exportDir}.previous`, 2);
    recoverStorageExport(exportDir);
    assert.equal(exportedObjectCount(exportDir), 3, "the completed new export wins");
    // Crash while the new export was still being written: keep the current copy.
    mkdirSync(`${exportDir}.saving`, { recursive: true });
    recoverStorageExport(exportDir);
    assert.equal(exportedObjectCount(exportDir), 3);
    // Only the previous copy survived.
    rmSync(exportDir, { recursive: true, force: true });
    save(`${exportDir}.previous`, 2);
    recoverStorageExport(exportDir);
    assert.equal(exportedObjectCount(exportDir), 2);
    assert.equal(exportedObjectCount(join(directory, "missing")), 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("demo data files are committed, local data stays ignored", () => {
  for (const path of ["dev-data/fixtures/leads.json", "public/demo-assets/demo-falconridge-developments/demo-prj-01/demo-p-001/photo-1.png"]) {
    assert.equal(spawnSync("git", ["check-ignore", "-q", path], { cwd: root }).status, 1, `${path} must not be git-ignored`);
  }
  for (const path of [".local-data/storage-export.saving/x", ".local-data/storage-export.previous/x"]) {
    assert.equal(spawnSync("git", ["check-ignore", "-q", path], { cwd: root }).status, 0, `${path} must be git-ignored`);
  }
});
