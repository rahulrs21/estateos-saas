import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { firebaseCliRoot, root } from "./local-db-lib.mjs";

/*
 * Runs the SQL Connect integration suite on the isolated demo-estateos-test
 * emulator defined by firebase.test.json (ports and data directory unchanged).
 *
 * The emulator is started from a generated copy of the schema and connectors
 * without the connector's SDK "generate" block. Otherwise the emulator binary
 * regenerates src/dataconnect-admin-generated before listening, which (a) edits
 * the working tree during tests and (b) can exceed the Firebase CLI's ~4 second
 * startup window when a dev:local session is watching src/.
 */
const workspace = join(root, ".tmp", "sql-connect-integration");
// The CLI requires dataDir inside the project directory, so the generated config
// sits beside the existing data folder. Only the generated files are replaced.
const configDir = workspace;
const base = JSON.parse(readFileSync(join(root, "firebase.test.json"), "utf8"));

rmSync(join(configDir, "dataconnect"), { recursive: true, force: true });
mkdirSync(join(configDir, "dataconnect"), { recursive: true });
cpSync(join(root, "dataconnect", "schema"), join(configDir, "dataconnect", "schema"), { recursive: true });
cpSync(join(root, "dataconnect", "connector"), join(configDir, "dataconnect", "connector"), { recursive: true });
copyFileSync(join(root, "dataconnect", "dataconnect.yaml"), join(configDir, "dataconnect", "dataconnect.yaml"));
writeFileSync(join(configDir, "dataconnect", "connector", "connector.yaml"), "connectorId: example\n");
copyFileSync(join(root, "storage.rules"), join(configDir, "storage.rules"));
const config = structuredClone(base);
config.emulators.dataconnect.dataDir = relative(configDir, join(root, base.emulators.dataconnect.dataDir)).replaceAll("\\", "/");
writeFileSync(join(configDir, "firebase.json"), JSON.stringify(config, null, 2));

// Compile the production rate limiter so the integration cases run the real
// store against the emulator from several simulated app instances.
const compiledRateLimit = join(workspace, "compiled-rate-limit");
rmSync(compiledRateLimit, { recursive: true, force: true });
const compile = spawnSync(process.execPath, [
  join(root, "node_modules", "typescript", "bin", "tsc"), "--strict", "--module", "commonjs", "--moduleResolution", "node",
  "--target", "es2022", "--esModuleInterop", "--skipLibCheck", "--outDir", compiledRateLimit,
  join(root, "src", "lib", "rate-limit", "limiter.ts"), join(root, "src", "lib", "rate-limit", "sql-connect-store.ts"),
], { cwd: root, stdio: "inherit", windowsHide: true });
if (compile.status !== 0) { process.exitCode = compile.status ?? 1; throw new Error("Could not compile the rate limiter for integration tests."); }

const tests = ["tests/sql-connect.integration.test.mjs", "tests/storage-rules.integration.test.mjs"].map(file => `"${join(root, file)}"`).join(" ");
const result = spawnSync(process.execPath, [
  join(firebaseCliRoot(), "lib", "bin", "firebase.js"), "emulators:exec", "--project", "demo-estateos-test",
  "--config", join(configDir, "firebase.json"), "--only", "dataconnect,storage", `node --test ${tests}`,
], { cwd: configDir, stdio: "inherit", windowsHide: true, env: { ...process.env, FIREBASE_CLI_DISABLE_UPDATE_CHECK: "1", ESTATEOS_RATE_LIMIT_MODULES: compiledRateLimit } });
process.exitCode = result.status ?? 1;
