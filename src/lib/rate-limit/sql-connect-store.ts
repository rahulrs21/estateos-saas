import type { DataConnect } from "firebase-admin/data-connect";
import { hitRateLimitCounter, purgeExpiredRateLimitCounters } from "@dataconnect/admin-generated";
import type { RateLimitStore } from "./limiter";

const PURGE_INTERVAL_MS = 10 * 60_000;
const RETENTION_MS = 60 * 60_000;

/**
 * Shared store backed by the app's PostgreSQL database through the server-only
 * NO_ACCESS operations in dataconnect/connector/rate-limits.gql. Each hit is a
 * single INSERT … ON CONFLICT DO UPDATE … RETURNING statement, so concurrent
 * hits from any number of app instances are counted exactly.
 *
 * The caller passes an Admin SDK instance without user impersonation; client
 * SDKs cannot call these operations.
 */
export class SqlConnectRateLimitStore implements RateLimitStore {
  readonly name = "sql-connect";
  private lastPurge = 0;
  constructor(private readonly dataConnect: () => DataConnect, private readonly now: () => number = Date.now,
    private readonly onPurgeError?: (error: unknown) => void) {}

  async increment(bucketKey: string, scope: string, windowEndsAt: Date) {
    const dc = this.dataConnect();
    const result = await hitRateLimitCounter(dc, {bucketKey, scope, windowEndsAt: windowEndsAt.toISOString()});
    const counter = result.data.counter as {hit_count?: unknown} | null | undefined;
    const count = Number(counter?.hit_count);
    if (!Number.isInteger(count) || count < 1) throw new Error("RATE_LIMIT_STORE_INVALID_RESPONSE");
    this.purgeOccasionally(dc);
    return count;
  }

  /** Expired windows are deleted in the background at most every ten minutes per instance. */
  private purgeOccasionally(dc: DataConnect) {
    const nowMs = this.now();
    if (nowMs - this.lastPurge < PURGE_INTERVAL_MS) return;
    this.lastPurge = nowMs;
    purgeExpiredRateLimitCounters(dc, {before: new Date(nowMs - RETENTION_MS).toISOString()}).catch(error => this.onPurgeError?.(error));
  }
}
