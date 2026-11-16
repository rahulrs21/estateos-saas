/**
 * Runs once when a Next.js server starts, before it handles requests. A staging or production server checks its own
 * configuration and refuses to start when it could reach an emulator, another Firebase project or real WhatsApp
 * customers from staging (src/instrumentation-node.ts, src/lib/environment/hosted-guard.ts). Local development is
 * not checked. The build has no runtime secrets or origin yet; the running server is what is checked.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    await import("./instrumentation-node");
  }
}
