import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Compile only the real, dependency-injected authentication policies and their
// tests. The tests never initialize Firebase or load credentials from .env.local.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = resolve(projectRoot, ".tmp");
mkdirSync(tempRoot, { recursive: true });
const outputDirectory = mkdtempSync(join(tempRoot, "auth-tests-"));
const testFiles = readdirSync(join(projectRoot, "tests"))
  .filter((filename) => filename.startsWith("auth-") && filename.endsWith(".test.ts"))
  .map((filename) => join("tests", filename));

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

let status = 1;
try {
  if (testFiles.length === 0) throw new Error("No authentication tests found.");
  const compileStatus = run([
    join(projectRoot, "node_modules", "typescript", "bin", "tsc"),
    "--strict",
    "--module", "commonjs",
    "--moduleResolution", "node",
    "--target", "es2022",
    "--lib", "es2022,dom",
    "--esModuleInterop",
    "--skipLibCheck",
    "--rootDir", projectRoot,
    "--outDir", outputDirectory,
    ...testFiles,
  ]);
  status = compileStatus === 0
    ? run(["--test", ...testFiles.map((filename) => join(outputDirectory, filename.replace(/\.ts$/, ".js")))])
    : compileStatus;
} finally {
  // Resolve and verify the absolute target before recursive cleanup on Windows.
  const resolvedOutput = resolve(outputDirectory);
  const relativeOutput = relative(tempRoot, resolvedOutput);
  if (relativeOutput && !relativeOutput.startsWith("..") && !isAbsolute(relativeOutput)) {
    rmSync(resolvedOutput, { recursive: true, force: true });
  }
}
process.exitCode = status;
