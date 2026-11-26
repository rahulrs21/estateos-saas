import "server-only";

import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import * as sdk from "@dataconnect/admin-generated";
import { stableUuid } from "@/modules/automations/ids";
import { getAppOrigin } from "@/modules/auth/server/config";
import { asServer, isAdministrator, type Context } from "@/modules/communications/server/data";
import { openSecret, sealSecret, vaultConfigured, type VaultBinding } from "@/modules/inbox/vault";
import { exchangeLoginCodeWithExpiry, metaGraphGet, metaGraphVersion, MetaGraphError } from "@/modules/lead-ads/server/graph";
import { metaAppSecret } from "@/modules/lead-ads/server/secrets";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { accountToday, adCampaigns, campaignDays, metaCampaigns, nextCursor, parseInsights, syncWindow, SYNC_EVERY_MS, type InsightRow } from "../meta-insights";

/*
 * Phase 7F.2: Meta ad accounts (docs/CAMPAIGNS_PLAN.md#2-spend). An OWNER or ADMIN signs in with Facebook (Login for
 * Business, asking only for ads_read) and shares ad accounts; EstateOS reads each account's daily spend per campaign
 * and never changes anything in Meta. The sign-in works like the Lead Ads one (src/modules/lead-ads/server/connect.ts):
 * the return is trusted only through a sealed, single-use, 10-minute state cookie bound to the member and company,
 * and the membership is checked again in the database before anything is saved. The person's token is encrypted for
 * each ad account row (purpose "meta-ads-token") and never returned or logged.
 */

const STATE_COOKIE_PATH = "/api/campaigns/meta";
const STATE_TTL_MS = 10 * 60_000;
const stateCookieName = () => process.env.NODE_ENV === "production" ? "__Secure-estateos_meta_ads_oauth" : "estateos_meta_ads_oauth";
const STATE_BINDING = { purpose: "meta-ads-oauth-state", organizationId: "-", recordId: "-" };
export const META_ADS_SCOPES = ["ads_read"];
const MAX_PAGES = 20;
const log = (event: string, detail: Record<string, unknown>) => console.warn(JSON.stringify({ event: `campaigns.meta.${event}`, ...detail }));

const appId = () => (process.env.META_APP_ID ?? process.env.INBOX_META_APP_ID ?? "").trim();
const loginConfigId = () => (process.env.META_ADS_LOGIN_CONFIG_ID ?? "").trim();
export const metaAdsRedirectUri = () => `${getAppOrigin()}/api/campaigns/meta/callback`;
const tokenBinding = (organizationId: string, id: string): VaultBinding => ({ purpose: "meta-ads-token", organizationId: canonicalUuid(organizationId), recordId: canonicalUuid(id) });

function oauthBase() {
  const override = process.env.META_OAUTH_BASE?.trim();
  if (override && process.env.NODE_ENV !== "production" && /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(override)) return override;
  return "https://www.facebook.com";
}

/** Whether this server can connect ad accounts, and which settings are missing (names only). */
export function metaAdsSetup() {
  const missing = [
    !/^\d{5,30}$/.test(appId()) && "META_APP_ID",
    !metaAppSecret() && "META_APP_SECRET",
    !vaultConfigured() && "INBOX_TOKEN_ENCRYPTION_KEY",
    loginConfigId() && !/^\d{5,30}$/.test(loginConfigId()) && "META_ADS_LOGIN_CONFIG_ID",
  ].filter((name): name is string => Boolean(name));
  return { enabled: missing.length === 0, missing, redirectUri: metaAdsRedirectUri(), usesLoginConfiguration: Boolean(loginConfigId()) };
}

interface ConnectState { v: 1; state: string; uid: string; organizationId: string; expiresAt: number }
const notAllowed = () => new WorkspaceError("PERMISSION_DENIED", 403, "Only company owners and administrators can connect ad accounts.");

export function metaAdsAuthorizationUrl(state: string) {
  const query = new URLSearchParams({ client_id: appId(), redirect_uri: metaAdsRedirectUri(), state, response_type: "code" });
  if (loginConfigId()) query.set("config_id", loginConfigId()); else query.set("scope", META_ADS_SCOPES.join(","));
  return `${oauthBase()}/${metaGraphVersion()}/dialog/oauth?${query}`;
}

/** Starts Facebook's sign-in for ad accounts: sets the sealed state cookie and returns the sign-in address. */
export async function startMetaAdsConnect(context: Context) {
  if (!isAdministrator(context)) throw notAllowed();
  if (!metaAdsSetup().enabled) throw new WorkspaceError("META_ADS_NOT_CONFIGURED", 409, "Connecting ad accounts is not set up on this server yet. Ask the EstateOS administrator.");
  const state: ConnectState = { v: 1, state: randomBytes(24).toString("base64url"), uid: context.request.user.uid, organizationId: canonicalUuid(context.organizationId), expiresAt: Date.now() + STATE_TTL_MS };
  (await cookies()).set(stateCookieName(), sealSecret(JSON.stringify(state), STATE_BINDING).ciphertext,
    { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: STATE_COOKIE_PATH, maxAge: STATE_TTL_MS / 1000 });
  return { authorizationUrl: metaAdsAuthorizationUrl(state.state) };
}

function openState(cookie: string | null | undefined, returned: string | null | undefined, now = Date.now()): ConnectState | null {
  if (!cookie || !returned) return null;
  let state: ConnectState;
  try { state = JSON.parse(openSecret(cookie, "k1", STATE_BINDING)) as ConnectState; } catch { return null; }
  if (state?.v !== 1 || typeof state.state !== "string" || typeof state.uid !== "string" || typeof state.organizationId !== "string" || !(state.expiresAt > now)) return null;
  const a = Buffer.from(state.state), b = Buffer.from(returned);
  return a.length === b.length && timingSafeEqual(a, b) ? state : null;
}

interface MetaAdAccountInfo { adAccountId: string; name: string; currency: string; timeZone: string | null }

/** The ad accounts the person shared, with their currency and time zone. */
async function listAdAccounts(userToken: string): Promise<MetaAdAccountInfo[]> {
  const body = await metaGraphGet<{ data?: unknown }>("me/adaccounts", "account_id,name,currency,timezone_name,account_status", userToken, { limit: "100" });
  if (!Array.isArray(body.data)) return [];
  return body.data.slice(0, 100).flatMap(item => {
    const row = (item ?? {}) as Record<string, unknown>;
    const id = typeof row.account_id === "string" && /^\d{1,40}$/.test(row.account_id) ? row.account_id : null;
    const currency = typeof row.currency === "string" && /^[A-Z]{3}$/.test(row.currency) ? row.currency : null;
    if (!id || !currency) return [];
    const name = typeof row.name === "string" && row.name.trim() ? row.name.trim().slice(0, 200) : `Ad account ${id}`;
    const timeZone = typeof row.timezone_name === "string" && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(row.timezone_name) ? row.timezone_name.slice(0, 64) : null;
    return [{ adAccountId: id, name, currency, timeZone }];
  });
}

export type MetaAdsConnectOutcome = { ok: true; connected: string[]; skipped: Array<{ name: string; reason: string }> } | { ok: false; code: string; message: string };
const refused = (code: string, message: string): MetaAdsConnectOutcome => ({ ok: false, code, message });

/** Facebook's return: connects (or reconnects) every ad account the person shared, then starts their first sync. */
export async function completeMetaAdsConnect(url: URL): Promise<MetaAdsConnectOutcome> {
  const store = await cookies();
  const sealed = store.get(stateCookieName())?.value ?? null;
  store.set(stateCookieName(), "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: STATE_COOKIE_PATH, maxAge: 0 });
  const state = openState(sealed, url.searchParams.get("state"));
  if (!state) return refused("STATE_INVALID", "This Facebook sign-in could not be confirmed (it may have expired). Start again from Marketing → Ad accounts.");
  if (url.searchParams.get("error")) return refused("DENIED", "Facebook sign-in was cancelled, so no ad account was connected.");
  const code = url.searchParams.get("code") ?? "";
  if (!/^[A-Za-z0-9._#|-]{10,2048}$/.test(code)) return refused("NO_CODE", "Facebook did not return a sign-in code. Please try again.");
  if (!metaAdsSetup().enabled) return refused("NOT_CONFIGURED", "Connecting ad accounts is not set up on this server yet.");

  const overview = await asServer("MetaAdAccountsOverview", dc => sdk.metaAdAccountsOverview(dc, { organizationId: state.organizationId, actorUid: state.uid }));
  if (!overview.actor) return refused("NOT_ALLOWED", "Your membership no longer allows connecting ad accounts.");

  let token: { token: string; expiresAt: Date | null }, accounts: MetaAdAccountInfo[];
  try {
    token = await exchangeLoginCodeWithExpiry({ appId: appId(), appSecret: metaAppSecret()!, code, redirectUri: metaAdsRedirectUri() });
    accounts = await listAdAccounts(token.token);
  } catch (error) {
    const detail = error instanceof MetaGraphError ? error.code : "ERROR";
    return refused(`META_${detail}`.slice(0, 60), `Facebook did not accept the sign-in (${detail}). Please try again.`);
  }
  if (accounts.length === 0) return refused("NO_ACCOUNTS", "No ad account was shared. Connect again and choose your ad accounts in Facebook's window.");

  const connected: string[] = [], skipped: Array<{ name: string; reason: string }> = [];
  for (const account of accounts) {
    const existing = (await asServer("MetaAdAccountByExternalId", dc => sdk.metaAdAccountByExternalId(dc, { adAccountId: account.adAccountId }))).account;
    if (existing && canonicalUuid(existing.organizationId) !== state.organizationId) { skipped.push({ name: account.name, reason: "already connected to another EstateOS company" }); continue; }
    const id = existing ? canonicalUuid(existing.id) : randomUUID();
    const sealedToken = sealSecret(token.token, tokenBinding(state.organizationId, id));
    await asServer("SaveMetaAdAccount", dc => sdk.saveMetaAdAccount(dc, {
      organizationId: state.organizationId, id, actorUid: state.uid, adAccountId: account.adAccountId, name: account.name, currency: account.currency, timeZone: account.timeZone,
      tokenCiphertext: sealedToken.ciphertext, tokenKeyId: sealedToken.keyId, tokenExpiresAt: token.expiresAt?.toISOString() ?? null,
    }));
    connected.push(account.name);
    // The first sync reads the last 90 days (best effort: the worker tries again on its next minute).
    await syncMetaAdAccount(state.organizationId, id).catch(() => null);
  }
  console.info(JSON.stringify({ event: "campaigns.meta.connect", organizationId: state.organizationId, connected: connected.length, skipped: skipped.length }));
  if (connected.length === 0) return refused("ALL_TAKEN", "Every ad account you shared is already connected to another EstateOS company. An ad account can belong to one company only.");
  return { ok: true, connected, skipped };
}

/** The company's connected ad accounts (no tokens). OWNER or ADMIN only. */
export async function listMetaAdAccounts(context: Context) {
  if (!isAdministrator(context)) throw notAllowed();
  const data = await asServer("MetaAdAccountsOverview", dc => sdk.metaAdAccountsOverview(dc, { organizationId: context.organizationId, actorUid: context.request.user.uid }));
  return {
    setup: metaAdsSetup(),
    accounts: data.accounts.map(row => ({
      id: canonicalUuid(row.id), adAccountId: row.adAccountId, name: row.name, currency: row.currency, timeZone: row.timeZone ?? null, status: row.status,
      tokenExpiresAt: row.tokenExpiresAt ?? null, connectedAt: row.connectedAt, lastSyncedAt: row.lastSyncedAt ?? null, lastErrorCode: row.lastErrorCode ?? null, firstSyncDone: row.firstSyncDone,
    })),
  };
}
export type MetaAdAccountsView = Awaited<ReturnType<typeof listMetaAdAccounts>>;

/** Syncs one account now (an owner or administrator pressed Sync now). */
export async function syncMetaAdAccountNow(context: Context, id: string) {
  if (!isAdministrator(context)) throw notAllowed();
  const accountId = canonicalUuid(id);
  await asServer("RequestMetaAdAccountSync", dc => sdk.requestMetaAdAccountSync(dc, { organizationId: context.organizationId, id: accountId, actorUid: context.request.user.uid }));
  return syncMetaAdAccount(canonicalUuid(context.organizationId), accountId);
}

/** Disconnects an ad account: its token is deleted and syncing stops; spend already read stays. */
export async function disconnectMetaAdAccount(context: Context, id: string) {
  if (!isAdministrator(context)) throw notAllowed();
  await asServer("DisconnectMetaAdAccount", dc => sdk.disconnectMetaAdAccount(dc, { organizationId: context.organizationId, id: canonicalUuid(id), actorUid: context.request.user.uid }));
  return { disconnected: true };
}

// --- Sync -------------------------------------------------------------------------------------------------------

export interface MetaSyncResult { status: "SYNCED" | "NEEDS_RECONNECT" | "RETRY" | "MISSING"; campaigns: number; days: number; renamed: number; errorCode?: string }

/** Reads the account's daily ad spend for the sync window, page by page (bounded). */
async function readInsights(adAccountId: string, token: string, window: { since: string; until: string }) {
  const rows: InsightRow[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const body: unknown = await metaGraphGet<unknown>(`act_${adAccountId}/insights`, "campaign_id,campaign_name,adset_id,ad_id,spend,impressions,clicks", token, {
      level: "ad", time_increment: "1", time_range: JSON.stringify(window), limit: "500", ...(after ? { after } : {}),
    });
    rows.push(...parseInsights(body));
    after = nextCursor(body);
    if (!after) break;
  }
  return rows;
}

/** One ad account: spend per campaign and day is saved, campaigns are created or linked, and leads named by campaign. */
export async function syncMetaAdAccount(organizationId: string, id: string): Promise<MetaSyncResult> {
  const account = (await asServer("MetaAdAccountSecret", dc => sdk.metaAdAccountSecret(dc, { organizationId, id }))).account;
  if (!account) return { status: "MISSING", campaigns: 0, days: 0, renamed: 0 };
  const mark = (status: "CONNECTED" | "NEEDS_RECONNECT", errorCode: string | null, nextSyncAt: Date, synced: boolean, firstSyncDone: boolean) =>
    asServer("MarkMetaAdAccountSynced", dc => sdk.markMetaAdAccountSynced(dc, { organizationId, id, status: sdk.MetaAdAccountStatus[status], errorCode, nextSyncAt: nextSyncAt.toISOString(), synced, firstSyncDone }));

  let token: string;
  try { token = openSecret(account.tokenCiphertext ?? "", account.tokenKeyId ?? "", tokenBinding(organizationId, id)); }
  catch { await mark("NEEDS_RECONNECT", "TOKEN_UNREADABLE", new Date(Date.now() + SYNC_EVERY_MS), false, account.firstSyncDone); return { status: "NEEDS_RECONNECT", campaigns: 0, days: 0, renamed: 0, errorCode: "TOKEN_UNREADABLE" }; }

  const window = syncWindow(accountToday(account.timeZone ?? null), account.firstSyncDone);
  let rows: InsightRow[];
  try { rows = await readInsights(account.adAccountId, token, window); }
  catch (error) {
    const code = error instanceof MetaGraphError ? error.code : "ERROR";
    const reconnect = error instanceof MetaGraphError && error.failure === "RECONNECT";
    log("sync_failed", { organizationId, account: id, code });
    await mark(reconnect ? "NEEDS_RECONNECT" : "CONNECTED", code, new Date(Date.now() + (reconnect ? SYNC_EVERY_MS : 3_600_000)), false, account.firstSyncDone);
    return { status: reconnect ? "NEEDS_RECONNECT" : "RETRY", campaigns: 0, days: 0, renamed: 0, errorCode: code };
  }

  const campaigns = metaCampaigns(rows);
  const campaignIds = await ensureCampaigns(organizationId, campaigns, account.currency, account.connectedByUid);
  const spend = campaignDays(rows).flatMap(row => {
    const campaignId = campaignIds.get(row.campaignId);
    return campaignId ? [{
      id: stableUuid("meta-spend", organizationId, account.adAccountId, row.campaignId, row.day), campaign_id: campaignId, day: row.day, amount_minor: String(row.spendMinor),
      currency: account.currency, impressions: row.impressions === null ? null : String(row.impressions), clicks: row.clicks === null ? null : String(row.clicks),
    }] : [];
  });
  if (spend.length) await asServer("SaveMetaSpend", dc => sdk.saveMetaSpend(dc, { organizationId, adAccountId: account.adAccountId, rows: spend }));
  const renamed = await asServer("RenameMetaAttributions", dc => sdk.renameMetaAttributions(dc, {
    organizationId,
    campaigns: campaigns.filter(item => item.name).map(item => ({ campaign_id: item.campaignId, name: item.name, key: item.key })),
    ads: adCampaigns(rows).map(item => ({ ad_id: item.adId, adset_id: item.adsetId, campaign_id: item.campaignId, name: item.name, key: item.key })),
  }));
  await mark("CONNECTED", null, new Date(Date.now() + SYNC_EVERY_MS), true, true);
  return { status: "SYNCED", campaigns: campaigns.length, days: spend.length, renamed: Number(renamed.campaigns ?? 0) + Number(renamed.ads ?? 0) };
}

/**
 * The company's campaign for each Meta campaign: the one with its Meta ID, else the one with the same key (added by
 * hand or found in leads, which is then linked to Meta), else a new one named by Meta.
 */
async function ensureCampaigns(organizationId: string, campaigns: Array<{ campaignId: string; name: string | null; key: string }>, currency: string, createdByUid: string) {
  const ids = new Map<string, string>();
  if (!campaigns.length) return ids;
  const found = await asServer("MetaCampaignsForSync", dc => sdk.metaCampaignsForSync(dc, { organizationId, metaCampaignIds: campaigns.map(item => item.campaignId), keys: campaigns.map(item => item.key) }));
  for (const item of campaigns) {
    const byId = found.byId.find(row => row.metaCampaignId === item.campaignId);
    if (byId) { ids.set(item.campaignId, canonicalUuid(byId.id)); continue; }
    const byKey = found.byKey.find(row => row.campaignKey === item.key && !row.metaCampaignId);
    if (byKey) {
      await asServer("LinkCampaignToMeta", dc => sdk.linkCampaignToMeta(dc, { organizationId, id: byKey.id, metaCampaignId: item.campaignId }));
      ids.set(item.campaignId, canonicalUuid(byKey.id));
      continue;
    }
    const id = stableUuid("meta-campaign", organizationId, item.campaignId);
    try {
      await asServer("CreateSyncedCampaign", dc => sdk.createSyncedCampaign(dc, { organizationId, id, campaignKey: item.key, name: (item.name ?? item.key).slice(0, 200), metaCampaignId: item.campaignId, currency, createdByUid }));
    } catch {
      // A campaign with this key and another Meta ID, or created a moment ago by another sync: its spend is skipped this time.
      const again = await asServer("MetaCampaignsForSync", dc => sdk.metaCampaignsForSync(dc, { organizationId, metaCampaignIds: [item.campaignId], keys: [] }));
      if (!again.byId[0]) { log("campaign_skipped", { organizationId, campaign: item.campaignId }); continue; }
    }
    ids.set(item.campaignId, id);
  }
  return ids;
}

/** The worker: syncs ad accounts that are due (every 6 hours each, a few per tick). */
export async function syncDueMetaAdAccounts(limit = 5) {
  const due = (await asServer("MetaAdAccountsDue", dc => sdk.metaAdAccountsDue(dc, { now: new Date().toISOString(), limit }))).accounts;
  const counts = { synced: 0, failed: 0 };
  for (const row of due) {
    const result = await syncMetaAdAccount(canonicalUuid(row.organizationId), canonicalUuid(row.id)).catch(() => ({ status: "RETRY" as const }));
    if (result.status === "SYNCED") counts.synced++; else counts.failed++;
  }
  return counts;
}
