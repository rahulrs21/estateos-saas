import "server-only";

import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import * as sdk from "@dataconnect/admin-generated";
import { getAppOrigin } from "@/modules/auth/server/config";
import { asServer, isAdministrator, type Context } from "@/modules/communications/server/data";
import { openSecret, sealSecret, vaultConfigured } from "@/modules/inbox/vault";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { exchangeLoginCode, listGrantedPages, MetaGraphError, metaGraphVersion, subscribePageToLeads, unsubscribePage } from "./graph";
import { connectionForPage, connectionToken } from "./process";
import { pollConnection } from "./poll";
import { metaAppSecret, metaVerifyToken, pageTokenBinding } from "./secrets";

/*
 * Connecting Facebook Pages for Meta Lead Ads (docs/META_LEAD_ADS_PLAN.md#1-connecting-a-page).
 * An OWNER or ADMIN starts Facebook's own sign-in (Facebook Login for Business) and chooses the Pages to share there.
 * Facebook returns a one-time code to /api/lead-ads/meta/callback. The session cookie is SameSite=strict and is not
 * sent on that return, so the callback trusts only a sealed, single-use, 10-minute state cookie bound to the member
 * and company that started it, and re-checks the membership before saving anything. The code is swapped for the
 * person's long-lived token with EstateOS's app secret; each shared Page's own token is encrypted for its connection
 * and the Page is subscribed to EstateOS's lead webhook. The person's own token is never stored.
 */

const STATE_COOKIE_PATH = "/api/lead-ads/meta";
const STATE_TTL_MS = 10 * 60_000;
const stateCookieName = () => process.env.NODE_ENV === "production" ? "__Secure-estateos_meta_oauth" : "estateos_meta_oauth";
const STATE_BINDING = {purpose: "meta-oauth-state", organizationId: "-", recordId: "-"};
/** The permissions asked for when no Login for Business configuration is set (the configuration lists the same). */
export const META_LEAD_SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_metadata", "pages_manage_ads", "leads_retrieval"];

const appId = () => (process.env.META_APP_ID ?? process.env.INBOX_META_APP_ID ?? "").trim();
const loginConfigId = () => (process.env.META_LEAD_ADS_LOGIN_CONFIG_ID ?? "").trim();
export const metaRedirectUri = () => `${getAppOrigin()}/api/lead-ads/meta/callback`;

/** Facebook's sign-in dialog. Tests may point it at a local fake; nothing else is accepted. */
function oauthBase() {
  const override = process.env.META_OAUTH_BASE?.trim();
  if (override && process.env.NODE_ENV !== "production" && /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(override)) return override;
  return "https://www.facebook.com";
}

/** Whether this server can connect Pages, and which settings are missing (names only, for EstateOS staff). */
export function leadAdsSetup() {
  const missing = [
    !/^\d{5,30}$/.test(appId()) && "META_APP_ID",
    !metaAppSecret() && "META_APP_SECRET",
    !metaVerifyToken() && "META_LEAD_ADS_VERIFY_TOKEN",
    !vaultConfigured() && "INBOX_TOKEN_ENCRYPTION_KEY",
    loginConfigId() && !/^\d{5,30}$/.test(loginConfigId()) && "META_LEAD_ADS_LOGIN_CONFIG_ID",
  ].filter((name): name is string => Boolean(name));
  return {enabled: missing.length === 0, missing, redirectUri: metaRedirectUri(), webhookUrl: `${getAppOrigin()}/api/lead-ads/webhooks/meta`};
}

interface ConnectState { v: 1; state: string; uid: string; organizationId: string; expiresAt: number }

export function authorizationUrl(state: string) {
  const query = new URLSearchParams({client_id: appId(), redirect_uri: metaRedirectUri(), state, response_type: "code"});
  if (loginConfigId()) query.set("config_id", loginConfigId()); else query.set("scope", META_LEAD_SCOPES.join(","));
  return `${oauthBase()}/${metaGraphVersion()}/dialog/oauth?${query}`;
}

const notAllowed = () => new WorkspaceError("PERMISSION_DENIED", 403, "Only company owners and administrators can connect Facebook Pages.");

/** Starts Facebook's sign-in: sets the sealed state cookie and returns the sign-in address. */
export async function startMetaConnect(context: Context) {
  if (!isAdministrator(context)) throw notAllowed();
  const setup = leadAdsSetup();
  if (!setup.enabled) throw new WorkspaceError("META_LEADS_NOT_CONFIGURED", 409, "Connecting Facebook is not set up on this server yet. Ask the EstateOS administrator.");
  const state: ConnectState = {v: 1, state: randomBytes(24).toString("base64url"), uid: context.request.user.uid, organizationId: canonicalUuid(context.organizationId), expiresAt: Date.now() + STATE_TTL_MS};
  (await cookies()).set(stateCookieName(), sealSecret(JSON.stringify(state), STATE_BINDING).ciphertext,
    {httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: STATE_COOKIE_PATH, maxAge: STATE_TTL_MS / 1000});
  return {authorizationUrl: authorizationUrl(state.state)};
}

/** The sealed state, only if intact, unexpired and equal to the `state` Facebook returned. */
export function openConnectState(cookie: string | null | undefined, returned: string | null | undefined, now = Date.now()): ConnectState | null {
  if (!cookie || !returned) return null;
  let state: ConnectState;
  try { state = JSON.parse(openSecret(cookie, "k1", STATE_BINDING)) as ConnectState; } catch { return null; }
  if (state?.v !== 1 || typeof state.state !== "string" || typeof state.uid !== "string" || typeof state.organizationId !== "string" || !(state.expiresAt > now)) return null;
  const a = Buffer.from(state.state), b = Buffer.from(returned);
  return a.length === b.length && timingSafeEqual(a, b) ? state : null;
}

export type MetaConnectOutcome =
  | {ok: true; connected: string[]; skipped: Array<{name: string; reason: string}>; notes: string[]}
  | {ok: false; code: string; message: string};

const refused = (code: string, message: string): MetaConnectOutcome => ({ok: false, code, message});

/** Facebook's return: connects (or refreshes) every Page the person shared. */
export async function completeMetaConnect(url: URL): Promise<MetaConnectOutcome> {
  const store = await cookies();
  const sealed = store.get(stateCookieName())?.value ?? null;
  // Single use: the state is removed whatever happens next.
  store.set(stateCookieName(), "", {httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: STATE_COOKIE_PATH, maxAge: 0});
  const state = openConnectState(sealed, url.searchParams.get("state"));
  if (!state) return refused("STATE_INVALID", "This Facebook sign-in could not be confirmed (it may have expired). Start again from Settings → Meta Lead Ads.");
  if (url.searchParams.get("error")) return refused("DENIED", "Facebook sign-in was cancelled, so no Page was connected.");
  const code = url.searchParams.get("code") ?? "";
  if (!/^[A-Za-z0-9._#|-]{10,2048}$/.test(code)) return refused("NO_CODE", "Facebook did not return a sign-in code. Please try again.");
  const setup = leadAdsSetup();
  if (!setup.enabled) return refused("NOT_CONFIGURED", "Connecting Facebook is not set up on this server yet.");

  const overview = await asServer("MetaLeadOverview", dc => sdk.metaLeadOverview(dc, {organizationId: state.organizationId, actorUid: state.uid}));
  if (!overview.actor) return refused("NOT_ALLOWED", "Your membership no longer allows connecting Facebook Pages.");

  let pages;
  try {
    const userToken = await exchangeLoginCode({appId: appId(), appSecret: metaAppSecret()!, code, redirectUri: metaRedirectUri()});
    pages = await listGrantedPages(userToken);
  } catch (error) {
    const detail = error instanceof MetaGraphError ? error.code : "ERROR";
    return refused(`META_${detail}`.slice(0, 60), `Facebook did not accept the sign-in (${detail}). Please try again.`);
  }
  if (pages.length === 0) return refused("NO_PAGES", "No Facebook Page was shared. Connect again and choose your Page in Facebook's window.");

  const connected: string[] = [];
  const skipped: Array<{name: string; reason: string}> = [];
  const notes: string[] = [];
  for (const page of pages) {
    const existing = await connectionForPage(page.id);
    if (existing && existing.organizationId !== state.organizationId) { skipped.push({name: page.name, reason: "already connected to another EstateOS company"}); continue; }
    const id = existing?.id ?? randomUUID();
    const sealedToken = sealSecret(page.accessToken, pageTokenBinding(state.organizationId, id));
    const variables = {organizationId: state.organizationId, id, actorUid: state.uid, pageId: page.id, pageName: page.name, tokenCiphertext: sealedToken.ciphertext, tokenKeyId: sealedToken.keyId};
    if (existing) await asServer("ReconnectMetaLeadConnection", dc => sdk.reconnectMetaLeadConnection(dc, variables));
    else await asServer("CreateMetaLeadConnection", dc => sdk.createMetaLeadConnection(dc, variables));
    connected.push(page.name);
    if (!page.tasks.some(task => task === "ADVERTISE" || task === "MANAGE")) notes.push(`${page.name}: your Facebook role may not allow reading its leads (it needs the Advertise task). Ask a Page admin to give you that access.`);
    try { await subscribePageToLeads(page.id, page.accessToken); }
    catch (error) { notes.push(`${page.name}: instant notifications are not on yet (${error instanceof MetaGraphError ? error.code : "ERROR"}). Leads are still checked every 15 minutes.`); }
    // Registers its forms and imports the last 7 days of leads (best effort: the worker checks again in 15 minutes).
    await pollConnection(state.organizationId, id, {since: new Date(Date.now() - 7 * 86_400_000), origin: "IMPORT"}).catch(() => null);
  }
  console.info(JSON.stringify({event: "lead_ads.connect", organizationId: state.organizationId, connected: connected.length, skipped: skipped.length}));
  if (connected.length === 0) return refused("ALL_TAKEN", "Every Page you shared is already connected to another EstateOS company. A Page can belong to one company only.");
  return {ok: true, connected, skipped, notes};
}

/** Settings: the company's connected Pages, their forms and recent failures. OWNER or ADMIN only. */
export async function listMetaLeadPages(context: Context) {
  if (!isAdministrator(context)) throw notAllowed();
  const data = await asServer("MetaLeadOverview", dc => sdk.metaLeadOverview(dc, {organizationId: context.organizationId, actorUid: context.request.user.uid}));
  return {
    setup: leadAdsSetup(),
    pages: data.connections.map(row => ({
      id: canonicalUuid(row.id), pageId: row.pageId, pageName: row.pageName, status: row.status, lastErrorCode: row.lastErrorCode ?? null,
      lastLeadAt: row.lastLeadAt ?? null, lastCheckedAt: row.lastPolledAt ?? null, connectedAt: row.subscribedAt ?? row.createdAt, connectedBy: row.connectedBy?.displayName ?? null,
      forms: row.forms.map(form => ({id: canonicalUuid(form.id), metaFormId: form.metaFormId, name: form.name, enabled: form.enabled, lastLeadAt: form.lastLeadAt ?? null})),
    })),
    failures: data.recentFailures.map(row => ({id: canonicalUuid(row.id), connectionId: canonicalUuid(row.connectionId), leadgenId: row.leadgenId, status: row.status, errorCode: row.errorCode ?? null, attempts: row.attempts, receivedAt: row.receivedAt})),
  };
}
export type MetaLeadPagesView = Awaited<ReturnType<typeof listMetaLeadPages>>;

async function ownConnection(context: Context, id: string) {
  if (!isAdministrator(context)) throw notAllowed();
  const connectionId = canonicalUuid(id);
  const row = (await asServer("MetaLeadConnectionSecret", dc => sdk.metaLeadConnectionSecret(dc, {organizationId: context.organizationId, id: connectionId}))).connection;
  if (!row) throw new WorkspaceError("NOT_FOUND", 404, "This Page is not connected.");
  return {connectionId, row};
}

/** Checks the Page's forms for leads from the last 7 days now (each lead is imported once). */
export async function importRecentLeads(context: Context, id: string) {
  const {connectionId} = await ownConnection(context, id);
  return pollConnection(canonicalUuid(context.organizationId), connectionId, {since: new Date(Date.now() - 7 * 86_400_000), origin: "IMPORT"});
}

/** Disconnects a Page: notifications to EstateOS stop and its token and form settings are deleted; its leads stay. */
export async function disconnectMetaPage(context: Context, id: string) {
  const {connectionId, row} = await ownConnection(context, id);
  const token = connectionToken(canonicalUuid(context.organizationId), connectionId, row);
  const unsubscribed = token ? await unsubscribePage(row.pageId, token) : false;
  await asServer("DisconnectMetaLeadConnection", dc => sdk.disconnectMetaLeadConnection(dc, {organizationId: context.organizationId, id: connectionId, actorUid: context.request.user.uid}));
  return {disconnected: true, unsubscribed};
}
