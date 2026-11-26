import "server-only";

import { connection } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit/server";
import { read, write } from "@/modules/communications/server/http";
import { completeMetaAdsConnect, disconnectMetaAdAccount, listMetaAdAccounts, startMetaAdsConnect, syncMetaAdAccountNow, type MetaAdsConnectOutcome } from "./meta-ads";

/*
 * Phase 7F.2: Meta ad account endpoints (docs/CAMPAIGNS_PLAN.md). Reads need a verified session; changes also need
 * same-origin, the CSRF token and the company header matching the session's company. OWNER or ADMIN only (checked in
 * meta-ads.ts and again by each database operation).
 */

const SYNC_LIMIT = { scope: "campaigns.meta.sync.member", limit: 6, windowSeconds: 60 };

export const accountsResponse = (request: Request) => read(request, "campaigns.meta.accounts", context => listMetaAdAccounts(context));
export const connectResponse = (request: Request) => write(request, "campaigns.meta.connect", context => startMetaAdsConnect(context));
export const syncResponse = (request: Request, id: string) => write(request, "campaigns.meta.sync", async context => {
  await enforceRateLimit([{ rule: SYNC_LIMIT, subject: context.membership.id }], "Please wait a moment before syncing again.");
  return syncMetaAdAccountNow(context, id);
});
export const disconnectResponse = (request: Request, id: string) => write(request, "campaigns.meta.disconnect", context => disconnectMetaAdAccount(context, id));

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

/** Facebook's return: a small page that says what happened and forwards to Ad accounts (where the session cookie applies). */
export async function callbackResponse(request: Request) {
  await connection();
  let outcome: MetaAdsConnectOutcome;
  try { outcome = await completeMetaAdsConnect(new URL(request.url)); }
  catch (error) {
    console.error(JSON.stringify({ event: "campaigns.meta.connect_failed", name: error instanceof Error ? error.name : typeof error }));
    outcome = { ok: false, code: "ERROR", message: "The ad accounts could not be connected. Try again in a moment." };
  }
  if (!outcome.ok) console.warn(JSON.stringify({ event: "campaigns.meta.connect_refused", code: outcome.code }));
  const target = outcome.ok ? "/workspace/marketing/ad-accounts?meta=connected" : `/workspace/marketing/ad-accounts?meta=failed&reason=${encodeURIComponent(outcome.code)}`;
  const title = outcome.ok ? "Ad accounts connected" : "Ad accounts not connected";
  const lines = outcome.ok ? [`Connected: ${outcome.connected.join(", ")}.`, ...outcome.skipped.map(item => `Not connected: ${item.name} (${item.reason}).`)] : [outcome.message];
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">${outcome.ok ? `<meta http-equiv="refresh" content="${outcome.skipped.length ? 6 : 2};url=${target}">` : ""}<title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#fafafa;color:#18181b}main{max-width:32rem;padding:2rem;text-align:center}p{line-height:1.5}a{color:inherit;font-weight:600}</style></head>
<body><main><h1>${title}</h1><div data-testid="meta-ads-connect-result">${lines.map(line => `<p>${escapeHtml(line)}</p>`).join("")}</div><p><a href="${target}">Back to ad accounts</a></p></main></body></html>`;
  return new Response(html, { status: outcome.ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" } });
}
