import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Phase 6F verification runner (docs/COMMUNICATION_TESTING.md). Runs the
 * communication test suites one after another (they share emulator ports),
 * records every test name with its result, and writes
 * .tmp/test-results/communications.json for the developer dashboard at
 * /dev/communication-tests. Nothing here talks to a telephony provider.
 *
 *   npm run test:communications:verify            unit, emulator, browser, persistence, lint, types
 *   npm run test:communications:verify -- --quick unit, emulator, lint and types only
 *   npm run test:communications:verify -- --live  also the live-Claude browser checks (uses Anthropic credit)
 *   npm run test:communications:verify -- --build also the production build
 *   npm run test:communications:verify -- --live-from=<log>  record a saved live-Claude run (its own date) instead of spending credit again
 */

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = new Set(process.argv.slice(2));
const liveFrom = process.argv.slice(2).find(arg => arg.startsWith("--live-from="))?.slice("--live-from=".length) ?? null;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const SUITES = [
  {id: "unit", label: "Unit tests (communications and workflows)", script: "test:communications", layer: "SIMULATED"},
  {id: "automations-unit", label: "Workflow definition unit tests", script: "test:automations", layer: "SIMULATED"},
  {id: "dataconnect", label: "SQL Connect emulator integration (all suites)", script: "test:dataconnect", layer: "INTEGRATION", quick: true},
  {id: "browser", label: "Browser end-to-end (communications)", script: "test:communications:e2e", layer: "INTEGRATION", slow: true},
  {id: "browser-live", label: "Browser end-to-end with live Claude", script: "test:communications:e2e", layer: "INTEGRATION", env: {AI_E2E_LIVE: "1"}, live: true},
  {id: "persistence", label: "Persistence after abrupt stop and restart", script: "test:persistence", layer: "INTEGRATION", slow: true},
  {id: "lint", label: "ESLint", script: "lint", layer: "BUILD"},
  {id: "typescript", label: "TypeScript", command: ["npx", "tsc", "--noEmit", "-p", "."], layer: "BUILD"},
  {id: "build", label: "Production build", script: "build", layer: "BUILD", build: true},
];

const selected = SUITES.filter(suite => {
  if (suite.live) return args.has("--live");
  if (suite.build) return args.has("--build");
  if (suite.slow) return !args.has("--quick");
  return true;
});

/** node:test lines ("✔ name (12ms)", "✖ name") and the browser suites' "✔ message" checks. */
function parseTests(output) {
  const tests = [];
  for (const line of output.split(/\r?\n/)) {
    const match = /^\s*(✔|✖)\s+(.+?)(?:\s+\(\d+(?:\.\d+)?m?s\))?\s*$/.exec(line);
    if (!match || /^failing tests:?$/.test(match[2])) continue;
    tests.push({name: match[2].trim(), status: match[1] === "✔" ? "PASSED" : "FAILED"});
  }
  // A failing test is listed again in the summary; keep its first (failed) entry once.
  const seen = new Map();
  for (const test of tests) if (!seen.has(test.name) || test.status === "FAILED") seen.set(test.name, test);
  return [...seen.values()];
}

/** The first real error with some context (emulator shutdown noise such as ECONNRESET is skipped), or the tail. */
function failureExcerpt(output) {
  const lines = output.split(/\r?\n/);
  const index = lines.findIndex(line => /AssertionError|TypeError|ReferenceError|Timed out waiting|✖ failing tests|SyntaxError/.test(line));
  return (index >= 0 ? lines.slice(Math.max(0, index - 3), index + 30) : lines.slice(-40)).join("\n").slice(0, 6000);
}

const results = [];
for (const suite of selected) {
  const startedAt = new Date();
  console.log(`\n▶ ${suite.label}`);
  const [command, ...commandArgs] = suite.command ?? [npm, "run", suite.script];
  const run = spawnSync(command, commandArgs, {cwd: root, encoding: "utf8", shell: process.platform === "win32", env: {...process.env, ...(suite.env ?? {})}, maxBuffer: 256 * 1024 * 1024});
  const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  const tests = parseTests(output);
  const status = run.status === 0 ? "PASSED" : "FAILED";
  results.push({
    id: suite.id, label: suite.label, layer: suite.layer, command: suite.command ? suite.command.join(" ") : `npm run ${suite.script}`, live: Boolean(suite.live),
    status, exitCode: run.status, startedAt: startedAt.toISOString(), durationMs: Date.now() - startedAt.getTime(),
    passed: tests.filter(test => test.status === "PASSED").length, failed: tests.filter(test => test.status === "FAILED").length, tests,
    // The tail is kept for failures only, without anything that looks like a credential.
    failureTail: status === "FAILED" ? failureExcerpt(output).replace(/(sk-ant-[\w-]{6})[\w-]+/g, "$1…").replace(/(Bearer\s+)\S+/gi, "$1…") : null,
  });
  console.log(`${status === "PASSED" ? "✔" : "✖"} ${suite.label}: ${status} (${tests.length} named tests)`);
}

if (liveFrom && !args.has("--live")) {
  // A saved live-Claude log: recorded with the time it was written, and labelled as imported.
  const output = readFileSync(resolve(root, liveFrom), "utf8");
  const tests = parseTests(output);
  const passed = /live Claude communication checks passed/.test(output) && tests.every(test => test.status === "PASSED");
  results.push({id: "browser-live", label: "Browser end-to-end with live Claude (recorded run)", layer: "INTEGRATION", command: "AI_E2E_LIVE=1 npm run test:communications:e2e", live: true, imported: liveFrom,
    status: passed ? "PASSED" : "FAILED", exitCode: null, startedAt: statSync(resolve(root, liveFrom)).mtime.toISOString(), durationMs: 0,
    passed: tests.filter(test => test.status === "PASSED").length, failed: tests.filter(test => test.status === "FAILED").length, tests,
    evidence: output.split(/\r?\n/).filter(line => line.startsWith("LIVE ")).map(line => line.replace(/(sk-ant-[\w-]{6})[\w-]+/g, "$1…")), failureTail: passed ? null : failureExcerpt(output)});
}

const report = {
  schemaVersion: 1, runAt: new Date().toISOString(),
  environment: {node: process.version, platform: process.platform, mode: "Local emulators with synthetic data", liveClaude: args.has("--live"), telephonyProvider: "None (no provider connected; no calls placed)"},
  suites: results,
};
const directory = join(root, ".tmp", "test-results");
mkdirSync(directory, {recursive: true});
writeFileSync(join(directory, "communications.json"), JSON.stringify(report, null, 2));
console.log(`\nResults written to .tmp/test-results/communications.json (${results.filter(suite => suite.status === "PASSED").length}/${results.length} suites passed).`);
process.exit(results.every(suite => suite.status === "PASSED") ? 0 : 1);
