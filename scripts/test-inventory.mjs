import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = resolve(projectRoot, ".tmp");
mkdirSync(tempRoot, { recursive: true });
const outputDirectory = mkdtempSync(join(tempRoot, "inventory-tests-"));
const testFile = join(projectRoot, "tests", "inventory-validation.test.ts");

function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: projectRoot, stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

let status = 1;
try {
  const compileStatus = run([
    join(projectRoot, "node_modules", "typescript", "bin", "tsc"),
    "--strict", "--module", "commonjs", "--moduleResolution", "node", "--target", "es2022",
    "--lib", "es2022,dom", "--esModuleInterop", "--skipLibCheck", "--rootDir", projectRoot,
    "--outDir", outputDirectory, testFile,
  ]);
  status = compileStatus === 0
    ? run(["--test", join(outputDirectory, "tests", "inventory-validation.test.js")])
    : compileStatus;
} finally {
  const resolvedOutput = resolve(outputDirectory);
  const relativeOutput = relative(tempRoot, resolvedOutput);
  if (relativeOutput && !relativeOutput.startsWith("..") && !isAbsolute(relativeOutput)) {
    rmSync(resolvedOutput, { recursive: true, force: true });
  }
}
process.exitCode = status;
