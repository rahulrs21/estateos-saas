import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const command = process.argv[2];
if (command !== "build" && command !== "generate") throw new Error("Expected build or generate.");

let cliRoot;
try {
  cliRoot = dirname(require.resolve("firebase-tools/package.json"));
} catch {
  // npm's command is fixed; no user input is interpolated into shell code.
  const npmRoot = process.platform === "win32"
    ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm root -g"], { encoding: "utf8", windowsHide: true })
    : spawnSync("npm", ["root", "-g"], { encoding: "utf8" });
  if (npmRoot.status !== 0) throw new Error("Install Firebase CLI 15.34.0 or later first.");
  cliRoot = join(npmRoot.stdout.trim(), "firebase-tools");
}
const details = JSON.parse(readFileSync(join(cliRoot, "lib/emulator/downloadableEmulatorInfo.json"), "utf8"));
const platform = process.platform === "darwin" && process.arch === "arm64" ? "darwin_arm64" : process.platform;
const toolkit = details.dataconnect[platform];
if (!toolkit) throw new Error(`Unsupported SQL Connect toolkit platform: ${platform}`);
const binary = join(process.env.FIREBASE_EMULATORS_PATH || join(homedir(), ".cache/firebase/emulators"), toolkit.downloadPathRelativeToCacheDir);
if (!existsSync(binary)) throw new Error("Download the local toolkit with: firebase setup:emulators:dataconnect");

// Omitting --project_id is intentional: validate entirely locally, without
// fetching deployed schemas, accessing CLI credentials or requiring cloud IAM.
const args = command === "build" ? ["build"] : ["sdk", "generate"];
args.push(`--config_dir=${join(projectRoot, "dataconnect")}`);
const result = spawnSync(binary, args, { cwd: projectRoot, encoding: "utf8", windowsHide: true });
if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr || "SQL Connect toolkit failed.\n");
  process.exitCode = result.status || 1;
} else if (command === "build") {
  const output = JSON.parse(result.stdout);
  if (output.errors?.length) {
    console.error(JSON.stringify(output.errors, null, 2));
    process.exitCode = 1;
  } else {
    console.log(`SQL Connect schema and operations validated locally (toolkit ${toolkit.version}).`);
  }
} else {
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  console.log("SQL Connect Admin SDK generated.");
}
