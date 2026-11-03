import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmdirSync } from "node:fs";
import { join, relative } from "node:path";
import {
  AUTO_SNAPSHOTS_KEPT, EXIT_SNAPSHOTS_KEPT, DEV_PROJECT_ID, LOCAL_CONFIG, LOCAL_CONFIG_DIR, backupRoot, busyPorts, copyDatabase, dataRoot, emulatorEnvironment,
  exportedObjectCount, firebaseCliCommand, firebaseCliRoot, hasDatabase, legacySqlDataDir, listStorageObjects, localConfig, localStorageBucket, portOwners, prepareStorageImport,
  pruneSnapshots, root, saveStorageExport, sqlDataDir, storageExportDir, storageFingerprint, timestamp,
} from "./local-db-lib.mjs";
import { envValue, startAutomationWorker } from "./automation-worker.mjs";
import { repairAutomationDraft } from "./repair-automation-draft.mjs";

/*
 * Local development: persistent SQL Connect (PGlite) + Storage emulators and Next.js.
 *
 * The emulators run under `firebase emulators:start`, which closes the database
 * cleanly on Ctrl+C or when the terminal closes (SIGINT/SIGHUP). The previous
 * `emulators:exec` wrapper registered no signal handlers, so every stop killed
 * PGlite without closing it.
 */
if (process.env.NODE_ENV === "production") throw new Error("Local database development cannot run in production.");
const config = localConfig();
// --emulators-only (npm run sql:emulators): same database, snapshots and clean shutdown, without Next.js.
const emulatorsOnly = process.argv.includes("--emulators-only");
const show = path => relative(root, path) || ".";

const busy = await busyPorts(emulatorsOnly ? config.ports : [...config.ports, 3000]);
if (busy.length) {
  console.error(`Ports ${busy.join(", ")} are already in use. Another dev:local, emulator or Next.js server is running.`);
  console.error("Stop it first (one Ctrl+C in its terminal, then wait). Two emulators must never open the same database directory.");
  const owners = portOwners(busy);
  if (owners.size) {
    for (const [port, owner] of owners) console.error(`  port ${port}: ${owner.name} (PID ${owner.pid})`);
    const pids = [...new Set([...owners.values()].map(owner => owner.pid))];
    const stop = process.platform === "win32" ? pids.map(pid => `taskkill /PID ${pid} /T`).join(" && ") : `kill -INT ${pids.join(" ")}`;
    console.error(`If no terminal is running dev:local any more, these are leftovers. Stop them with:
  ${stop}
then run npm run dev:local again.`);
  }
  process.exit(1);
}

mkdirSync(dataRoot, { recursive: true });
if (!hasDatabase(sqlDataDir)) {
  if (existsSync(sqlDataDir) && readdirSync(sqlDataDir).length) {
    console.error(`${show(sqlDataDir)} contains files but no PostgreSQL database. Inspect or restore it (npm run db:restore) before starting.`);
    process.exit(1);
  }
  if (existsSync(sqlDataDir)) rmdirSync(sqlDataDir);
  if (hasDatabase(legacySqlDataDir)) {
    // One-time move from the disposable .tmp location. The original is left untouched.
    copyDatabase(legacySqlDataDir, sqlDataDir);
    console.log(`Copied the existing local database from ${show(legacySqlDataDir)} to ${show(sqlDataDir)}.`);
  } else {
    console.log(`No local database yet; the emulator will create one in ${show(sqlDataDir)}.`);
  }
}
if (hasDatabase(sqlDataDir)) {
  const snapshot = join(backupRoot, `auto-${timestamp()}`);
  copyDatabase(sqlDataDir, snapshot);
  // Uploaded files are part of the snapshot, so a bad import or exit cannot lose the only copy.
  if (existsSync(storageExportDir)) cpSync(storageExportDir, join(snapshot, "storage-export"), { recursive: true });
  pruneSnapshots("auto-", AUTO_SNAPSHOTS_KEPT);
  console.log(`Startup snapshot: ${show(snapshot)} (newest ${AUTO_SNAPSHOTS_KEPT} kept).`);
}
const { importDir, archivedDump } = prepareStorageImport();
const savedObjects = exportedObjectCount();
if (archivedDump) {
  pruneSnapshots("exit-", EXIT_SNAPSHOTS_KEPT);
  console.log(`Last clean-exit database export archived: ${show(archivedDump)}.`);
}

const cliRoot = firebaseCliRoot();
// The database is closed here and the startup snapshot above holds a copy, so the
// leftovers of the unfinished automation draft (see the script) can be repaired safely.
if (existsSync(join(sqlDataDir, "pg17"))) {
  try {
    const repaired = await repairAutomationDraft({ cliRoot, dataDir: join(sqlDataDir, "pg17"), schemaPath: join(root, "dataconnect", "schema", "schema.gql") });
    if (repaired === "repaired") console.log("Removed the empty tables and enum values left by the unfinished automation draft; SQL Connect will now create the automation tables.");
  } catch (error) {
    console.error(`The local database has leftovers of the unfinished automation draft that could not be repaired automatically (${error.message}).`);
    console.error("Nothing was changed. SQL Connect cannot migrate this database to the current schema, so dev:local was not started.");
    process.exit(1);
  }
}
const cliConfig = join(root, ".tmp", "firebase-cli-local");
mkdirSync(cliConfig, { recursive: true });
const baseEnv = {
  ...process.env,
  XDG_CONFIG_HOME: cliConfig,
  FIREBASE_CLI_DISABLE_UPDATE_CHECK: "1",
  FIREBASE_STORAGE_BUCKET: localStorageBucket(),
};
console.log(`EstateOS local development: SQL Connect ${config.dataConnect}; Next.js http://localhost:3000.`);
console.log(`Database: ${show(sqlDataDir)}. Uploaded files: ${show(storageExportDir)} (${savedObjects} saved; new uploads are saved within seconds).`);
console.log("Firebase Authentication remains configured as before. Stop with ONE Ctrl+C and wait for the emulators to finish.");

const STARTUP_ATTEMPTS = 5;
let emulators = null;
let next = null;
let worker = null;
let stopping = false;
const bucket = localStorageBucket();
const AUTOSAVE_INTERVAL_MS = 3000;

/**
 * The Storage emulator keeps files in memory and the Firebase CLI writes them
 * only on a clean exit, which never happens when VS Code or the terminal is
 * closed. Files are therefore exported whenever the bucket changes. Autosave
 * starts only after the saved files are confirmed loaded, so an empty emulator
 * can never overwrite the saved copy.
 */
async function startStorageAutosave() {
  let loaded;
  // The hub lists Storage slightly before it accepts requests.
  for (let attempt = 1; !loaded; attempt += 1) {
    try { loaded = await listStorageObjects(config.storage, bucket); } catch (error) {
      if (attempt >= 30 || stopping) {
        console.error(`Uploaded-file autosave is OFF: ${error.message}`);
        return;
      }
      await new Promise(resolveWait => setTimeout(resolveWait, 1000));
    }
  }
  if (loaded.length < savedObjects) {
    console.error(`Uploaded-file autosave is OFF: ${savedObjects} saved files were found but only ${loaded.length} loaded.`);
    console.error(`The saved copy in ${show(storageExportDir)} and the startup snapshot are left untouched. Stop dev:local and investigate.`);
    return;
  }
  let saved = storageFingerprint(loaded);
  let saving = false;
  const timer = setInterval(async () => {
    if (saving || stopping) return;
    saving = true;
    try {
      const current = storageFingerprint(await listStorageObjects(config.storage, bucket));
      if (current !== saved && !stopping) {
        const count = await saveStorageExport(config);
        saved = current;
        console.log(`[estateos] Uploaded files saved (${count} in ${show(storageExportDir)}).`);
      }
    } catch (error) {
      if (!stopping) console.error(`[estateos] Uploaded-file autosave failed; retrying: ${error.message}`);
    } finally { saving = false; }
  }, AUTOSAVE_INTERVAL_MS);
  timer.unref();
  console.log(`Uploaded-file autosave on (${loaded.length} files loaded, bucket ${bucket}).`);
}

/**
 * Firebase CLI 15.x gives the SQL Connect binary about four seconds to listen,
 * but the binary compiles the schema and regenerates the Admin SDK first, which
 * now takes about five seconds; the start then fails with "/emulator/configure".
 * firebase-cli-dataconnect-wait.mjs makes the CLI wait for the binary instead.
 * The CLI has already shut down cleanly when a start fails, so the start is
 * still retried a bounded number of times.
 */
function startEmulators(attempt) {
  // Re-sanitize before every attempt: a failed attempt may have exported again.
  const { importDir: currentImport } = attempt === 1 ? { importDir } : prepareStorageImport();
  const child = spawn(process.execPath, [
    ...firebaseCliCommand(cliRoot), "emulators:start", "--project", DEV_PROJECT_ID, "--config", LOCAL_CONFIG,
    "--only", "dataconnect,storage", "--export-on-exit", storageExportDir, ...(currentImport ? ["--import", currentImport] : []),
  ], { cwd: LOCAL_CONFIG_DIR, stdio: ["inherit", "pipe", "pipe"], windowsHide: true, env: baseEnv });
  let recent = "";
  const tee = target => chunk => { target.write(chunk); recent = (recent + chunk).slice(-20_000); };
  child.stdout.on("data", tee(process.stdout));
  child.stderr.on("data", tee(process.stderr));
  child.on("error", error => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", code => {
    const startupRace = !child.ready && !stopping && recent.includes("/emulator/configure");
    if (startupRace && attempt < STARTUP_ATTEMPTS) {
      console.log(`SQL Connect started too slowly for the Firebase CLI; retrying (${attempt + 1}/${STARTUP_ATTEMPTS}).`);
      emulators = startEmulators(attempt + 1);
      return;
    }
    if (next && next.exitCode === null) next.kill();
    if (stopping || code === 0) console.log("Emulators stopped. The local database was closed and uploaded files were saved.");
    else console.error(`Emulators exited unexpectedly (code ${code}). Check firebase-debug.log; snapshots are in ${show(backupRoot)}.`);
    process.exit(stopping ? 0 : code ?? 1);
  });
  return child;
}

async function emulatorsReady(timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !stopping) {
    try {
      const response = await fetch(`http://${config.hub}/emulators`, { signal: AbortSignal.timeout(2000) });
      const running = await response.json();
      if (running.dataconnect && running.storage) { emulators.ready = true; return true; }
    } catch { /* Hub not listening yet, or restarting after a startup retry. */ }
    await new Promise(resolveWait => setTimeout(resolveWait, 500));
  }
  return false;
}

function requestStop(signal) {
  if (stopping) return;
  stopping = true;
  worker?.stop();
  console.log(`
Received ${signal}. Closing the local database cleanly; do not press Ctrl+C again.`);
  // Console signals reach every process in the terminal. Forward only where
  // signals are real (POSIX); on Windows kill() would terminate PGlite abruptly.
  if (process.platform !== "win32") {
    next?.kill("SIGINT");
    emulators?.kill("SIGINT");
  }
}
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) process.on(signal, () => requestStop(signal));

emulators = startEmulators(1);
const ready = await emulatorsReady();
if (ready && !stopping) await startStorageAutosave();
if (!ready) {
  if (!stopping) console.error("Emulators did not become ready within 5 minutes. Press Ctrl+C once to stop them cleanly.");
} else if (emulatorsOnly) {
  console.log(`Emulators ready. For scripts: DATA_CONNECT_EMULATOR_HOST=${config.dataConnect}. Press Ctrl+C once to stop.`);
} else if (!stopping) {
  next = spawn("npm run dev -- --port 3000", {
    cwd: root, stdio: "inherit", shell: true, windowsHide: true,
    env: { ...baseEnv, ...emulatorEnvironment(config) },
  });
  next.on("exit", code => {
    worker?.stop();
    if (!stopping) console.log(`Next.js stopped (code ${code}). Press Ctrl+C once to stop the emulators and save data.`);
  });
  // Workflow automation: the worker ticks the app; all state is in the database (docs/AUTOMATION_OPERATIONS.md).
  const secret = envValue("AUTOMATION_WORKER_SECRET");
  if (secret.length >= 32) worker = startAutomationWorker({origin: "http://localhost:3000", secret});
  else console.log("Automation worker: off (set AUTOMATION_WORKER_SECRET in .env.local to run approved workflows locally).");
}
