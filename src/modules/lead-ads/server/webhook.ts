import "server-only";

import { after } from "next/server";
import { enforceRateLimit, requestClientIp } from "@/lib/rate-limit/server";
import { readBody } from "@/modules/communications/server/webhooks";
import { MetaPayloadError, metaHandshake, parseLeadgenWebhook, verifyMetaSignature } from "../meta";
import { processMetaLeadEvent, recordLeadgen } from "./process";
import { metaAppSecret, metaVerifyToken } from "./secrets";

/*
 * POST/GET /api/lead-ads/webhooks/meta: Meta's Page "leadgen" webhook (docs/META_LEAD_ADS_PLAN.md).
 * One URL for the whole Meta app (Meta allows one per app for Page events). No session: Meta's signature
 * over the exact body, with the app secret, authenticates the request. The company comes from the stored
 * connection of the Page, never from the payload. Each lead is recorded once, then Meta gets 200 at once;
 * the lead itself is fetched and created just after the response, and the worker retries what fails.
 * Responses never say why a request was refused beyond the status code.
 */

const MAX_BODY_BYTES = 256 * 1024;
const RULE = {scope: "lead_ads.webhook.ip", limit: 1200, windowSeconds: 60};
const empty = (status: number) => new Response(null, {status, headers: {"Cache-Control": "no-store"}});
const log = (event: string, detail: Record<string, unknown> = {}) => console.warn(JSON.stringify({event: `lead_ads.webhook.${event}`, ...detail}));

async function limited(request: Request) {
  try { await enforceRateLimit([{rule: RULE, subject: requestClientIp(request) ?? "unknown"}], "Too many requests."); return false; }
  catch { return true; }
}

/** Meta's subscription check: echo hub.challenge for the configured verify token only. */
export async function metaLeadWebhookHandshake(request: Request) {
  if (await limited(request)) return empty(429);
  const token = metaVerifyToken();
  if (!token) { log("verify_token_missing"); return empty(503); }
  const challenge = metaHandshake(new URL(request.url).searchParams, token);
  if (challenge === null) { log("handshake_rejected"); return empty(403); }
  return new Response(challenge, {status: 200, headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"}});
}

export async function metaLeadWebhook(request: Request) {
  if (await limited(request)) return empty(429);
  const secret = metaAppSecret();
  if (!secret) { log("secret_missing"); return empty(503); }
  const rawBody = await readBody(request, MAX_BODY_BYTES);
  if (rawBody === null) return empty(413);
  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), secret)) { log("signature_rejected"); return empty(401); }

  let changes;
  try { changes = parseLeadgenWebhook(rawBody); }
  catch (error) {
    if (error instanceof MetaPayloadError) { log("payload_rejected", {reason: error.message}); return empty(400); }
    throw error;
  }
  // A recording failure (the database is unreachable) gives 500, so Meta delivers again; recording is idempotent.
  const recorded: Array<{organizationId: string; eventId: string}> = [];
  for (const change of changes) {
    const event = await recordLeadgen(change, "WEBHOOK");
    if (event) recorded.push(event);
  }
  if (recorded.length) {
    after(async () => {
      for (const event of recorded) {
        await processMetaLeadEvent(event.organizationId, event.eventId).catch(error => log("process_failed", {eventId: event.eventId, name: error instanceof Error ? error.name : typeof error}));
      }
    });
  }
  return empty(200);
}

export async function metaLeadWebhookResponse(request: Request) {
  try { return await metaLeadWebhook(request); }
  catch (error) { log("unexpected_error", {name: error instanceof Error ? error.name : typeof error}); return empty(500); }
}
export async function metaLeadWebhookHandshakeResponse(request: Request) {
  try { return await metaLeadWebhookHandshake(request); }
  catch { return empty(500); }
}
