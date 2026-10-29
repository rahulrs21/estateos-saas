import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { firebaseCliRoot, root } from "./local-db-lib.mjs";

/*
 * End-to-end browser tests for Phase 5F maps against the real Next.js app,
 * real Firebase Auth sessions and real SQL Connect authorization, all on
 * isolated emulators:
 *
 * - project demo-estateos-test with its own ports (Auth 19699, SQL Connect
 *   19799/19732) and a data directory under .tmp/maps-e2e/data that the test
 *   resets and reseeds on every run. dev:local data and the integration-test
 *   database are untouched. (The directory is kept between runs because a new
 *   Postgres data directory can miss the CLI's emulator startup window.)
 * - Next.js runs from this checkout with a separate distDir and with
 *   __NEXT_PROCESSED_ENV set, so .env.local (and any credentials in it) is
 *   never loaded. No Google Maps keys are configured, so no Google request can
 *   be made; the not-configured paths are what is verified for live Maps.
 */
const workspace = join(root, ".tmp", "maps-e2e");
const ports = {auth: 19699, dataconnect: 19799, postgres: 19732, storage: 19798, hub: 19790, logging: 19791};
for (const generated of ["dataconnect", "next", "screens", "browser-profile", "tests-started", "tsconfig.json", "storage.rules"]) {
  rmSync(join(workspace, generated), {recursive: true, force: true, maxRetries: 10, retryDelay: 300});
}
mkdirSync(join(workspace, "dataconnect", "connector"), {recursive: true});
cpSync(join(root, "dataconnect", "schema"), join(workspace, "dataconnect", "schema"), {recursive: true});
cpSync(join(root, "dataconnect", "connector"), join(workspace, "dataconnect", "connector"), {recursive: true});
copyFileSync(join(root, "dataconnect", "dataconnect.yaml"), join(workspace, "dataconnect", "dataconnect.yaml"));
copyFileSync(join(root, "storage.rules"), join(workspace, "storage.rules"));
// The test server's tsconfig extends the project one; Next adds its distDir
// type folders here instead of editing the committed tsconfig.json.
writeFileSync(join(workspace, "tsconfig.json"), JSON.stringify({
  extends: "../../tsconfig.json",
  include: ["../../next-env.d.ts", "../../src/**/*.ts", "../../src/**/*.tsx", "next/types/**/*.ts", "next/dev/types/**/*.ts"],
  exclude: ["../../node_modules"],
}, null, 2));
// Without the SDK "generate" block the emulator does not rewrite src/.
writeFileSync(join(workspace, "dataconnect", "connector", "connector.yaml"), "connectorId: example\n");
writeFileSync(join(workspace, "firebase.json"), JSON.stringify({
  dataconnect: {source: "dataconnect"},
  storage: {rules: "storage.rules"},
  emulators: {
    storage: {host: "127.0.0.1", port: ports.storage},
    auth: {host: "127.0.0.1", port: ports.auth},
    dataconnect: {host: "127.0.0.1", port: ports.dataconnect, postgresPort: ports.postgres, dataDir: "data"},
    hub: {host: "127.0.0.1", port: ports.hub}, logging: {host: "127.0.0.1", port: ports.logging},
    ui: {enabled: false}, singleProjectMode: true,
  },
}, null, 2));

const browsers = (process.env.ESTATEOS_TEST_BROWSER ? [process.env.ESTATEOS_TEST_BROWSER] : [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]).filter(existsSync);
if (!browsers.length) throw new Error("Install Chrome/Edge, or set ESTATEOS_TEST_BROWSER to a Chromium executable.");

const env = {...process.env, FIREBASE_CLI_DISABLE_UPDATE_CHECK: "1", ESTATEOS_E2E_WORKSPACE: workspace, ESTATEOS_TEST_BROWSER: browsers[0]};
for (const key of ["GOOGLE_APPLICATION_CREDENTIALS", "FIREBASE_TOKEN", "GOOGLE_MAPS_SERVER_KEY", "NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY"]) delete env[key];
// The SQL Connect emulator occasionally misses the CLI's startup window
// ("Failed to make request … /emulator/configure"). Retry only when the tests
// never started, which the browser script records with a marker file.
const started = join(workspace, "tests-started");
let status = 1;
for (let attempt = 1; attempt <= 3; attempt++) {
  const result = spawnSync(process.execPath, [
    join(firebaseCliRoot(), "lib", "bin", "firebase.js"), "emulators:exec", "--project", "demo-estateos-test",
    "--config", join(workspace, "firebase.json"), "--only", "auth,dataconnect,storage", `node "${join(root, "tests", "maps-e2e.browser.mjs")}"`,
  ], {cwd: workspace, stdio: "inherit", windowsHide: true, env});
  status = result.status ?? 1;
  if (status === 0 || existsSync(started)) break;
  console.warn(`Emulators did not start (attempt ${attempt} of 3); retrying.`);
}
process.exitCode = status;
