import "server-only";

import { connection } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit/server";
import { read, write } from "@/modules/communications/server/http";
import { completeMetaConnect, disconnectMetaPage, importRecentLeads, listMetaLeadPages, startMetaConnect, type MetaConnectOutcome } from "./connect";

/*
 * Meta Lead Ads settings endpoints (docs/META_LEAD_ADS_PLAN.md#4-settings-screen). Reads need a verified session;
 * changes also need same-origin, the CSRF token and the company header matching the session's company. Only an
 * OWNER or ADMIN may use them (checked in connect.ts and again by each database operation).
 */

const IMPORT_LIMIT = {scope: "lead_ads.import.member", limit: 10, windowSeconds: 60};

export const pagesResponse = (request: Request) => read(request, "lead_ads.pages", context => listMetaLeadPages(context));
export const connectResponse = (request: Request) => write(request, "lead_ads.connect", context => startMetaConnect(context));
export const importResponse = (request: Request, id: string) => write(request, "lead_ads.import", async context => {
  await enforceRateLimit([{rule: IMPORT_LIMIT, subject: context.membership.id}], "Please wait a moment before importing again.");
  return importRecentLeads(context, id);
});
export const disconnectResponse = (request: Request, id: string) => write(request, "lead_ads.disconnect", context => disconnectMetaPage(context, id));

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[character]!);

/** Facebook's return: a small page that says what happened and forwards to the settings screen (where the session cookie applies). */
export async function callbackResponse(request: Request) {
  await connection();
  let outcome: MetaConnectOutcome;
  try { outcome = await completeMetaConnect(new URL(request.url)); }
  catch (error) {
    console.error(JSON.stringify({event: "lead_ads.connect_failed", name: error instanceof Error ? error.name : typeof error}));
    outcome = {ok: false, code: "ERROR", message: "The Page could not be connected. Try again in a moment."};
  }
  if (!outcome.ok) console.warn(JSON.stringify({event: "lead_ads.connect_refused", code: outcome.code}));
  const target = outcome.ok ? "/settings/meta-lead-ads?meta=connected" : `/settings/meta-lead-ads?meta=failed&reason=${encodeURIComponent(outcome.code)}`;
  const title = outcome.ok ? "Facebook connected" : "Facebook not connected";
  const lines = outcome.ok
    ? [`Connected: ${outcome.connected.join(", ")}.`, ...outcome.skipped.map(item => `Not connected: ${item.name} (${item.reason}).`), ...outcome.notes]
    : [outcome.message];
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">${outcome.ok ? `<meta http-equiv="refresh" content="${outcome.notes.length || outcome.skipped.length ? 6 : 2};url=${target}">` : ""}<title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#fafafa;color:#18181b}main{max-width:32rem;padding:2rem;text-align:center}p{line-height:1.5}a{color:inherit;font-weight:600}</style></head>
<body><main><h1>${title}</h1><div data-testid="meta-connect-result">${lines.map(line => `<p>${escapeHtml(line)}</p>`).join("")}</div><p><a href="${target}">Back to Meta Lead Ads settings</a></p></main></body></html>`;
  return new Response(html, {status: outcome.ok ? 200 : 400, headers: {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
}
