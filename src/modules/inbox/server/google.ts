import "server-only";

import { getAppOrigin } from "@/modules/auth/server/config";
import { normalizeEmailIdentity } from "../identity";
import type { GmailMessage } from "../email";
import { pkceChallenge } from "../oauth-state";

/*
 * Google OAuth and the Gmail API, server only (docs/EMAIL_INTEGRATION_PLAN.md#gmail).
 * EstateOS never sees a mailbox password: the member signs in on Google's own
 * consent screen. The client secret and every token stay on the server and are
 * never logged or returned; refresh tokens are stored only encrypted (vault.ts),
 * access tokens only in memory. Scopes are the narrowest that read and send.
 * Tests may point the endpoints at a local fake server; nothing else is accepted.
 */

export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"] as const;
const TIMEOUT_MS = 15_000;
export const CALLBACK_PATH = "/api/inbox/oauth/google/callback";

// Tests only: a local fake server. OAuth may use "localhost" so the browser's return to 127.0.0.1 is cross-site, as with Google.
const localOverride = (name: string) => {
  const value = process.env[name]?.trim();
  return value && process.env.NODE_ENV !== "production" && /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(value) ? value : null;
};
const oauthBase = () => localOverride("INBOX_GOOGLE_OAUTH_BASE");
export const endpoints = () => {
  const local = oauthBase();
  return {
    authorize: local ? `${local}/o/oauth2/v2/auth` : "https://accounts.google.com/o/oauth2/v2/auth",
    token: local ? `${local}/token` : "https://oauth2.googleapis.com/token",
    revoke: local ? `${local}/revoke` : "https://oauth2.googleapis.com/revoke",
    gmail: localOverride("INBOX_GOOGLE_API_BASE") ?? "https://gmail.googleapis.com",
  };
};

/** The OAuth client from the server environment (never from a connection or the browser). */
export function googleClient() {
  const id = process.env.INBOX_GOOGLE_CLIENT_ID?.trim(), secret = process.env.INBOX_GOOGLE_CLIENT_SECRET?.trim();
  return id && secret && /^[A-Za-z0-9._-]{10,200}$/.test(id) && secret.length >= 8 ? {id, secret} : null;
}
export const googleConfigured = () => googleClient() !== null;
export const redirectUri = () => `${getAppOrigin()}${CALLBACK_PATH}`;

export function authorizationUrl(input: {state: string; verifier: string; loginHint?: string | null}) {
  const client = googleClient();
  if (!client) throw new Error("Google OAuth is not configured.");
  const url = new URL(endpoints().authorize);
  url.search = new URLSearchParams({
    client_id: client.id, redirect_uri: redirectUri(), response_type: "code", scope: GMAIL_SCOPES.join(" "), access_type: "offline", prompt: "consent",
    include_granted_scopes: "false", state: input.state, code_challenge: pkceChallenge(input.verifier), code_challenge_method: "S256",
    ...(input.loginHint ? {login_hint: input.loginHint} : {}),
  }).toString();
  return url.toString();
}

export interface GoogleFailure { ok: false; status: number; code: string; message: string }
type Result<T> = {ok: true; data: T} | GoogleFailure;

/** Google's error, reduced to a code and a short message (no token, no payload). */
function failure(status: number, body: unknown): GoogleFailure {
  const value = body as {error?: unknown; error_description?: unknown} | null;
  const nested = typeof value?.error === "object" && value.error !== null ? value.error as {status?: unknown; message?: unknown; code?: unknown} : null;
  const raw = nested ? String(nested.status ?? nested.code ?? status) : typeof value?.error === "string" ? value.error : String(status);
  const message = nested ? nested.message : value?.error_description;
  return {ok: false, status, code: raw.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 40) || String(status), message: typeof message === "string" ? message.replace(/\s+/g, " ").replace(/token[^.]*/gi, "token problem").slice(0, 200) : `HTTP ${status}`};
}

async function call<T>(url: string, init: RequestInit): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(url, {...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS)});
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {ok: false, status: 0, code: timeout ? "TIMEOUT" : "NETWORK", message: timeout ? "Google did not answer in time." : "Google could not be reached."};
  }
  const body = await response.json().catch(() => null);
  return response.ok ? {ok: true, data: body as T} : failure(response.status, body);
}

const form = (values: Record<string, string>) => ({method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded"}, body: new URLSearchParams(values).toString()});

/** Exchanges the authorization code (with the PKCE verifier) for tokens. */
export async function exchangeCode(code: string, verifier: string) {
  const client = googleClient();
  if (!client) return {ok: false, status: 0, code: "NOT_CONFIGURED", message: "Google OAuth is not configured on this server."} satisfies GoogleFailure;
  const result = await call<{access_token?: unknown; refresh_token?: unknown; expires_in?: unknown; scope?: unknown}>(endpoints().token,
    form({grant_type: "authorization_code", code, code_verifier: verifier, client_id: client.id, client_secret: client.secret, redirect_uri: redirectUri()}));
  if (!result.ok) return result;
  const {access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn, scope} = result.data;
  if (typeof accessToken !== "string" || !accessToken) return {ok: false, status: 200, code: "NO_ACCESS_TOKEN", message: "Google returned no access token."} satisfies GoogleFailure;
  if (typeof refreshToken !== "string" || !refreshToken) return {ok: false, status: 200, code: "NO_REFRESH_TOKEN", message: "Google returned no refresh token. Remove EstateOS from your Google account's third-party access and connect again."} satisfies GoogleFailure;
  const scopes = typeof scope === "string" ? scope.split(/\s+/).filter(Boolean) : [];
  const missing = GMAIL_SCOPES.filter(wanted => !scopes.includes(wanted));
  // An unusable grant is withdrawn straight away rather than left behind at Google.
  if (missing.length) await revokeGrant(refreshToken);
  if (missing.length) return {ok: false, status: 200, code: "SCOPES_MISSING", message: "EstateOS needs permission both to read and to send email from this mailbox. Connect again and leave both boxes ticked."} satisfies GoogleFailure;
  return {ok: true as const, accessToken, refreshToken, expiresAt: Date.now() + (Number(expiresIn) > 0 ? Number(expiresIn) : 3600) * 1000, scopes};
}

/*
 * Access tokens are kept in this server's memory only, keyed by connection and
 * by a fingerprint of the grant (so a reconnected mailbox never reuses an old one).
 */
const accessCache = new Map<string, {token: string; expiresAt: number}>();
const cacheKey = (connectionId: string, refreshToken: string) => `${connectionId}|${refreshToken.length}|${refreshToken.slice(-6)}`;

export function rememberAccessToken(connectionId: string, refreshToken: string, token: string, expiresAt: number) {
  accessCache.set(cacheKey(connectionId, refreshToken), {token, expiresAt});
}
export function forgetAccessTokens(connectionId: string) {
  for (const key of accessCache.keys()) if (key.startsWith(`${connectionId}|`)) accessCache.delete(key);
}

/** A valid access token for the grant; `invalid_grant` means the member must reconnect. */
export async function accessTokenFor(connectionId: string, refreshToken: string) {
  const key = cacheKey(connectionId, refreshToken);
  const cached = accessCache.get(key);
  if (cached && cached.expiresAt - 60_000 > Date.now()) return {ok: true as const, token: cached.token};
  const client = googleClient();
  if (!client) return {ok: false, status: 0, code: "NOT_CONFIGURED", message: "Google OAuth is not configured on this server."} satisfies GoogleFailure;
  const result = await call<{access_token?: unknown; expires_in?: unknown}>(endpoints().token, form({grant_type: "refresh_token", refresh_token: refreshToken, client_id: client.id, client_secret: client.secret}));
  if (!result.ok) return result;
  if (typeof result.data.access_token !== "string" || !result.data.access_token) return {ok: false, status: 200, code: "NO_ACCESS_TOKEN", message: "Google returned no access token."} satisfies GoogleFailure;
  const expiresAt = Date.now() + (Number(result.data.expires_in) > 0 ? Number(result.data.expires_in) : 3600) * 1000;
  accessCache.set(key, {token: result.data.access_token, expiresAt});
  return {ok: true as const, token: result.data.access_token};
}

/** Revokes a grant at Google (best effort: the stored copy is wiped regardless). */
export async function revokeGrant(refreshToken: string) {
  const result = await call<unknown>(endpoints().revoke, form({token: refreshToken}));
  return result.ok || (result.status === 400 && result.code === "invalid_token");
}

// --- Gmail API --------------------------------------------------------------------------------
const gmail = <T>(token: string, path: string, init: {method?: "GET" | "POST"; json?: unknown} = {}) =>
  call<T>(`${endpoints().gmail}/gmail/v1/users/me/${path}`, {method: init.method ?? "GET", headers: {Authorization: `Bearer ${token}`, ...(init.json ? {"Content-Type": "application/json"} : {})}, body: init.json ? JSON.stringify(init.json) : undefined});

/** The mailbox the grant really belongs to, and its current history cursor. */
export async function gmailProfile(token: string) {
  const result = await gmail<{emailAddress?: unknown; historyId?: unknown}>(token, "profile");
  if (!result.ok) return result;
  const address = normalizeEmailIdentity(typeof result.data.emailAddress === "string" ? result.data.emailAddress : null);
  const historyId = typeof result.data.historyId === "string" || typeof result.data.historyId === "number" ? String(result.data.historyId) : null;
  if (!address || !historyId || !/^\d{1,30}$/.test(historyId)) return {ok: false, status: 200, code: "PROFILE", message: "Google returned no mailbox address."} satisfies GoogleFailure;
  return {ok: true as const, address, historyId};
}

export interface GmailHistoryPage { history?: Array<{messagesAdded?: Array<{message?: {id?: string; threadId?: string; labelIds?: string[]}}>}>; nextPageToken?: string; historyId?: string }
export const gmailHistory = (token: string, startHistoryId: string, pageToken?: string | null) =>
  gmail<GmailHistoryPage>(token, `history?${new URLSearchParams({startHistoryId, historyTypes: "messageAdded", labelId: "INBOX", maxResults: "100", ...(pageToken ? {pageToken} : {})})}`);

export const gmailRecent = (token: string, query: string, maxResults: number) =>
  gmail<{messages?: Array<{id?: string; threadId?: string}>; resultSizeEstimate?: number}>(token, `messages?${new URLSearchParams({q: query, maxResults: String(maxResults), labelIds: "INBOX"})}`);

const METADATA_HEADERS = ["From", "To", "Subject", "Message-ID", "List-Unsubscribe", "List-Id", "Precedence", "Auto-Submitted", "X-Autoreply", "X-Autorespond", "Return-Path", "X-EstateOS-Message"];
export const gmailMessageHeaders = (token: string, id: string) =>
  gmail<GmailMessage>(token, `messages/${encodeURIComponent(id)}?format=metadata&${METADATA_HEADERS.map(name => `metadataHeaders=${encodeURIComponent(name)}`).join("&")}`);
export const gmailMessage = (token: string, id: string) => gmail<GmailMessage>(token, `messages/${encodeURIComponent(id)}?format=full`);
export const gmailAttachment = (token: string, messageId: string, attachmentId: string) =>
  gmail<{data?: string; size?: number}>(token, `messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`);

/** Sends a raw message in a thread. Only a response with a message ID counts as sent. */
export async function gmailSend(token: string, raw: string, threadId: string | null) {
  const result = await gmail<{id?: unknown; threadId?: unknown}>(token, "messages/send", {method: "POST", json: {raw, ...(threadId ? {threadId} : {})}});
  if (!result.ok) return result;
  if (typeof result.data.id !== "string" || !result.data.id) return {ok: false, status: 200, code: "NO_MESSAGE_ID", message: "Google accepted the request but returned no message ID."} satisfies GoogleFailure;
  return {ok: true as const, providerMessageId: result.data.id.slice(0, 200)};
}
