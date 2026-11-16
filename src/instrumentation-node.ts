/*
 * The Node.js part of src/instrumentation.ts (loaded only on the Node.js runtime): the hosted-environment guard.
 * On a wrong configuration the reasons are logged (names only) and the process stops. A server that only answered
 * errors would look healthy to the platform, while a stopped one fails the rollout visibly.
 */
import { assertHostedEnvironment } from "./lib/environment/hosted-guard";

try {
  assertHostedEnvironment();
} catch {
  process.exit(1);
}
