import "server-only";

import { getDataConnect } from "firebase-admin/data-connect";
import { connectorConfig } from "@dataconnect/admin-generated";
import { getFirebaseAdminApp } from "@/lib/firebase/admin";
import { assertSafeDataConnectEnvironment } from "@/modules/organizations/server/dataconnect-policy";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { clientIpFromHeaders, trustedProxyHopsFromEnv } from "./client-ip";
import {
  createRateLimiter, createRateLimitMetrics, MemoryRateLimitStore,
  type RateLimitCheck, type RateLimitEvent, type RateLimiter,
} from "./limiter";
import { SqlConnectRateLimitStore } from "./sql-connect-store";

/**
 * The configured API rate limiter.
 *
 * RATE_LIMIT_BACKEND
 *   sql-connect (default): counters live in the app database and are shared by
 *     every instance. Uses the existing SQL Connect service; no extra
 *     infrastructure.
 *   memory: per-process counters for local development and tests only. Not
 *     allowed in production because limits would multiply with instances.
 * If the shared store errors, the limiter logs the failure and falls back to
 * per-instance memory counters for that request instead of failing open.
 */
let configured: RateLimiter | null = null;
const metrics = createRateLimitMetrics();

function report(event: RateLimitEvent) {
  metrics.record(event);
  // Structured logs are the monitoring signal (Cloud Logging on App Hosting).
  // Bucket keys, member IDs and IP addresses are never logged.
  console.warn(JSON.stringify({event: `rate_limit.${event.type}`, ...event, totals: metrics.snapshot()[event.scope]}));
}

function backendName() {
  const value = process.env.RATE_LIMIT_BACKEND?.trim() || "sql-connect";
  if (value !== "sql-connect" && value !== "memory") throw new Error("RATE_LIMIT_BACKEND must be sql-connect or memory.");
  if (value === "memory" && process.env.NODE_ENV === "production") throw new Error("RATE_LIMIT_BACKEND=memory is for local development only.");
  return value;
}

export function apiRateLimiter(): RateLimiter {
  if (configured) return configured;
  const memory = new MemoryRateLimitStore();
  const backend = backendName();
  const keySecret = process.env.RATE_LIMIT_KEY_SECRET?.trim() ?? "";
  if (!keySecret && process.env.NODE_ENV === "production") {
    console.warn(JSON.stringify({event: "rate_limit.config", message: "RATE_LIMIT_KEY_SECRET is not set; bucket keys use an unsalted hash."}));
  }
  const store = backend === "memory" ? memory : new SqlConnectRateLimitStore(() => {
    assertSafeDataConnectEnvironment({nodeEnv: process.env.NODE_ENV, emulatorHost: process.env.DATA_CONNECT_EMULATOR_HOST});
    return getDataConnect(connectorConfig, getFirebaseAdminApp());
  }, Date.now, error => console.warn(JSON.stringify({event: "rate_limit.purge_error", error: error instanceof Error ? error.name : "Error"})));
  configured = createRateLimiter({store, fallbackStore: backend === "memory" ? undefined : memory, keySecret, onEvent: report});
  return configured;
}

export function requestClientIp(request: Request) {
  return clientIpFromHeaders(request.headers, trustedProxyHopsFromEnv(process.env.RATE_LIMIT_TRUSTED_PROXY_HOPS));
}

/** Throw a 429 WorkspaceError (sent with Retry-After) when any check is over its limit. */
export async function enforceRateLimit(checks: RateLimitCheck[], message: string) {
  const decision = await apiRateLimiter().consume(checks);
  if (!decision.allowed) throw new WorkspaceError("RATE_LIMITED", 429, message, decision.retryAfterSeconds);
}
