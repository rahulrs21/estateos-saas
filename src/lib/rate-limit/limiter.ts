import { createHash } from "node:crypto";

/**
 * Distributed fixed-window rate limiting. A limiter counts hits in a shared
 * store, so every app instance sees the same totals; the store only ever sees
 * opaque bucket keys, never member IDs or IP addresses.
 *
 * This module has no server-only imports so it can be tested directly. The
 * configured instance used by API routes lives in ./server.ts.
 */

export type RateLimitRule = {
  /** Stable name, e.g. "maps.autocomplete.member". Used in keys, logs and metrics. */
  scope: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitCheck = {rule: RateLimitRule; subject: string};

export interface RateLimitStore {
  readonly name: string;
  /** Atomically add one hit to the bucket and return the bucket's new total. */
  increment(bucketKey: string, scope: string, windowEndsAt: Date): Promise<number>;
}

export type RateLimitDecision =
  | {allowed: true}
  | {allowed: false; scope: string; limit: number; retryAfterSeconds: number};

export type RateLimitEvent =
  | {type: "blocked"; scope: string; limit: number; count: number; retryAfterSeconds: number; store: string}
  | {type: "store_error"; scope: string; store: string; fallback: string | null; error: string};

export type RateLimiterOptions = {
  store: RateLimitStore;
  /** Used when the shared store fails, so a database outage degrades to per-instance limits instead of no limits. */
  fallbackStore?: RateLimitStore;
  /** Mixed into bucket keys so stored keys cannot be linked back to identifiers. */
  keySecret?: string;
  now?: () => number;
  onEvent?: (event: RateLimitEvent) => void;
};

export function windowFor(rule: RateLimitRule, nowMs: number) {
  const windowMs = rule.windowSeconds * 1000;
  const index = Math.floor(nowMs / windowMs);
  const endsAt = (index + 1) * windowMs;
  return {index, endsAt: new Date(endsAt), retryAfterSeconds: Math.max(1, Math.ceil((endsAt - nowMs) / 1000))};
}

export function bucketKey(rule: RateLimitRule, subject: string, windowIndex: number, secret = "") {
  return createHash("sha256").update(`estateos-rate-limit:v1\0${secret}\0${rule.scope}\0${rule.windowSeconds}\0${subject}\0${windowIndex}`).digest("base64url");
}

function assertRule(rule: RateLimitRule) {
  if (!/^[a-z0-9_.-]{1,48}$/.test(rule.scope) || !Number.isInteger(rule.limit) || rule.limit < 1
    || !Number.isInteger(rule.windowSeconds) || rule.windowSeconds < 1 || rule.windowSeconds > 86_400) {
    throw new Error(`Invalid rate limit rule: ${rule.scope}`);
  }
}

export function createRateLimiter({store, fallbackStore, keySecret = "", now = Date.now, onEvent}: RateLimiterOptions) {
  async function hit(check: RateLimitCheck, nowMs: number) {
    const window = windowFor(check.rule, nowMs);
    const key = bucketKey(check.rule, check.subject, window.index, keySecret);
    try {
      return {check, window, count: await store.increment(key, check.rule.scope, window.endsAt), store: store.name};
    } catch (error) {
      onEvent?.({type: "store_error", scope: check.rule.scope, store: store.name, fallback: fallbackStore?.name ?? null, error: error instanceof Error ? error.name : "Error"});
      if (!fallbackStore) throw error;
      return {check, window, count: await fallbackStore.increment(key, check.rule.scope, window.endsAt), store: fallbackStore.name};
    }
  }

  return {
    /**
     * Count one request against every check and report whether all are within
     * their limits. Checks with an empty subject (for example an unknown client
     * IP) are skipped rather than pooled into one shared bucket.
     */
    async consume(checks: RateLimitCheck[]): Promise<RateLimitDecision> {
      const nowMs = now();
      const active = checks.filter(check => check.subject);
      for (const check of active) assertRule(check.rule);
      const results = await Promise.all(active.map(check => hit(check, nowMs)));
      let blocked: Extract<RateLimitDecision, {allowed: false}> | null = null;
      for (const {check, window, count, store: storeName} of results) {
        if (count <= check.rule.limit) continue;
        onEvent?.({type: "blocked", scope: check.rule.scope, limit: check.rule.limit, count, retryAfterSeconds: window.retryAfterSeconds, store: storeName});
        if (!blocked || window.retryAfterSeconds > blocked.retryAfterSeconds) {
          blocked = {allowed: false, scope: check.rule.scope, limit: check.rule.limit, retryAfterSeconds: window.retryAfterSeconds};
        }
      }
      return blocked ?? {allowed: true};
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;

/**
 * Per-process store. It is the documented local-development backend
 * (RATE_LIMIT_BACKEND=memory) and the fallback when the shared store fails; it
 * does not coordinate across instances.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  readonly name = "memory";
  private readonly buckets = new Map<string, {count: number; endsAt: number}>();
  constructor(private readonly now: () => number = Date.now, private readonly maxBuckets = 20_000) {}

  async increment(key: string, _scope: string, windowEndsAt: Date) {
    const nowMs = this.now();
    if (this.buckets.size >= this.maxBuckets) {
      for (const [bucket, value] of this.buckets) if (value.endsAt <= nowMs) this.buckets.delete(bucket);
    }
    const current = this.buckets.get(key);
    if (!current || current.endsAt <= nowMs) {
      this.buckets.set(key, {count: 1, endsAt: windowEndsAt.getTime()});
      return 1;
    }
    return ++current.count;
  }
}

/** Running totals for monitoring; exported as structured logs by ./server.ts. */
export function createRateLimitMetrics() {
  const totals = new Map<string, {blocked: number; storeErrors: number}>();
  return {
    record(event: RateLimitEvent) {
      const current = totals.get(event.scope) ?? {blocked: 0, storeErrors: 0};
      if (event.type === "blocked") current.blocked++; else current.storeErrors++;
      totals.set(event.scope, current);
    },
    snapshot() { return Object.fromEntries(totals); },
  };
}
