import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { firebaseCliRoot, root } from "./local-db-lib.mjs";

/*
 * End-to-end checks for the Phase 6A AI Copilot against the real Next.js app,
 * real Firebase Auth sessions and real SQL Connect authorization on isolated
 * emulators (own ports and data directory under .tmp/ai-e2e; dev:local and
 * the integration database are untouched). .env.local is never loaded by the
 * test server.
 *
 * Default mode uses a well-formed but invalid Anthropic key: it verifies the
 * security gates, invalid-key handling, allowances and rate limits against the
 * real Anthropic API rejection, at no cost.
 *
 * AI_E2E_LIVE=1 additionally runs a few real Claude conversations. Only then is
 * ANTHROPIC_API_KEY (and ANTHROPIC_MODEL) read from the environment or
 * .env.local and passed to the isolated test server. The key is never printed.
 * Live mode spends a small amount of Anthropic credit.
 */
const live = process.env.AI_E2E_LIVE === "1";
// `node scripts/test-ai-e2e.mjs content` runs the Phase 6B Content Studio suite and `sales` the Phase 6C sales
// intelligence suite instead of the Copilot suite.
const suite = {content: "ai-content-e2e.browser.mjs", sales: "ai-sales-e2e.browser.mjs"}[process.argv[2]] ?? "ai-e2e.browser.mjs";
const workspace = join(root, ".tmp", "ai-e2e");
const ports = {auth: 19899, dataconnect: 19999, postgres: 19932, storage: 19998, hub: 19990, logging: 19991};
for (const generated of ["dataconnect", "next", "screens", "browser-profile", "tests-started", "tsconfig.json", "storage.rules"]) {
  rmSync(join(workspace, generated), {recursive: true, force: true, maxRetries: 10, retryDelay: 300});
}
mkdirSync(join(workspace, "dataconnect", "connector"), {recursive: true});
cpSync(join(root, "dataconnect", "schema"), join(workspace, "dataconnect", "schema"), {recursive: true});
cpSync(join(root, "dataconnect", "connector"), join(workspace, "dataconnect", "connector"), {recursive: true});
copyFileSync(join(root, "dataconnect", "dataconnect.yaml"), join(workspace, "dataconnect", "dataconnect.yaml"));
copyFileSync(join(root, "storage.rules"), join(workspace, "storage.rules"));
writeFileSync(join(workspace, "tsconfig.json"), JSON.stringify({
  extends: "../../tsconfig.json",
  include: ["../../next-env.d.ts", "../../src/**/*.ts", "../../src/**/*.tsx", "next/types/**/*.ts", "next/dev/types/**/*.ts"],
  exclude: ["../../node_modules"],
}, null, 2));
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

function envFileValue(name) {
  if (process.env[name]) return process.env[name].trim();
  const file = join(root, ".env.local");
  if (!existsSync(file)) return "";
  const line = readFileSync(file, "utf8").split(/\r?\n/).find(item => new RegExp(`^\\s*${name}\\s*=`).test(item));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^(['"])(.*)\1$/, "$2") : "";
}

const browsers = (process.env.ESTATEOS_TEST_BROWSER ? [process.env.ESTATEOS_TEST_BROWSER] : [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]).filter(existsSync);
if (!browsers.length) throw new Error("Install Chrome/Edge, or set ESTATEOS_TEST_BROWSER to a Chromium executable.");

const env = {...process.env, FIREBASE_CLI_DISABLE_UPDATE_CHECK: "1", ESTATEOS_E2E_WORKSPACE: workspace, ESTATEOS_TEST_BROWSER: browsers[0], AI_E2E_LIVE: live ? "1" : "0"};
for (const key of ["GOOGLE_APPLICATION_CREDENTIALS", "FIREBASE_TOKEN", "GOOGLE_MAPS_SERVER_KEY", "NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"]) delete env[key];
if (live) {
  const key = envFileValue("ANTHROPIC_API_KEY");
  if (!key) throw new Error("AI_E2E_LIVE=1 needs ANTHROPIC_API_KEY in the environment or .env.local.");
  env.AI_E2E_ANTHROPIC_API_KEY = key;
  env.AI_E2E_ANTHROPIC_MODEL = envFileValue("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
  console.log(`Live Anthropic mode: model ${env.AI_E2E_ANTHROPIC_MODEL}. The API key is passed to the isolated test server only.`);
}

const started = join(workspace, "tests-started");
let status = 1;
for (let attempt = 1; attempt <= 3; attempt++) {
  const result = spawnSync(process.execPath, [
    join(firebaseCliRoot(), "lib", "bin", "firebase.js"), "emulators:exec", "--project", "demo-estateos-test",
    "--config", join(workspace, "firebase.json"), "--only", "auth,dataconnect,storage", `node "${join(root, "tests", suite)}"`,
  ], {cwd: workspace, stdio: "inherit", windowsHide: true, env});
  status = result.status ?? 1;
  if (status === 0 || existsSync(started)) break;
  console.warn(`Emulators did not start (attempt ${attempt} of 3); retrying.`);
}
process.exitCode = status;
