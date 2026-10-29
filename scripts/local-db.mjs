import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DEV_PROJECT_ID, LOCAL_CONFIG, LOCAL_CONFIG_DIR, assertManagedPath, backupRoot, busyPorts, copyDatabase, firebaseCliRoot, hasDatabase, listBackups,
  localConfig, root, sqlDataDir, storageExportDir, timestamp,
} from "./local-db-lib.mjs";

/*
 * Local development database backups. Usage:
 *   npm run db:backup [-- label]      consistent snapshot (live export, or file copy when stopped)
 *   npm run db:list                   available backups, newest first
 *   npm run db:status [-- --json]     row counts of the local database
 *   npm run db:restore -- <backup> --confirm
 * Backups live in .local-backups/sql-connect (git-ignored) and may contain customer data.
 */
if (process.env.NODE_ENV === "production") throw new Error("Local database tooling cannot run in production.");
const [command, ...args] = process.argv.slice(2);
const config = localConfig();
const show = path => relative(root, path) || ".";
const KEY_TABLES = ["organization", "membership", "user_profile", "developer", "project", "property", "property_listing", "contact", "lead", "inventory_media"];

const running = async () => (await busyPorts([config.ports[0], config.postgresPort])).length > 0;

function cli(args, env = {}) {
  const result = spawnSync(process.execPath, [join(firebaseCliRoot(), "lib", "bin", "firebase.js"), ...args], {
    cwd: LOCAL_CONFIG_DIR, stdio: "inherit", windowsHide: true,
    env: { ...process.env, XDG_CONFIG_HOME: join(root, ".tmp", "firebase-cli-local"), FIREBASE_CLI_DISABLE_UPDATE_CHECK: "1", ...env },
  });
  if (result.status !== 0) throw new Error(`firebase ${args[0]} failed (exit ${result.status}).`);
}

async function pglite() {
  const base = join(firebaseCliRoot(), "node_modules", "@electric-sql", "pglite", "dist");
  const { PGlite } = await import(pathToFileURL(join(base, "index.js")).href);
  const { vector } = await import(pathToFileURL(join(base, "vector", "index.js")).href);
  const { uuid_ossp } = await import(pathToFileURL(join(base, "contrib", "uuid_ossp.js")).href);
  return { PGlite, extensions: { vector, uuidOssp: uuid_ossp } };
}

async function countRows(query) {
  const tables = (await query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")).rows;
  const counts = {};
  for (const { tablename } of tables) counts[tablename] = Number((await query(`SELECT count(*)::int AS n FROM public."${tablename}"`)).rows[0].n);
  return counts;
}

/** Read-only counts: through the running emulator, or from a temporary copy when stopped. */
async function databaseCounts() {
  if (await running()) {
    const { Client } = createRequire(join(firebaseCliRoot(), "package.json"))("pg");
    const client = new Client({ host: "127.0.0.1", port: config.postgresPort, user: "postgres", database: "postgres" });
    await client.connect();
    try { return { source: "running emulator", counts: await countRows(sql => client.query(sql)) }; }
    finally { await client.end(); }
  }
  if (!hasDatabase(sqlDataDir)) return { source: "none", counts: {} };
  // Never open the real directory outside the emulator: count a disposable copy.
  const temporary = mkdtempSync(join(tmpdir(), "estateos-db-status-"));
  try {
    cpSync(join(sqlDataDir, "pg17"), join(temporary, "pg17"), { recursive: true });
    const { PGlite, extensions } = await pglite();
    const db = await PGlite.create({ dataDir: join(temporary, "pg17"), extensions });
    try { return { source: "stopped database (temporary copy)", counts: await countRows(sql => db.query(sql)) }; }
    finally { await db.close(); }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

function label(value) {
  return value ? `-${value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)}` : "";
}

async function backup(name) {
  const target = join(backupRoot, `manual-${timestamp()}${label(name)}`);
  assertManagedPath(target);
  if (await running()) {
    // The emulator dumps its own data directory, so the snapshot is consistent while in use.
    cli(["emulators:export", target, "--project", DEV_PROJECT_ID, "--config", LOCAL_CONFIG, "--force"]);
  } else {
    if (!hasDatabase(sqlDataDir)) throw new Error(`No local database found in ${show(sqlDataDir)}.`);
    copyDatabase(sqlDataDir, target);
    if (existsSync(storageExportDir)) cpSync(storageExportDir, join(target, "storage-export"), { recursive: true });
  }
  console.log(`Backup created: ${show(target)}`);
  return target;
}

function resolveBackup(reference) {
  if (!reference) throw new Error("Name the backup to restore (see npm run db:list).");
  const path = assertManagedPath(existsSync(join(backupRoot, reference)) ? join(backupRoot, reference) : resolve(reference));
  if (existsSync(join(path, "pg17", "PG_VERSION"))) return { path, kind: "files", dump: null };
  for (const dump of [join(path, "postgres.tar.gz"), join(path, "dataconnect_export", "postgres.tar.gz")]) {
    if (existsSync(dump)) return { path, kind: "export", dump };
  }
  throw new Error(`${show(path)} is not a database backup.`);
}

async function restore(reference, confirmed) {
  const source = resolveBackup(reference);
  if (await running()) throw new Error("Stop dev:local (one Ctrl+C, then wait) before restoring.");
  if (!confirmed) throw new Error(`Restoring replaces the current local database with ${show(source.path)}. Re-run with --confirm.`);
  if (hasDatabase(sqlDataDir)) {
    const safety = join(backupRoot, `pre-restore-${timestamp()}`);
    copyDatabase(sqlDataDir, safety);
    if (existsSync(storageExportDir)) cpSync(storageExportDir, join(safety, "storage-export"), { recursive: true });
    console.log(`Current database saved first: ${show(safety)}`);
  }
  const staging = assertManagedPath(`${sqlDataDir}.restoring-${timestamp()}`);
  if (source.kind === "files") {
    cpSync(join(source.path, "pg17"), join(staging, "pg17"), { recursive: true });
  } else {
    const { PGlite, extensions } = await pglite();
    const file = new File([readFileSync(source.dump)], basename(source.dump));
    const db = await PGlite.create({ dataDir: join(staging, "pg17"), loadDataDir: file, extensions });
    await db.close();
  }
  if (existsSync(sqlDataDir)) rmSync(assertManagedPath(sqlDataDir), { recursive: true, force: true });
  renameSync(staging, sqlDataDir);
  const storage = [join(source.path, "storage-export"), join(source.path, "storage_export")].find(existsSync);
  if (storage) {
    if (existsSync(storageExportDir)) rmSync(assertManagedPath(storageExportDir), { recursive: true, force: true });
    // A storage_export folder from `emulators:export` needs its metadata to import.
    if (basename(storage) === "storage_export") {
      cpSync(storage, join(storageExportDir, "storage_export"), { recursive: true });
      const metadata = JSON.parse(readFileSync(join(source.path, "firebase-export-metadata.json"), "utf8"));
      delete metadata.dataconnect;
      writeFileSync(join(storageExportDir, "firebase-export-metadata.json"), JSON.stringify(metadata, null, 2));
    } else cpSync(storage, storageExportDir, { recursive: true });
  }
  console.log(`Restored ${show(source.path)} into ${show(sqlDataDir)}${storage ? " (including uploaded files)" : ""}. Start npm run dev:local.`);
}

function size(path) {
  let total = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    total += entry.isDirectory() ? size(child) : statSync(child).size;
  }
  return total;
}

try {
  if (command === "backup") await backup(args.find(arg => !arg.startsWith("--")));
  else if (command === "restore") await restore(args.find(arg => !arg.startsWith("--")), args.includes("--confirm"));
  else if (command === "list") {
    const backups = listBackups();
    if (!backups.length) console.log("No backups yet.");
    for (const item of backups) console.log(`${item.name}\t${item.kind}\t${(size(item.path) / 1048576).toFixed(1)} MB`);
  } else if (command === "status") {
    const { source, counts } = await databaseCounts();
    if (args.includes("--json")) console.log(JSON.stringify(counts, null, 1));
    else {
      console.log(`Local database: ${show(sqlDataDir)} — ${source}`);
      for (const table of KEY_TABLES) if (table in counts) console.log(`  ${table.padEnd(18)} ${counts[table]}`);
      console.log(`  ${"all tables".padEnd(18)} ${Object.values(counts).reduce((sum, value) => sum + value, 0)} rows`);
    }
  } else {
    console.error("Usage: node scripts/local-db.mjs <backup [label] | list | status [--json] | restore <backup> --confirm>");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
