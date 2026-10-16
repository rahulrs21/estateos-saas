import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
let cli;
try { cli = require.resolve("firebase-tools/lib/bin/firebase.js"); }
catch {
  const npmRoot = process.platform === "win32"
    ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm root -g"], { encoding: "utf8", windowsHide: true })
    : spawnSync("npm", ["root", "-g"], { encoding: "utf8" });
  if (npmRoot.status !== 0) throw new Error("Install the Firebase CLI before running Auth Emulator tests.");
  cli = join(npmRoot.stdout.trim(), "firebase-tools/lib/bin/firebase.js");
}
const temporaryRoot = join(root, ".tmp");
mkdirSync(temporaryRoot, { recursive: true });
const settings = join(temporaryRoot, "firebase-auth-cli");
const output = mkdtempSync(join(temporaryRoot, "auth-integration-"));
const env = { ...process.env, XDG_CONFIG_HOME: settings, FIREBASE_CLI_DISABLE_UPDATE_CHECK: "1", GCLOUD_PROJECT: "demo-estateos", GOOGLE_CLOUD_PROJECT: "demo-estateos", FIREBASE_PROJECT_ID: "demo-estateos", GOOGLE_APPLICATION_CREDENTIALS: "", FIREBASE_TOKEN: "", ESTATEOS_AUTH_TEST_OUTPUT: output };
for (const key of ["FIREBASE_CLIENT_EMAIL", "FIREBASE_ADMIN_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "FIREBASE_ADMIN_PRIVATE_KEY"]) env[key] = "";
// No .env file or production Firebase credentials are loaded by this runner.
const compiler = spawnSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "--strict", "--module", "commonjs", "--moduleResolution", "node", "--target", "es2022", "--lib", "es2022,dom", "--esModuleInterop", "--skipLibCheck", "--rootDir", root, "--outDir", output,
  "src/modules/auth/firebase-operations.ts", "src/modules/auth/server/session-core.ts"], { cwd: root, env, stdio: "inherit", windowsHide: true });
let status = compiler.status ?? 1;
try {
  if (status === 0) {
    const args = ["emulators:exec", "--project", "demo-estateos", "--config", "firebase.auth.test.json", "--only", "auth", "node --test tests/auth-emulator.integration.test.mjs"];
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, env, stdio: "inherit", windowsHide: true });
    if (result.error) throw result.error;
    status = result.status ?? 1;
  }
} finally {
  const resolvedOutput = resolve(output);
  const withinTemporary = relative(temporaryRoot, resolvedOutput);
  if (withinTemporary && !withinTemporary.startsWith("..") && !isAbsolute(withinTemporary)) rmSync(resolvedOutput, { recursive: true, force: true });
}
process.exitCode = status;
