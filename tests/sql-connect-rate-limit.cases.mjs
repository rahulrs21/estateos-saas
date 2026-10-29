import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getDataConnect } from "firebase-admin/data-connect";

// scripts/test-dataconnect.mjs compiles src/lib/rate-limit to CommonJS first,
// so these cases exercise the production limiter and store code.
const require = createRequire(import.meta.url);
const compiled = process.env.ESTATEOS_RATE_LIMIT_MODULES;

export function registerRateLimitCases({ sdk, forbidden }) {
  describe("Phase 5F shared API rate limiting across app instances", { concurrency: false, skip: compiled ? false : "run through npm run test:dataconnect" }, () => {
    if (!compiled) return;
    const {createRateLimiter, MemoryRateLimitStore} = require(join(compiled, "limiter.js"));
    const {SqlConnectRateLimitStore} = require(join(compiled, "sql-connect-store.js"));
    const apps = [];
    // Each "instance" has its own Firebase app, SQL Connect client, store and
    // limiter, like separate App Hosting containers sharing one database.
    function instance(options = {}) {
      const app = initializeApp({projectId: process.env.GCLOUD_PROJECT ?? "demo-estateos-test"}, `rate-limit-${randomUUID()}`);
      apps.push(app);
      const dc = getDataConnect(sdk.connectorConfig, app);
      const events = [];
      const limiter = createRateLimiter({store: new SqlConnectRateLimitStore(() => dc), fallbackStore: new MemoryRateLimitStore(), keySecret: "integration", onEvent: event => events.push(event), ...options});
      return {limiter, events, dc};
    }
    after(async () => { await Promise.all(apps.map(app => deleteApp(app))); });

    it("enforces one limit across four instances under concurrent load", async () => {
      const instances = Array.from({length: 4}, () => instance());
      const rule = {scope: "test.concurrent", limit: 25, windowSeconds: 60};
      const subject = `member-${randomUUID()}`;
      const decisions = await Promise.all(Array.from({length: 40}, (_, index) => instances[index % 4].limiter.consume([{rule, subject}])));
      assert.equal(decisions.filter(decision => decision.allowed).length, 25, "exactly the limit is allowed in total");
      const blocked = decisions.filter(decision => !decision.allowed);
      assert.equal(blocked.length, 15);
      for (const decision of blocked) {
        assert.equal(decision.scope, "test.concurrent");
        assert.ok(decision.retryAfterSeconds >= 1 && decision.retryAfterSeconds <= 60);
      }
      assert.equal(instances.flatMap(item => item.events).filter(event => event.type === "store_error").length, 0);
      assert.ok(instances.some(item => item.events.some(event => event.type === "blocked")));
    });

    it("per-instance memory counters alone would have allowed four times the limit", async () => {
      const rule = {scope: "test.memory-only", limit: 25, windowSeconds: 60};
      const subject = `member-${randomUUID()}`;
      const separate = Array.from({length: 4}, () => createRateLimiter({store: new MemoryRateLimitStore()}));
      const decisions = await Promise.all(Array.from({length: 100}, (_, index) => separate[index % 4].consume([{rule, subject}])));
      assert.equal(decisions.filter(decision => decision.allowed).length, 100);
    });

    it("keeps member, IP and company buckets independent", async () => {
      const {limiter} = instance();
      const member = {scope: "test.member", limit: 2, windowSeconds: 60};
      const ip = {scope: "test.ip", limit: 3, windowSeconds: 60};
      const a = `a-${randomUUID()}`, b = `b-${randomUUID()}`, address = `203.0.113.${Math.floor(Math.random() * 200)}`;
      assert.equal((await limiter.consume([{rule: member, subject: a}, {rule: ip, subject: address}])).allowed, true);
      assert.equal((await limiter.consume([{rule: member, subject: a}, {rule: ip, subject: address}])).allowed, true);
      const third = await limiter.consume([{rule: member, subject: a}, {rule: ip, subject: address}]);
      assert.equal(third.allowed, false);
      assert.equal(third.scope, "test.member");
      // Another member on the same IP reaches the IP limit (4th hit > 3).
      const otherMember = await limiter.consume([{rule: member, subject: b}, {rule: ip, subject: address}]);
      assert.equal(otherMember.allowed, false);
      assert.equal(otherMember.scope, "test.ip");
      // An unknown IP (empty subject) is skipped, not pooled.
      assert.equal((await limiter.consume([{rule: member, subject: `c-${randomUUID()}`}, {rule: ip, subject: ""}])).allowed, true);
    });

    it("falls back to per-instance counters and reports the error when the shared store fails", async () => {
      const events = [];
      const broken = {name: "sql-connect", increment: async () => { throw new Error("database unavailable"); }};
      const limiter = createRateLimiter({store: broken, fallbackStore: new MemoryRateLimitStore(), onEvent: event => events.push(event)});
      const rule = {scope: "test.fallback", limit: 1, windowSeconds: 60};
      assert.equal((await limiter.consume([{rule, subject: "x"}])).allowed, true);
      assert.equal((await limiter.consume([{rule, subject: "x"}])).allowed, false);
      assert.equal(events.filter(event => event.type === "store_error").length, 2);
      assert.equal(events.find(event => event.type === "store_error").fallback, "memory");
      assert.ok(!JSON.stringify(events).includes("database unavailable"), "store errors are logged by name only");
    });

    it("stores only opaque bucket keys and rejects client SDK access", async () => {
      const {dc} = instance();
      const raw = await dc.executeGraphql("query { rateLimitCounters(limit: 50, orderBy: [{updatedAt: DESC}]) { bucketKey scope hitCount } }");
      assert.ok(raw.data.rateLimitCounters.length > 0);
      for (const row of raw.data.rateLimitCounters) {
        assert.match(row.bucketKey, /^[A-Za-z0-9_-]{43}$/);
        assert.ok(!row.bucketKey.includes("member-") && !row.bucketKey.includes("203.0.113"));
      }
      await forbidden(sdk.hitRateLimitCounter, "owner-a", {bucketKey: "x".repeat(43), scope: "test.client", windowEndsAt: new Date(Date.now() + 60_000).toISOString()});
      await forbidden(sdk.purgeExpiredRateLimitCounters, "owner-a", {before: new Date().toISOString()});
    });

    it("purges expired windows", async () => {
      const {dc} = instance();
      const bucketKey = randomUUID().replaceAll("-", "").padEnd(43, "a").slice(0, 43);
      await sdk.hitRateLimitCounter(dc, {bucketKey, scope: "test.expired", windowEndsAt: new Date(Date.now() - 2 * 3_600_000).toISOString()});
      await sdk.purgeExpiredRateLimitCounters(dc, {before: new Date(Date.now() - 3_600_000).toISOString()});
      const raw = await dc.executeGraphql(`query { rateLimitCounter(key: {bucketKey: "${bucketKey}"}) { bucketKey } }`);
      assert.equal(raw.data.rateLimitCounter, null);
    });
  });
}
