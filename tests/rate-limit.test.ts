import assert from "node:assert/strict";
import { test } from "node:test";
import { bucketKey, createRateLimiter, MemoryRateLimitStore, windowFor, type RateLimitEvent, type RateLimitStore } from "../src/lib/rate-limit/limiter";
import { clientIpFromHeaders, normalizeIp, trustedProxyHopsFromEnv } from "../src/lib/rate-limit/client-ip";

const rule = {scope: "test.rule", limit: 3, windowSeconds: 60};

test("fixed windows are aligned and report the time until the next window", () => {
  const window = windowFor(rule, 125_000);
  assert.equal(window.index, 2);
  assert.equal(window.endsAt.getTime(), 180_000);
  assert.equal(window.retryAfterSeconds, 55);
  assert.equal(windowFor(rule, 179_999).retryAfterSeconds, 1);
});

test("bucket keys are opaque, stable and separated by secret, scope, subject and window", () => {
  const key = bucketKey(rule, "member-1", 7, "secret");
  assert.match(key, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(key, bucketKey(rule, "member-1", 7, "secret"));
  assert.ok(!key.includes("member-1"));
  for (const other of [bucketKey(rule, "member-1", 7, "other"), bucketKey({...rule, scope: "test.other"}, "member-1", 7, "secret"),
    bucketKey(rule, "member-2", 7, "secret"), bucketKey(rule, "member-1", 8, "secret")]) assert.notEqual(other, key);
});

test("a limiter allows up to the limit per window, then blocks with Retry-After", async () => {
  let now = 1_000;
  const events: RateLimitEvent[] = [];
  const limiter = createRateLimiter({store: new MemoryRateLimitStore(() => now), now: () => now, onEvent: event => events.push(event)});
  for (let index = 0; index < 3; index++) assert.equal((await limiter.consume([{rule, subject: "a"}])).allowed, true);
  const blocked = await limiter.consume([{rule, subject: "a"}]);
  assert.deepEqual(blocked, {allowed: false, scope: "test.rule", limit: 3, retryAfterSeconds: 59});
  assert.equal(events.at(-1)?.type, "blocked");
  assert.equal((await limiter.consume([{rule, subject: "b"}])).allowed, true, "other subjects are unaffected");
  now = 60_000;
  assert.equal((await limiter.consume([{rule, subject: "a"}])).allowed, true, "a new window resets the count");
});

test("the longest wait wins when several checks are exceeded, and empty subjects are skipped", async () => {
  const limiter = createRateLimiter({store: new MemoryRateLimitStore(() => 0), now: () => 0});
  const minute = {scope: "test.minute", limit: 1, windowSeconds: 60};
  const hour = {scope: "test.hour", limit: 1, windowSeconds: 3600};
  await limiter.consume([{rule: minute, subject: "a"}, {rule: hour, subject: "a"}]);
  const decision = await limiter.consume([{rule: minute, subject: "a"}, {rule: hour, subject: "a"}]);
  assert.equal(decision.allowed, false);
  assert.equal(!decision.allowed && decision.scope, "test.hour");
  assert.equal(!decision.allowed && decision.retryAfterSeconds, 3600);
  for (let index = 0; index < 5; index++) assert.equal((await limiter.consume([{rule: minute, subject: ""}])).allowed, true);
});

test("instances sharing one store share one limit; a failing store falls back and reports", async () => {
  const shared = new MemoryRateLimitStore();
  const instances = [createRateLimiter({store: shared}), createRateLimiter({store: shared}), createRateLimiter({store: shared})];
  const decisions = await Promise.all(Array.from({length: 9}, (_, index) => instances[index % 3].consume([{rule, subject: "shared"}])));
  assert.equal(decisions.filter(decision => decision.allowed).length, 3);

  const events: RateLimitEvent[] = [];
  const failing: RateLimitStore = {name: "sql-connect", increment: async () => { throw new TypeError("secret detail"); }};
  const limiter = createRateLimiter({store: failing, fallbackStore: new MemoryRateLimitStore(), onEvent: event => events.push(event)});
  assert.equal((await limiter.consume([{rule, subject: "x"}])).allowed, true);
  assert.deepEqual(events[0], {type: "store_error", scope: "test.rule", store: "sql-connect", fallback: "memory", error: "TypeError"});
  await assert.rejects(createRateLimiter({store: failing}).consume([{rule, subject: "x"}]), TypeError, "without a fallback the error propagates");
});

test("invalid rules are rejected", async () => {
  const limiter = createRateLimiter({store: new MemoryRateLimitStore()});
  await assert.rejects(limiter.consume([{rule: {scope: "Bad Scope", limit: 1, windowSeconds: 60}, subject: "a"}]));
  await assert.rejects(limiter.consume([{rule: {scope: "ok", limit: 0, windowSeconds: 60}, subject: "a"}]));
  await assert.rejects(limiter.consume([{rule: {scope: "ok", limit: 1, windowSeconds: 0}, subject: "a"}]));
});

test("the memory store evicts expired buckets when full", async () => {
  let now = 0;
  const store = new MemoryRateLimitStore(() => now, 2);
  await store.increment("a", "s", new Date(10));
  await store.increment("b", "s", new Date(10));
  now = 20;
  assert.equal(await store.increment("c", "s", new Date(100)), 1);
  assert.equal(await store.increment("a", "s", new Date(100)), 1, "expired bucket restarted");
});

test("client IPs come only from trusted proxy hops in X-Forwarded-For", () => {
  const headers = new Headers({"x-forwarded-for": "198.51.100.66, 203.0.113.7, 10.0.0.2"});
  assert.equal(clientIpFromHeaders(headers, 0), null, "no trusted proxy: headers are ignored");
  assert.equal(clientIpFromHeaders(headers, 1), "10.0.0.2");
  assert.equal(clientIpFromHeaders(headers, 2), "203.0.113.7", "the client-supplied leftmost entry is never used");
  assert.equal(clientIpFromHeaders(headers, 4), null, "fewer entries than hops");
  assert.equal(clientIpFromHeaders(new Headers({"x-forwarded-for": "not-an-ip"}), 1), null);
  assert.equal(clientIpFromHeaders(new Headers({"x-real-ip": "203.0.113.9"}), 1), null, "unvalidated single-value headers are not trusted");
  assert.equal(clientIpFromHeaders(new Headers(), 1), null);
});

test("IP addresses normalize to stable subjects", () => {
  assert.equal(normalizeIp("::ffff:203.0.113.5"), "203.0.113.5");
  assert.equal(normalizeIp("203.0.113.5:443"), "203.0.113.5");
  assert.equal(normalizeIp("[2001:db8:1:2:3:4:5:6]:443"), "2001:db8:1:2::/64");
  assert.equal(normalizeIp("2001:db8:1:2::9"), "2001:db8:1:2::/64", "one subject per /64");
  assert.equal(normalizeIp("2001:db8::1"), "2001:db8:0:0::/64");
  assert.equal(normalizeIp("999.1.1.1"), null);
  assert.equal(trustedProxyHopsFromEnv(undefined), 0);
  assert.equal(trustedProxyHopsFromEnv("1"), 1);
  assert.throws(() => trustedProxyHopsFromEnv("-1"));
  assert.throws(() => trustedProxyHopsFromEnv("x"));
});
