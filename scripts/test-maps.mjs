import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = resolve(projectRoot, ".tmp");
mkdirSync(tempRoot, { recursive: true });
const outputDirectory = mkdtempSync(join(tempRoot, "maps-tests-"));
// Usage: node scripts/test-maps.mjs [test files…]; defaults to the map suites.
const testFiles = (process.argv.length > 2 ? process.argv.slice(2) : ["tests/maps.test.ts", "tests/maps-public.test.tsx"]).map(file => join(projectRoot, file));

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
    "--lib", "es2022,dom,dom.iterable", "--esModuleInterop", "--skipLibCheck", "--jsx", "react-jsx", "--rootDir", projectRoot,
    "--outDir", outputDirectory, ...testFiles,
  ]);
  status = compileStatus === 0
    ? run(["--test", ...testFiles.map(file => join(outputDirectory, relative(projectRoot, file)).replace(/\.tsx?$/, ".js"))])
    : compileStatus;
} finally {
  const resolvedOutput = resolve(outputDirectory);
  const relativeOutput = relative(tempRoot, resolvedOutput);
  if (relativeOutput && !relativeOutput.startsWith("..") && !isAbsolute(relativeOutput)) {
    rmSync(resolvedOutput, { recursive: true, force: true });
  }
}
process.exitCode = status;
