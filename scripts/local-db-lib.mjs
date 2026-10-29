import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Local development database layout. Only these two git-ignored directories
 * hold company data; `.tmp/` is disposable scratch space and `.dataconnect/`
 * is compiler output, so neither may contain a database.
 */
export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Test-only overrides (scripts/test-local-persistence.mjs) relocate everything
 * into a sandbox under .tmp/ with a separate demo project. They are refused
 * anywhere else, so normal use always targets the paths below.
 */
function sandboxPath(name) {
  const value = process.env[name];
  if (!value) return null;
  const absolute = resolve(root, value);
  const rel = relative(join(root, ".tmp"), absolute);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error(`${name} must point inside .tmp/ (test sandbox only).`);
  return absolute;
}
const sandboxRoot = sandboxPath("ESTATEOS_LOCAL_ROOT");
const localRoot = sandboxRoot ?? root;
export const DEV_PROJECT_ID = sandboxRoot && process.env.ESTATEOS_LOCAL_PROJECT?.startsWith("demo-") ? process.env.ESTATEOS_LOCAL_PROJECT : "demo-estateos";
/** Absolute config path. The Firebase CLI runs from its directory, so emulator logs land beside it. */
export const LOCAL_CONFIG = (sandboxRoot && sandboxPath("ESTATEOS_LOCAL_CONFIG")) || join(root, "firebase.local.json");
export const LOCAL_CONFIG_DIR = dirname(LOCAL_CONFIG);
export const dataRoot = join(localRoot, ".local-data");
export const sqlDataDir = join(dataRoot, "sql-connect");
export const storageExportDir = join(dataRoot, "storage-export");
export const backupRoot = join(localRoot, ".local-backups", "sql-connect");
/** Pre-persistence location; copied once, never modified or deleted by tooling. */
export const legacySqlDataDir = sandboxPath("ESTATEOS_LEGACY_DATA_DIR") ?? join(root, ".tmp", "sql-connect-local", "data");
export const AUTO_SNAPSHOTS_KEPT = 10;
export const EXIT_SNAPSHOTS_KEPT = 10;

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function localConfig() {
  const config = readJson(LOCAL_CONFIG);
  const emulators = config.emulators;
  const configured = resolve(LOCAL_CONFIG_DIR, emulators.dataconnect.dataDir);
  if (configured !== sqlDataDir) throw new Error(`${relative(root, LOCAL_CONFIG)} dataDir must be ${relative(LOCAL_CONFIG_DIR, sqlDataDir)} (found ${emulators.dataconnect.dataDir}).`);
  return {
    dataConnect: `${emulators.dataconnect.host}:${emulators.dataconnect.port}`,
    postgresPort: emulators.dataconnect.postgresPort,
    storage: `${emulators.storage.host}:${emulators.storage.port}`,
    hub: `${emulators.hub.host}:${emulators.hub.port}`,
    ports: [emulators.dataconnect.port, emulators.dataconnect.postgresPort, emulators.storage.port, emulators.hub.port, emulators.logging.port],
  };
}

/** Test emulator host from firebase.test.json; the only target allowed to reset without confirmation. */
export function testDataConnectHost() {
  const dataconnect = readJson(join(root, "firebase.test.json")).emulators.dataconnect;
  return `${dataconnect.host}:${dataconnect.port}`;
}

export function firebaseCliRoot() {
  const require = createRequire(import.meta.url);
  try {
    return dirname(require.resolve("firebase-tools/package.json"));
  } catch {
    const result = process.platform === "win32"
      ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm root -g"], { encoding: "utf8", windowsHide: true })
      : spawnSync("npm", ["root", "-g"], { encoding: "utf8" });
    if (result.status !== 0) throw new Error("Install Firebase CLI before using local SQL Connect.");
    return join(result.stdout.trim(), "firebase-tools");
  }
}

export function portInUse(port, host = "127.0.0.1") {
  return new Promise(resolvePort => {
    const server = net.createServer();
    server.once("error", error => resolvePort(error.code === "EADDRINUSE" || error.code === "EACCES"));
    server.once("listening", () => server.close(() => resolvePort(false)));
    server.listen(port, host);
  });
}

export async function busyPorts(ports) {
  const busy = [];
  for (const port of ports) if (await portInUse(port)) busy.push(port);
  return busy;
}

/** Filesystem-safe UTC timestamp, sortable as text. */
export function timestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function hasDatabase(dataDir) {
  return existsSync(join(dataDir, "pg17", "PG_VERSION"));
}

/** Refuses paths outside the repository's local data and backup directories. */
export function assertManagedPath(path) {
  const allowed = [dataRoot, dirname(backupRoot), legacySqlDataDir];
  const absolute = resolve(path);
  if (!allowed.some(base => { const rel = relative(base, absolute); return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel)); })) {
    throw new Error(`Refusing to modify ${absolute}: outside local database directories.`);
  }
  return absolute;
}

/** Cold copy of a stopped database directory. Never call while an emulator is running. */
export function copyDatabase(source, target) {
  assertManagedPath(target);
  if (existsSync(target)) throw new Error(`Backup target already exists: ${target}`);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true, errorOnExist: true, force: false });
}

/** Backup names, newest first, that exceed the retention count for a prefix. */
export function snapshotsToPrune(names, prefix, keep) {
  return names.filter(name => name.startsWith(prefix)).sort().reverse().slice(keep);
}

export function pruneSnapshots(prefix, keep) {
  if (!existsSync(backupRoot)) return [];
  const removed = snapshotsToPrune(readdirSync(backupRoot), prefix, keep);
  for (const name of removed) rmSync(assertManagedPath(join(backupRoot, name)), { recursive: true, force: true });
  return removed;
}

export function listBackups() {
  if (!existsSync(backupRoot)) return [];
  return readdirSync(backupRoot).sort().reverse().map(name => {
    const path = join(backupRoot, name);
    const kind = existsSync(join(path, "pg17")) ? "files"
      : existsSync(join(path, "postgres.tar.gz")) || existsSync(join(path, "dataconnect_export", "postgres.tar.gz")) ? "export" : "unknown";
    return { name, path, kind, modified: statSync(path).mtime };
  });
}

/**
 * Prepares the storage export for `--import`. The Firebase CLI would also
 * import a Data Connect dump from the same folder and overwrite the persistent
 * database with it (losing anything written after that export), so the dump is
 * moved into the backups and removed from the import metadata.
 * Returns the import directory, or null when there is nothing to import.
 */
export function prepareStorageImport(exportDir = storageExportDir, backups = backupRoot, now = new Date()) {
  recoverStorageExport(exportDir);
  const metadataPath = join(exportDir, "firebase-export-metadata.json");
  if (!existsSync(metadataPath)) return { importDir: null, archivedDump: null };
  const metadata = readJson(metadataPath);
  let archivedDump = null;
  const dump = join(exportDir, "dataconnect_export", "postgres.tar.gz");
  if (existsSync(dump)) {
    archivedDump = join(backups, `exit-${timestamp(now)}`);
    mkdirSync(archivedDump, { recursive: true });
    renameSync(dump, join(archivedDump, "postgres.tar.gz"));
  }
  rmSync(join(exportDir, "dataconnect_export"), { recursive: true, force: true });
  if (metadata.dataconnect) {
    delete metadata.dataconnect;
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }
  return { importDir: metadata.storage ? exportDir : null, archivedDump };
}

/** Uploaded-file bucket used by dev:local; the app reads the same value from FIREBASE_STORAGE_BUCKET. */
export function localStorageBucket(projectId = DEV_PROJECT_ID) {
  return process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;
}

/** Objects in a running Storage emulator bucket (GCS JSON API, admin view, rules not applied). */
export async function listStorageObjects(storageHost, bucket) {
  const items = [];
  let pageToken;
  do {
    const url = new URL(`http://${storageHost}/storage/v1/b/${encodeURIComponent(bucket)}/o`);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (response.status === 404) return items;
    if (!response.ok) throw new Error(`Storage emulator listing failed (${response.status}).`);
    const body = await response.json();
    items.push(...(body.items ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);
  return items;
}

/** Changes whenever an object is added, replaced, deleted or has its metadata changed. */
export function storageFingerprint(items) {
  return items.map(item => `${item.name}#${item.generation}#${item.metageneration}`).sort().join("\n");
}

/** Number of stored objects in an emulator export folder (one metadata file per object). */
export function exportedObjectCount(exportDir = storageExportDir) {
  const metadataRoot = join(exportDir, "storage_export", "metadata");
  if (!existsSync(metadataRoot)) return 0;
  let count = 0;
  const walk = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(directory, entry.name));
      else if (entry.name.endsWith(".json")) count += 1;
    }
  };
  walk(metadataRoot);
  return count;
}

const storageStaging = (exportDir) => `${exportDir}.saving`;
const storagePrevious = (exportDir) => `${exportDir}.previous`;
/** The real export folder is checked against the managed directories; unit tests pass a temporary one. */
const managedFor = exportDir => path => (exportDir === storageExportDir ? assertManagedPath(path) : path);

/**
 * Finishes a save that was interrupted between the two renames in
 * `saveStorageExport`, so the newest complete copy is always the one imported.
 */
export function recoverStorageExport(exportDir = storageExportDir) {
  const managed = managedFor(exportDir);
  const metadata = path => existsSync(join(path, "firebase-export-metadata.json"));
  const previous = storagePrevious(exportDir);
  const staging = storageStaging(exportDir);
  if (!metadata(exportDir)) {
    const candidate = [staging, previous].find(metadata);
    if (candidate) {
      rmSync(managed(exportDir), { recursive: true, force: true });
      renameSync(candidate, exportDir);
    }
  }
  for (const leftover of [staging, previous]) if (existsSync(leftover)) rmSync(managed(leftover), { recursive: true, force: true });
}

function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt += 1) {
    try { renameSync(from, to); return; } catch (error) {
      // Windows briefly locks folders that antivirus or the indexer is reading.
      if (attempt >= 20 || !["EPERM", "EBUSY", "EACCES"].includes(error.code)) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
}

/**
 * Saves the running Storage emulator's files while it runs, through the
 * emulator hub's export endpoint limited to Storage. The export is written to a
 * staging folder and swapped in, so a crash mid-save keeps the previous copy.
 */
export async function saveStorageExport(config, exportDir = storageExportDir) {
  const managed = managedFor(exportDir);
  const staging = managed(storageStaging(exportDir));
  const previous = managed(storagePrevious(exportDir));
  rmSync(staging, { recursive: true, force: true });
  const response = await fetch(`http://${config.hub}/_admin/export`, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({ path: staging, initiatedBy: "estateos-autosave", targets: ["storage"] }),
  });
  if (!response.ok) throw new Error(`Storage export failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  if (!existsSync(join(staging, "firebase-export-metadata.json"))) throw new Error("Storage export finished without metadata.");
  rmSync(previous, { recursive: true, force: true });
  if (existsSync(exportDir)) renameWithRetry(exportDir, previous);
  renameWithRetry(staging, exportDir);
  rmSync(previous, { recursive: true, force: true });
  return exportedObjectCount(exportDir);
}

/**
 * Best-effort owners of listening ports (PID and process name), so a port
 * conflict names the leftover process instead of only the port.
 */
export function portOwners(ports) {
  const owners = new Map();
  if (process.platform === "win32") {
    const netstat = spawnSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8", windowsHide: true });
    for (const line of (netstat.stdout ?? "").split(/\r?\n/)) {
      const match = /^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/.exec(line);
      if (match && ports.includes(Number(match[1]))) owners.set(Number(match[1]), { pid: Number(match[2]) });
    }
    for (const owner of owners.values()) {
      const task = spawnSync("tasklist", ["/FI", `PID eq ${owner.pid}`, "/FO", "CSV", "/NH"], { encoding: "utf8", windowsHide: true });
      owner.name = /^"([^"]+)"/.exec(task.stdout ?? "")?.[1] ?? "unknown";
    }
  } else {
    for (const port of ports) {
      const lsof = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpc"], { encoding: "utf8" });
      const pid = /^p(\d+)/m.exec(lsof.stdout ?? "")?.[1];
      if (pid) owners.set(port, { pid: Number(pid), name: /^c(.+)$/m.exec(lsof.stdout)?.[1] ?? "unknown" });
    }
  }
  return owners;
}

/**
 * Emulator variables `firebase emulators:exec` gives its script, reproduced for
 * `next dev` when the emulators run under `emulators:start`.
 */
export function emulatorEnvironment(config, projectId = DEV_PROJECT_ID) {
  return {
    GCLOUD_PROJECT: projectId,
    FIREBASE_CONFIG: JSON.stringify({ projectId, storageBucket: `${projectId}.appspot.com`, databaseURL: `https://${projectId}.firebaseio.com` }),
    FIREBASE_DATA_CONNECT_EMULATOR_HOST: `http://${config.dataConnect}`,
    DATA_CONNECT_EMULATOR_HOST: config.dataConnect,
    FIREBASE_DATACONNECT_EMULATOR_HOST: config.dataConnect,
    FIREBASE_STORAGE_EMULATOR_HOST: config.storage,
    STORAGE_EMULATOR_HOST: `http://${config.storage}`,
    FIREBASE_EMULATOR_HUB: config.hub,
  };
}

/**
 * Destructive local resets (`ResetEstateOS`) may run only against the isolated
 * integration-test emulator, or against the development emulator when the
 * caller explicitly confirms. This prevents tests or `sql:seed` from wiping
 * `dev:local` company data because a terminal still points at it.
 */
export function assertResetAllowed({ host, projectId, confirmation }) {
  if (host === testDataConnectHost() && projectId === "demo-estateos-test") return "test";
  if (confirmation === "delete-local-data") return "confirmed";
  throw new Error(
    `Refusing to reset ${host || "an unknown emulator"} (project ${projectId}). Destructive resets run only against the ` +
    `integration-test emulator (${testDataConnectHost()}, demo-estateos-test). To intentionally erase local development data, ` +
    "run `npm run db:backup`, then set ESTATEOS_CONFIRM_LOCAL_RESET=delete-local-data.",
  );
}
