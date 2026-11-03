import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/*
 * The local automation worker (docs/AUTOMATION_OPERATIONS.md#local-worker).
 *
 * It calls the app's secret-authenticated tick endpoint every few seconds; all
 * state lives in the database, so stopping it (or the app) loses nothing and
 * the next tick continues where the last one stopped. `npm run dev:local`
 * starts it automatically when AUTOMATION_WORKER_SECRET is set in .env.local;
 * `npm run automation:worker` runs it on its own against a running app.
 *
 * Local only: it refuses non-local origins. Hosted environments use the
 * documented Cloud Scheduler adapter instead. The secret is never printed.
 */

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

export function envValue(name, env = process.env) {
  if (env[name]) return env[name].trim();
  const file = join(root, ".env.local");
  if (!existsSync(file)) return "";
  const line = readFileSync(file, "utf8").split(/\r?\n/).find(item => new RegExp(`^\\s*${name}\\s*=`).test(item));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^(['"])(.*)\1$/, "$2") : "";
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Starts ticking; returns a handle to stop. Ticks never overlap, and failures back off up to 30 seconds. */
export function startAutomationWorker({origin, secret, intervalMs = 5000, log = message => console.log(`[automation-worker] ${message}`)}) {
  const url = new URL("/api/internal/automations/tick", origin);
  if (!LOCAL_HOSTS.has(url.hostname)) throw new Error(`The local automation worker only calls a local app (got ${url.hostname}). Use the Cloud Scheduler adapter for hosted environments.`);
  if (!secret || secret.length < 32) throw new Error("Set AUTOMATION_WORKER_SECRET (at least 32 random characters) in .env.local for the app and the worker.");
  let stopped = false, timer = null, failures = 0, notified = new Set();
  const once = (key, message) => { if (!notified.has(key)) { notified.add(key); log(message); } };
  async function tick() {
    if (stopped) return;
    let delay = intervalMs;
    try {
      const response = await fetch(url, {method: "POST", headers: {Authorization: `Bearer ${secret}`}, signal: AbortSignal.timeout(60_000)});
      const body = await response.json().catch(() => null);
      if (response.ok && body?.data) {
        failures = 0;
        notified.delete("down");
        const {events, executionsStarted, jobs, steps, errors} = body.data;
        if (events || executionsStarted || jobs || steps || errors) log(`tick: ${events} events, ${executionsStarted} executions started, ${jobs} jobs, ${steps} steps${errors ? `, ${errors} errors (see the app log)` : ""}`);
      } else if (response.status === 503 && body?.error?.code === "WORKER_NOT_CONFIGURED") {
        once("config", "The app has no AUTOMATION_WORKER_SECRET; set the same value in .env.local and restart the app.");
        delay = 30_000;
      } else if (response.status === 401) {
        once("auth", "The app rejected the worker secret; the app and the worker must use the same AUTOMATION_WORKER_SECRET.");
        delay = 30_000;
      } else {
        failures += 1;
        delay = Math.min(30_000, intervalMs * 2 ** failures);
        log(`tick failed (HTTP ${response.status}); retrying in ${Math.round(delay / 1000)} s.`);
      }
    } catch {
      // The app is starting, compiling or stopped: wait quietly and try again.
      failures += 1;
      delay = Math.min(30_000, intervalMs * 2 ** Math.min(failures, 4));
      once("down", "Waiting for the app to accept ticks…");
    }
    if (!stopped) timer = setTimeout(tick, delay);
  }
  timer = setTimeout(tick, Math.min(intervalMs, 2000));
  log(`started: ticking ${url.origin} every ${Math.round(intervalMs / 1000)} s.`);
  return {stop() { stopped = true; if (timer) clearTimeout(timer); }};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.env.NODE_ENV === "production") throw new Error("The local automation worker does not run in production.");
  const worker = startAutomationWorker({
    origin: envValue("AUTOMATION_WORKER_ORIGIN") || "http://localhost:3000",
    secret: envValue("AUTOMATION_WORKER_SECRET"),
    intervalMs: Math.max(1000, Number(envValue("AUTOMATION_WORKER_INTERVAL_MS")) || 5000),
  });
  for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"]) process.on(signal, () => { worker.stop(); process.exit(0); });
}
