import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getDataConnect } from "firebase-admin/data-connect";
import * as sdk from "@dataconnect/admin-generated";
import { getStorage } from "firebase-admin/storage";
import { demoOrganizationSlug } from "./demo-seed-lib.mjs";
import { exportedObjectCount, listStorageObjects } from "./local-db-lib.mjs";

/*
 * End-to-end persistence check for `npm run dev:local`, run in an isolated
 * sandbox (own demo project, ports and .tmp data directory) so it never touches
 * the developer's database or a running dev:local session.
 *
 * Cycles: create company data -> hard kill (what closing VS Code or a crashed
 * terminal does) -> restart -> verify; repeat with new writes; then verify the
 * one-time migration from the legacy .tmp location and startup snapshots. It
 * also verifies that uploaded files survive an abrupt stop (autosave) and that
 * npm run seed:demo is idempotent, never overwrites existing records, keeps
 * companies isolated and refuses production. On
 * POSIX it also verifies a clean SIGINT stop. Windows cannot deliver Ctrl+C to
 * a child process, so the clean-stop path is verified manually there.
 */
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sandbox = join(root, ".tmp", "persistence-test");
const configPath = join(sandbox, "firebase.json");
const projectId = "demo-estateos-persistence";
const ports = { dataconnect: 29399, postgres: 29939, storage: 29199, hub: 24401, logging: 24501 };
const env = {
  ...process.env,
  ESTATEOS_LOCAL_ROOT: relative(root, sandbox), ESTATEOS_LOCAL_PROJECT: projectId,
  ESTATEOS_LOCAL_CONFIG: relative(root, configPath), ESTATEOS_LEGACY_DATA_DIR: relative(root, join(sandbox, "legacy")),
};
const dataDir = join(sandbox, ".local-data", "sql-connect");
const backups = join(sandbox, ".local-backups", "sql-connect");
const log = (message) => console.log(`[persistence] ${message}`);

function resetSandbox() {
  if (relative(join(root, ".tmp"), sandbox).startsWith("..")) throw new Error("Sandbox must be inside .tmp/.");
  rmSync(sandbox, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  mkdirSync(sandbox, { recursive: true });
  // Schema and connectors are copied without the connector's SDK "generate" block:
  // the sandbox emulator must not rewrite src/ while a developer session runs.
  cpSync(join(root, "dataconnect", "schema"), join(sandbox, "dataconnect-src", "schema"), { recursive: true });
  cpSync(join(root, "dataconnect", "connector"), join(sandbox, "dataconnect-src", "connector"), { recursive: true });
  copyFileSync(join(root, "dataconnect", "dataconnect.yaml"), join(sandbox, "dataconnect-src", "dataconnect.yaml"));
  writeFileSync(join(sandbox, "dataconnect-src", "connector", "connector.yaml"), "connectorId: example\n");
  copyFileSync(join(root, "storage.rules"), join(sandbox, "storage.rules"));
  writeFileSync(configPath, JSON.stringify({
    dataconnect: { source: "dataconnect-src" }, storage: { rules: "storage.rules" },
    emulators: {
      dataconnect: { host: "127.0.0.1", port: ports.dataconnect, postgresPort: ports.postgres, dataDir: ".local-data/sql-connect" },
      storage: { host: "127.0.0.1", port: ports.storage }, hub: { host: "127.0.0.1", port: ports.hub },
      logging: { host: "127.0.0.1", port: ports.logging }, ui: { enabled: false }, singleProjectMode: true,
    },
  }, null, 2));
}

let run = 0;
function start() {
  run += 1;
  const output = createWriteStream(join(sandbox, `launcher-${run}.log`));
  const child = spawn(process.execPath, [join(root, "scripts", "dev-local.mjs"), "--emulators-only"], {
    cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32",
  });
  let text = "";
  const collect = chunk => { text += chunk; output.write(chunk); };
  child.stdout.on("data", collect); child.stderr.on("data", collect);
  return new Promise((resolveStart, rejectStart) => {
    const timer = setTimeout(() => rejectStart(new Error(`Launcher not ready in 4 minutes. See ${output.path}`)), 240_000);
    const poll = setInterval(() => {
      if (text.includes("Emulators ready.")) { clearInterval(poll); clearTimeout(timer); resolveStart({ child, output: () => text }); }
    }, 250);
    child.once("exit", code => { clearInterval(poll); clearTimeout(timer); rejectStart(new Error(`Launcher exited (${code}) before ready:\n${text.slice(-3000)}`)); });
  });
}

async function waitForPortsFree() {
  const { busyPorts } = await import("./local-db-lib.mjs");
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (!(await busyPorts(Object.values(ports))).length) return;
    await new Promise(resolveWait => setTimeout(resolveWait, 250));
  }
  throw new Error("Sandbox ports did not become free.");
}

/** Abrupt termination of the whole launcher tree, as when VS Code closes a terminal. */
async function hardKill({ child }) {
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true });
  else process.kill(-child.pid, "SIGKILL");
  await waitForPortsFree();
}

async function cleanStop({ child }) {
  process.kill(-child.pid, "SIGINT");
  await new Promise(resolveExit => child.once("exit", resolveExit));
  await waitForPortsFree();
}

const storageHost = `127.0.0.1:${ports.storage}`;
const bucketName = `${projectId}.appspot.com`;
const exportDir = join(sandbox, ".local-data", "storage-export");
function dataConnect() {
  process.env.DATA_CONNECT_EMULATOR_HOST = `127.0.0.1:${ports.dataconnect}`;
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = storageHost;
  const app = initializeApp({ projectId }, `persistence-${Date.now()}`);
  return { app, dc: getDataConnect(sdk.connectorConfig, app) };
}
const as = uid => ({ impersonate: { authClaims: { sub: uid, email: `${uid}@example.test`, email_verified: true, firebase: { sign_in_provider: "password" } } } });
const owner = "persistence-owner";

async function writeCompanyData() {
  const { app, dc } = dataConnect();
  try {
    await sdk.upsertMyProfile(dc, { displayName: "Persistence Owner" }, as(owner));
    const org = (await sdk.createOrganization(dc, { name: "Persistence Realty", slug: "persistence-realty" }, as(owner))).data.organization.id;
    const developer = (await sdk.createDeveloper(dc, { organizationId: org, name: "Persistence Developer", slug: "persistence-developer", country: "AE", status: sdk.DeveloperStatus.ACTIVE }, as(owner))).data.developer.id;
    const project = (await sdk.createProject(dc, { organizationId: org, developerId: developer, projectName: "Persistence Towers", projectCode: "PT-1", projectType: sdk.ProjectType.RESIDENTIAL, country: "AE", constructionStatus: sdk.ConstructionStatus.COMPLETED, projectStatus: sdk.ProjectStatus.ACTIVE, currency: "AED" }, as(owner))).data.project.id;
    const property = (await sdk.createProperty(dc, { organizationId: org, projectId: project, propertyReference: "PT-1-101", propertyType: sdk.PropertyType.APARTMENT, marketType: sdk.MarketType.SECONDARY, bedrooms: 2, emirate: sdk.Emirate.DUBAI, community: "Dubai Marina", areaUnit: sdk.AreaUnit.SQFT, occupancyStatus: sdk.OccupancyStatus.VACANT, inventoryStatus: sdk.InventoryStatus.AVAILABLE }, as(owner))).data.property.id;
    await sdk.createPropertyListing(dc, { organizationId: org, propertyId: property, listingReference: "PT-L-1", listingPurpose: sdk.ListingPurpose.SALE, marketType: sdk.MarketType.SECONDARY, title: "Persistence listing", askingPriceMinor: "100000000", currency: "AED", listingStatus: sdk.ListingStatus.ACTIVE, publicationStatus: sdk.ListingPublicationStatus.NOT_PUBLISHED }, as(owner));
    await sdk.createLead(dc, { organizationId: org, fullName: "Persistence Lead One" }, as(owner));
    return org;
  } finally { await deleteApp(app); }
}

async function addLead(org, fullName) {
  const { app, dc } = dataConnect();
  try { await sdk.createLead(dc, { organizationId: org, fullName }, as(owner)); }
  finally { await deleteApp(app); }
}

/** Data as the application sees it: authorized SDK reads by the company owner. */
async function companyView(org) {
  const { app, dc } = dataConnect();
  try {
    const companies = (await sdk.listMyOrganizations(dc, {}, as(owner))).data.memberships.map(row => row.organization?.name);
    const leads = (await sdk.listLeads(dc, { organizationId: org, limit: 100, offset: 0 }, as(owner))).data.leads.map(row => row.fullName).sort();
    const developers = (await sdk.listDevelopers(dc, { organizationId: org, limit: 50, offset: 0 }, as(owner))).data.developers.map(row => row.name);
    const projects = (await sdk.listProjects(dc, { organizationId: org, limit: 50, offset: 0 }, as(owner))).data.projects.map(row => row.projectName);
    const properties = (await sdk.listPropertiesAdvanced(dc, { organizationId: org, limit: 50, offset: 0 }, as(owner))).data.properties.map(row => row.propertyReference);
    const listings = (await sdk.listPropertyListings(dc, { organizationId: org, limit: 50, offset: 0 }, as(owner))).data.propertyListings.map(row => row.listingReference);
    return { companies, developers, projects, properties, listings, leads };
  } finally { await deleteApp(app); }
}

async function rowCounts() {
  const firebaseRoot = (await import("./local-db-lib.mjs")).firebaseCliRoot();
  const { Client } = createRequire(join(firebaseRoot, "package.json"))("pg");
  const client = new Client({ host: "127.0.0.1", port: ports.postgres, user: "postgres", database: "postgres" });
  await client.connect();
  try {
    const counts = {};
    for (const table of ["organization", "membership", "developer", "project", "property", "property_listing", "lead", "audit_log"]) {
      counts[table] = (await client.query(`SELECT count(*)::int AS n FROM public."${table}"`)).rows[0].n;
    }
    return counts;
  } finally { await client.end(); }
}

async function waitFor(check, message, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(message);
    await new Promise(resolveWait => setTimeout(resolveWait, 250));
  }
}

function seed(args, extraEnv = {}) {
  const result = spawnSync(process.execPath, [join(root, "scripts", "seed-demo.mjs"), "--email", `${owner}@example.test`, ...args], {
    cwd: root, env: { ...env, ...extraEnv }, encoding: "utf8", windowsHide: true, timeout: 300_000,
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}
const summary = output => /(\d+) created, (\d+) already present, (\d+) recovered/.exec(output)?.slice(1).map(Number);
const seedOperations = readFileSync(join(root, "dev-data", "seed-operations.gql"), "utf8");
async function adminGraphql(source, operationName, variables) {
  const { app, dc } = dataConnect();
  try { return (await dc.executeGraphql(source, { operationName, variables })).data; }
  finally { await deleteApp(app); }
}
const admin = (operationName, variables) => adminGraphql(seedOperations, operationName, variables);
async function asMember(uid, run) {
  const { app, dc } = dataConnect();
  try { return await run(dc, as(uid)); }
  finally { await deleteApp(app); }
}
async function storedObject(name) {
  const { app } = dataConnect();
  try { return (await getStorage(app).bucket(bucketName).file(name).download())[0]; }
  finally { await deleteApp(app); }
}

const snapshots = prefix => existsSync(backups) ? readdirSync(backups).filter(name => name.startsWith(prefix)) : [];
let current;
try {
  resetSandbox();
  log("Run 1: fresh database, create company, developer, project, property, listing and lead.");
  current = await start();
  const org = await writeCompanyData();
  const expectedView = await companyView(org);
  const expectedCounts = await rowCounts();
  assert.deepEqual(expectedView, {
    companies: ["Persistence Realty"], developers: ["Persistence Developer"], projects: ["Persistence Towers"],
    properties: ["PT-1-101"], listings: ["PT-L-1"], leads: ["Persistence Lead One"],
  });
  assert.equal(snapshots("auto-").length, 0, "No snapshot is taken before a database exists.");

  log("Hard kill (simulated VS Code/terminal close), then restart.");
  await hardKill(current);
  current = await start();
  assert.deepEqual(await companyView(org), expectedView, "Company data survives an abrupt stop.");
  assert.deepEqual(await rowCounts(), expectedCounts);
  assert.equal(snapshots("auto-").length, 1, "Startup snapshot taken before opening the database.");

  log("Write more data, hard kill again, restart.");
  await addLead(org, "Persistence Lead Two");
  let afterSecondWrite = await rowCounts();
  await hardKill(current);
  current = await start();
  assert.deepEqual((await companyView(org)).leads, ["Persistence Lead One", "Persistence Lead Two"]);
  assert.deepEqual(await rowCounts(), afterSecondWrite);

  log("Uploaded file: autosaved while running, survives a hard kill.");
  const photoBytes = readFileSync(join(root, "public", "demo-assets", "demo-falconridge-developments", "demo-prj-01", "demo-p-001", "photo-1.png"));
  const manualPhoto = `organizations/${org}/properties/manual/manual-upload.png`;
  {
    const { app } = dataConnect();
    try { await getStorage(app).bucket(bucketName).file(manualPhoto).save(photoBytes, { resumable: false, metadata: { contentType: "image/png" } }); }
    finally { await deleteApp(app); }
  }
  await waitFor(() => exportedObjectCount(exportDir) >= 1, "Autosave did not save the uploaded file within 30 seconds.");
  await hardKill(current);
  current = await start();
  assert.ok(current.output().includes("Uploaded-file autosave on (1 files loaded"), "Saved file is imported and autosave resumes.");
  assert.deepEqual(await storedObject(manualPhoto), photoBytes, "Uploaded file survives an abrupt stop byte for byte.");

  log("seed:demo into a new demo company, then again (no duplicates), with one interrupted fixture recovered.");
  const firstSeed = seed([]);
  assert.equal(firstSeed.status, 0, firstSeed.output);
  assert.equal(summary(firstSeed.output)?.[0], 353, firstSeed.output);
  const demoOrg = (await admin("DemoSeedOrganizationBySlug", { slug: demoOrganizationSlug("demo-realty-sample", owner) })).organizations[0].id;
  const demoCounts = await rowCounts();
  await adminGraphql("mutation Interrupt($o: UUID!) { demoFixtureRecord_update(key: {organizationId: $o, fixtureKey: \"property:DEMO-P-001\"}, data: {recordId: null}) }", "Interrupt", { o: demoOrg });
  const secondSeed = seed([]);
  assert.equal(secondSeed.status, 0, secondSeed.output);
  assert.deepEqual(summary(secondSeed.output), [0, 352, 1], secondSeed.output);
  assert.deepEqual(await rowCounts(), demoCounts, "Re-running the seed adds no rows.");
  const profile = (await admin("DemoSeedProfile", { email: `${owner}@example.test` })).userProfiles[0];
  assert.equal(profile.activeOrganizationId.replace(/-/g, ""), org.replace(/-/g, ""), "The member stays in the company they were using.");
  const demoView = await asMember(owner, async (dc, options) => ({
    leads: (await sdk.listLeads(dc, { organizationId: demoOrg, limit: 100, offset: 0 }, options)).data.leads.length,
    properties: (await sdk.listPropertiesAdvanced(dc, { organizationId: demoOrg, limit: 100, offset: 0 }, options)).data.properties.length,
  }));
  assert.deepEqual(demoView, { leads: 50, properties: 30 });
  const demoMedia = await adminGraphql("query Media($o: UUID!) { inventoryMedias(where: {organizationId: {eq: $o}}) { storagePath status } }", "Media", { o: demoOrg });
  assert.equal(demoMedia.inventoryMedias.filter(row => row.status === "ACTIVE").length, 30, "Every demo photo record is active.");
  assert.deepEqual(await storedObject(demoMedia.inventoryMedias[0].storagePath).then(bytes => bytes.subarray(0, 4)), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  assert.equal((await listStorageObjects(storageHost, bucketName)).length, 31, "30 demo photos plus the manual upload.");

  log("seed:demo into a company with conflicting manual data: nothing is overwritten.");
  await asMember(owner, (dc, options) => sdk.createDeveloper(dc, { organizationId: org, name: "Manual Developer Kept", slug: "demo-falconridge-developments", country: "AE", status: sdk.DeveloperStatus.ACTIVE }, options));
  const conflictSeed = seed(["--organization", org]);
  assert.equal(conflictSeed.status, 0, conflictSeed.output);
  assert.match(conflictSeed.output, /Conflicts with existing records \(left unchanged\): 1/);
  const kept = await asMember(owner, async (dc, options) => (await sdk.listDevelopers(dc, { organizationId: org, limit: 50, offset: 0 }, options)).data.developers.map(row => row.name));
  assert.ok(kept.includes("Manual Developer Kept") && !kept.includes("Falconridge Developments (Demo)"), "The manual developer is unchanged and not duplicated.");
  assert.deepEqual((await companyView(org)).leads.filter(name => name.startsWith("Persistence")), ["Persistence Lead One", "Persistence Lead Two"]);

  log("Company isolation: a member of another company cannot read demo data.");
  const outsider = "persistence-outsider";
  await asMember(outsider, (dc, options) => sdk.upsertMyProfile(dc, { displayName: "Outsider" }, options));
  await assert.rejects(asMember(outsider, (dc, options) => sdk.listLeads(dc, { organizationId: demoOrg, limit: 10, offset: 0 }, options)));
  await assert.rejects(asMember(outsider, (dc, options) => sdk.listPropertiesAdvanced(dc, { organizationId: demoOrg, limit: 10, offset: 0 }, options)));

  log("Manual record after seeding, hard kill, restart: demo data, manual data and files persist.");
  const manualLead = (await asMember(owner, (dc, options) => sdk.createLead(dc, { organizationId: demoOrg, fullName: "Manual Lead After Seed" }, options))).data.lead.id;
  // Phase 6C: customer-stated qualification and a stored assessment must survive the restart too.
  await asMember(owner, (dc, options) => sdk.createLeadQualificationDetails(dc, { organizationId: demoOrg, leadId: manualLead, timeline: sdk.LeadTimeline.WITHIN_3_MONTHS, readiness: null }, options));
  { const { app, dc } = dataConnect();
    try { await sdk.recordLeadQualificationAssessment(dc, { organizationId: demoOrg, id: randomUUID(), leadId: manualLead, evaluatedByUid: owner, ruleVersion: "lq-1", configHash: "00000000",
      score: 42, priority: sdk.AiLeadPriority.LOW, sufficientData: true, result: "{}" }); }
    finally { await deleteApp(app); } }
  // 31 files plus the photos the conflict seed added to the other company's demo properties.
  const filesBeforeKill = (await listStorageObjects(storageHost, bucketName)).length;
  assert.ok(filesBeforeKill > 31);
  await waitFor(() => exportedObjectCount(exportDir) >= filesBeforeKill, "Autosave did not save every uploaded file.");
  afterSecondWrite = await rowCounts();
  await hardKill(current);
  current = await start();
  assert.deepEqual(await rowCounts(), afterSecondWrite);
  assert.equal((await listStorageObjects(storageHost, bucketName)).length, filesBeforeKill, "All uploaded files are back after the restart.");
  const leadsAfterRestart = await asMember(owner, async (dc, options) => (await sdk.listLeads(dc, { organizationId: demoOrg, limit: 100, offset: 0 }, options)).data.leads.map(row => row.fullName));
  assert.equal(leadsAfterRestart.length, 51);
  assert.ok(leadsAfterRestart.includes("Manual Lead After Seed"));
  const intelligence = await asMember(owner, async (dc, options) => (await sdk.getLeadSalesIntelligence(dc, { organizationId: demoOrg, leadId: manualLead }, options)).data);
  assert.equal(intelligence.details.timeline, "WITHIN_3_MONTHS", "qualification details survive an abrupt stop");
  assert.equal(intelligence.assessments[0].score, 42, "lead assessments survive an abrupt stop");

  log("seed:demo refuses production.");
  const production = seed([], { NODE_ENV: "production" });
  assert.notEqual(production.status, 0);
  assert.match(production.output, /production/);

  log("Legacy migration: move the database to the old .tmp location and restart.");
  await hardKill(current);
  mkdirSync(join(sandbox, "legacy"), { recursive: true });
  renameSync(join(dataDir, "pg17"), join(sandbox, "legacy", "pg17"));
  rmSync(dataDir, { recursive: true, force: true });
  current = await start();
  assert.ok(current.output().includes("Copied the existing local database"), "Launcher reports the one-time copy.");
  assert.deepEqual(await rowCounts(), afterSecondWrite, "Migrated database keeps every row.");
  assert.ok(existsSync(join(sandbox, "legacy", "pg17", "PG_VERSION")), "Legacy directory is left untouched.");

  if (process.platform !== "win32") {
    log("Clean SIGINT stop, then restart.");
    await cleanStop(current);
    assert.ok(existsSync(join(sandbox, ".local-data", "storage-export", "firebase-export-metadata.json")), "Clean exit saves uploaded files.");
    current = await start();
    assert.deepEqual(await rowCounts(), afterSecondWrite);
    assert.equal(snapshots("exit-").length, 1, "Clean-exit database export archived on next start.");
  }

  await hardKill(current);
  current = null;
  const status = spawnSync(process.execPath, [join(root, "scripts", "local-db.mjs"), "status", "--json"], { cwd: root, env, encoding: "utf8", windowsHide: true });
  assert.equal(status.status, 0, status.stderr);
  const stopped = JSON.parse(status.stdout);
  for (const [table, count] of Object.entries(afterSecondWrite)) assert.equal(stopped[table], count, `db:status (stopped) ${table}`);
  assert.ok(snapshots("auto-").length >= 3 && snapshots("auto-").length <= 10);
  const notRunning = seed([]);
  assert.notEqual(notRunning.status, 0);
  assert.match(notRunning.output, /not running/, "seed:demo refuses when no local emulator is running.");
  log(`PASSED: data persisted across ${run} launcher runs and ${run - 1} abrupt stops; ${snapshots("auto-").length} startup snapshots.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (current) await hardKill(current).catch(() => {});
  if (!process.exitCode) rmSync(sandbox, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  else log(`Sandbox kept for inspection: ${relative(root, sandbox)}`);
}
