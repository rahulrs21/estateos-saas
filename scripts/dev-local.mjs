import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

if (process.env.NODE_ENV === "production") throw new Error("Local database development cannot run in production.");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
let cliRoot;
try {
  cliRoot = dirname(require.resolve("firebase-tools/package.json"));
} catch {
  const result = process.platform === "win32"
    ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm root -g"], { encoding: "utf8", windowsHide: true })
    : spawnSync("npm", ["root", "-g"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Install Firebase CLI before starting local SQL Connect.");
  cliRoot = join(result.stdout.trim(), "firebase-tools");
}
const cliConfig = join(root, ".tmp", "firebase-cli-local");
mkdirSync(cliConfig, { recursive: true });
console.log("EstateOS local development: SQL Connect 127.0.0.1:9399; Next.js localhost:3000.");
console.log("Uses local PostgreSQL with no seed companies. Firebase Authentication remains configured as before.");
console.log("Stop any existing Next.js development server before starting this command.");
const child = spawn(process.execPath, [
  join(cliRoot, "lib", "bin", "firebase.js"),
  "emulators:exec", "--project", "demo-estateos", "--config", "firebase.local.json",
  "--only", "dataconnect", "npm run dev -- --port 3000",
], {
  cwd: root, stdio: "inherit", windowsHide: true,
  env: { ...process.env, XDG_CONFIG_HOME: cliConfig, FIREBASE_CLI_DISABLE_UPDATE_CHECK: "1" },
});
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
