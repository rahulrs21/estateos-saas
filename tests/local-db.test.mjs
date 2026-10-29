import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  assertManagedPath, assertResetAllowed, backupRoot, emulatorEnvironment, legacySqlDataDir, localConfig, prepareStorageImport,
  root, snapshotsToPrune, sqlDataDir, storageExportDir, testDataConnectHost, timestamp,
} from "../scripts/local-db-lib.mjs";

test("development and default emulator configs share one persistent database outside scratch and compiler folders", () => {
  const config = localConfig();
  assert.equal(config.dataConnect, "127.0.0.1:9399");
  assert.ok(sqlDataDir.endsWith(join(".local-data", "sql-connect")));
  const defaults = JSON.parse(readFileSync(join(root, "firebase.json"), "utf8"));
  assert.equal(defaults.emulators.dataconnect.dataDir, ".local-data/sql-connect");
  const tests = JSON.parse(readFileSync(join(root, "firebase.test.json"), "utf8"));
  assert.notEqual(tests.emulators.dataconnect.dataDir, ".local-data/sql-connect", "Integration tests must never use the development database.");
  for (const path of [sqlDataDir, storageExportDir, backupRoot]) {
    assert.ok(!path.includes(`${join(root, ".tmp")}`) && !path.includes(".dataconnect"), path);
  }
});

test("persistent data and backups are excluded from Git", () => {
  for (const path of [".local-data/sql-connect/pg17/PG_VERSION", ".local-backups/sql-connect/auto-x/pg17/PG_VERSION", ".local-data/storage-export/firebase-export-metadata.json"]) {
    const result = spawnSync("git", ["check-ignore", "-q", path], { cwd: root });
    assert.equal(result.status, 0, `${path} must be git-ignored`);
  }
});

test("destructive resets are limited to the isolated test emulator unless explicitly confirmed", () => {
  assert.equal(assertResetAllowed({ host: testDataConnectHost(), projectId: "demo-estateos-test" }), "test");
  assert.throws(() => assertResetAllowed({ host: "127.0.0.1:9399", projectId: "demo-estateos" }), /Refusing to reset/);
  assert.throws(() => assertResetAllowed({ host: testDataConnectHost(), projectId: "demo-estateos" }), /Refusing to reset/);
  assert.throws(() => assertResetAllowed({ host: "127.0.0.1:9399", projectId: "demo-estateos-test" }), /Refusing to reset/);
  assert.throws(() => assertResetAllowed({ host: "127.0.0.1:9399", projectId: "demo-estateos", confirmation: "yes" }), /Refusing to reset/);
  assert.equal(assertResetAllowed({ host: "127.0.0.1:9399", projectId: "demo-estateos", confirmation: "delete-local-data" }), "confirmed");
});

test("snapshot retention removes only the oldest snapshots of the same kind", () => {
  const names = ["auto-2026-01-03", "auto-2026-01-01", "manual-2026-01-01", "auto-2026-01-02", "exit-2026-01-01", "pre-restore-2026-01-01"];
  assert.deepEqual(snapshotsToPrune(names, "auto-", 2), ["auto-2026-01-01"]);
  assert.deepEqual(snapshotsToPrune(names, "auto-", 10), []);
  assert.deepEqual(snapshotsToPrune(names, "exit-", 0), ["exit-2026-01-01"]);
  assert.ok(timestamp(new Date("2026-01-02T00:00:00Z")) > timestamp(new Date("2026-01-01T23:59:59Z")), "timestamps sort chronologically");
  assert.doesNotMatch(timestamp(), /[:.]/);
});

test("storage import never lets the Firebase CLI overwrite the persistent database", () => {
  const directory = mkdtempSync(join(tmpdir(), "estateos-storage-import-"));
  try {
    const exportDir = join(directory, "export"), backups = join(directory, "backups");
    mkdirSync(join(exportDir, "dataconnect_export"), { recursive: true });
    mkdirSync(join(exportDir, "storage_export"), { recursive: true });
    writeFileSync(join(exportDir, "dataconnect_export", "postgres.tar.gz"), "dump");
    writeFileSync(join(exportDir, "firebase-export-metadata.json"), JSON.stringify({ version: "15.34.0", storage: { version: "15.34.0", path: "storage_export" }, dataconnect: { version: "15.34.0", path: "dataconnect_export" } }));
    const result = prepareStorageImport(exportDir, backups, new Date("2026-10-26T10:00:00Z"));
    assert.equal(result.importDir, exportDir);
    const metadata = JSON.parse(readFileSync(join(exportDir, "firebase-export-metadata.json"), "utf8"));
    assert.equal(metadata.dataconnect, undefined, "Data Connect removed from import metadata");
    assert.ok(metadata.storage);
    assert.ok(!existsSync(join(exportDir, "dataconnect_export")));
    assert.equal(readFileSync(join(result.archivedDump, "postgres.tar.gz"), "utf8"), "dump", "clean-exit dump archived as a backup");
    assert.deepEqual(prepareStorageImport(exportDir, backups).archivedDump, null, "idempotent");
    assert.deepEqual(prepareStorageImport(join(directory, "missing"), backups), { importDir: null, archivedDump: null });
    writeFileSync(join(exportDir, "firebase-export-metadata.json"), JSON.stringify({ version: "15.34.0" }));
    assert.equal(prepareStorageImport(exportDir, backups).importDir, null, "no --import without a storage export");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("tooling refuses to modify paths outside the local database folders", () => {
  assert.ok(assertManagedPath(join(backupRoot, "manual-x")));
  assert.ok(assertManagedPath(join(sqlDataDir, "pg17")));
  assert.ok(assertManagedPath(legacySqlDataDir));
  for (const path of [root, join(root, "src"), join(root, ".tmp"), join(root, "dataconnect"), tmpdir()]) assert.throws(() => assertManagedPath(path), /Refusing/);
});

test("sandbox overrides are accepted only inside .tmp", () => {
  const probe = `import("./scripts/local-db-lib.mjs").then(m => console.log(m.sqlDataDir)).catch(e => { console.error(e.message); process.exit(3); })`;
  const run = extra => spawnSync(process.execPath, ["--input-type=module", "-e", probe], { cwd: root, encoding: "utf8", env: { ...process.env, ...extra } });
  assert.equal(run({ ESTATEOS_LOCAL_ROOT: "src" }).status, 3);
  assert.equal(run({ ESTATEOS_LOCAL_ROOT: "../elsewhere" }).status, 3);
  const sandboxed = run({ ESTATEOS_LOCAL_ROOT: ".tmp/unit-sandbox" });
  assert.equal(sandboxed.status, 0, sandboxed.stderr);
  assert.ok(sandboxed.stdout.trim().endsWith(join(".tmp", "unit-sandbox", ".local-data", "sql-connect")));
});

test("Next.js receives the same emulator variables as firebase emulators:exec provided", () => {
  const variables = emulatorEnvironment(localConfig());
  assert.equal(variables.DATA_CONNECT_EMULATOR_HOST, "127.0.0.1:9399");
  assert.equal(variables.FIREBASE_DATA_CONNECT_EMULATOR_HOST, "http://127.0.0.1:9399");
  assert.equal(variables.FIREBASE_STORAGE_EMULATOR_HOST, "127.0.0.1:9199");
  assert.equal(variables.STORAGE_EMULATOR_HOST, "http://127.0.0.1:9199");
  assert.equal(variables.FIREBASE_EMULATOR_HUB, "127.0.0.1:4401");
  assert.equal(variables.GCLOUD_PROJECT, "demo-estateos");
  assert.deepEqual(JSON.parse(variables.FIREBASE_CONFIG), { projectId: "demo-estateos", storageBucket: "demo-estateos.appspot.com", databaseURL: "https://demo-estateos.firebaseio.com" });
  assert.ok(!Object.keys(variables).some(key => key.includes("AUTH")), "Authentication configuration is unchanged");
});
