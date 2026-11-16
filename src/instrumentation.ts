/**
 * Runs once when a Next.js server starts, before it handles requests. A staging or production server checks its own
 * configuration and refuses to start when it could reach an emulator, another Firebase project or real WhatsApp
 * customers from staging (src/lib/environment/hosted-guard.ts). Local development is not checked.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // The build has no runtime secrets or origin yet; the running server is what is checked.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { assertHostedEnvironment } = await import("./lib/environment/hosted-guard");
  try {
    assertHostedEnvironment();
  } catch {
    // The reasons are already logged (names only). Stop the process: a server that only answers errors would look
    // healthy to the platform, while a stopped one fails the rollout visibly.
    process.exit(1);
  }
}
