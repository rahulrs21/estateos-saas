import "server-only";

import { getAppOrigin } from "@/modules/auth/server/config";
import { normalizeEmailIdentity } from "../identity";
import { pkceChallenge } from "../oauth-state";
import { MICROSOFT_SCOPES, microsoftScopesGranted, outlookReplyComment, type OutlookAttachment, type OutlookMessage } from "../outlook";
import { SEND_TIMEOUT_MS, matchOutlookSentReply, type OutlookSentItem } from "../sent-confirmation";

/*
 * Microsoft Entra sign-in and Microsoft Graph mail, server only
 * (docs/EMAIL_INTEGRATION_PLAN.md#microsoft-365). EstateOS never sees a mailbox
 * password: the member signs in on Microsoft's own page. The client secret and
 * every token stay on the server and are never logged or returned; refresh
 * tokens are stored only encrypted, and Microsoft replaces them as they are
 * used, so the newest one is stored each time. Access tokens live only in
 * memory. Messages are addressed by immutable IDs (they stay the same when a
 * message moves between folders, including a sent reply). Tests may point the
 * endpoints at a local fake server; nothing else is accepted.
 */

const TIMEOUT_MS = 15_000;
export const MICROSOFT_CALLBACK_PATH = "/api/inbox/oauth/microsoft/callback";
const IMMUTABLE = {Prefer: 'IdType="ImmutableId"'};

const localOverride = (name: string) => {
  const value = process.env[name]?.trim();
  return value && process.env.NODE_ENV !== "production" && /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(value) ? value : null;
};
/** "common" (work, school and personal accounts), "organizations", "consumers", or one directory's ID or domain. */
export function microsoftTenant() {
  const value = process.env.INBOX_MICROSOFT_TENANT?.trim() || "common";
  return /^(common|organizations|consumers|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z0-9-]+(\.[a-z0-9-]+)+)$/i.test(value) ? value : "common";
}
export const microsoftEndpoints = () => {
  const login = localOverride("INBOX_MICROSOFT_OAUTH_BASE") ?? "https://login.microsoftonline.com";
  return {
    authorize: `${login}/${microsoftTenant()}/oauth2/v2.0/authorize`,
    token: `${login}/${microsoftTenant()}/oauth2/v2.0/token`,
    graph: localOverride("INBOX_MICROSOFT_API_BASE") ?? "https://graph.microsoft.com",
  };
};

/** The app registration from the server environment (never from a connection or the browser). */
export function microsoftClient() {
  const id = process.env.INBOX_MICROSOFT_CLIENT_ID?.trim(), secret = process.env.INBOX_MICROSOFT_CLIENT_SECRET?.trim();
  return id && secret && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) && secret.length >= 8 ? {id, secret} : null;
}
export const microsoftConfigured = () => microsoftClient() !== null;
export const microsoftRedirectUri = () => `${getAppOrigin()}${MICROSOFT_CALLBACK_PATH}`;

export function microsoftAuthorizationUrl(input: {state: string; verifier: string; loginHint?: string | null}) {
  const client = microsoftClient();
  if (!client) throw new Error("Microsoft sign-in is not configured.");
  const url = new URL(microsoftEndpoints().authorize);
  url.search = new URLSearchParams({
    client_id: client.id, redirect_uri: microsoftRedirectUri(), response_type: "code", response_mode: "query", scope: MICROSOFT_SCOPES.join(" "), prompt: "select_account",
    state: input.state, code_challenge: pkceChallenge(input.verifier), code_challenge_method: "S256", ...(input.loginHint ? {login_hint: input.loginHint} : {}),
  }).toString();
  return url.toString();
}

export interface MicrosoftFailure { ok: false; status: number; code: string; message: string }
type Result<T> = {ok: true; data: T} | MicrosoftFailure;

/** Microsoft's error reduced to a code and a short message (no token, no payload). Sign-in errors keep their AADSTS number. */
function failure(status: number, body: unknown): MicrosoftFailure {
  const value = body as {error?: unknown; error_description?: unknown} | null;
  const nested = typeof value?.error === "object" && value.error !== null ? value.error as {code?: unknown; message?: unknown} : null;
  const description = typeof value?.error_description === "string" ? value.error_description : "";
  const aadsts = /AADSTS\d{4,6}/.exec(description)?.[0];
  const raw = nested ? String(nested.code ?? status) : typeof value?.error === "string" ? value.error : String(status);
  const message = nested ? nested.message : description.split(/\r?\n/)[0];
  return {ok: false, status, code: raw.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 40) || String(status),
    message: `${aadsts && !String(message).includes(aadsts) ? `${aadsts} ` : ""}${typeof message === "string" && message ? message.replace(/\s+/g, " ").replace(/token[^.]*/gi, "token problem").slice(0, 200) : `HTTP ${status}`}`};
}

async function call<T>(url: string, init: RequestInit, timeoutMs = TIMEOUT_MS): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(url, {...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(timeoutMs)});
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {ok: false, status: 0, code: timeout ? "TIMEOUT" : "NETWORK", message: timeout ? "Microsoft did not answer in time." : "Microsoft could not be reached."};
  }
  const body = await response.json().catch(() => null);
  return response.ok ? {ok: true, data: body as T} : failure(response.status, body);
}

const form = (values: Record<string, string>) => ({method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded"}, body: new URLSearchParams(values).toString()});
type TokenResponse = {access_token?: unknown; refresh_token?: unknown; expires_in?: unknown; scope?: unknown};
const expiry = (value: unknown) => Date.now() + (Number(value) > 0 ? Number(value) : 3600) * 1000;

/** Exchanges the authorization code (with the PKCE verifier) for tokens; both reading and sending must be granted. */
export async function microsoftExchangeCode(code: string, verifier: string) {
  const client = microsoftClient();
  if (!client) return {ok: false, status: 0, code: "NOT_CONFIGURED", message: "Microsoft sign-in is not configured on this server."} satisfies MicrosoftFailure;
  const result = await call<TokenResponse>(microsoftEndpoints().token, form({grant_type: "authorization_code", code, code_verifier: verifier, client_id: client.id, client_secret: client.secret,
    redirect_uri: microsoftRedirectUri(), scope: MICROSOFT_SCOPES.join(" ")}));
  if (!result.ok) return result;
  const {access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn, scope} = result.data;
  if (typeof accessToken !== "string" || !accessToken) return {ok: false, status: 200, code: "NO_ACCESS_TOKEN", message: "Microsoft returned no access token."} satisfies MicrosoftFailure;
  if (typeof refreshToken !== "string" || !refreshToken) return {ok: false, status: 200, code: "NO_REFRESH_TOKEN", message: "Microsoft did not grant lasting access (offline_access). Connect again and accept every permission."} satisfies MicrosoftFailure;
  const granted = microsoftScopesGranted(typeof scope === "string" ? scope : "");
  if (!granted.ok) return {ok: false, status: 200, code: "SCOPES_MISSING", message: "EstateOS needs permission both to read and to send email from this mailbox. Connect again and accept every permission."} satisfies MicrosoftFailure;
  return {ok: true as const, accessToken, refreshToken, expiresAt: expiry(expiresIn), scopes: granted.scopes};
}

/*
 * Access tokens, in this server's memory only, keyed by connection and a
 * fingerprint of the grant (a reconnected mailbox never reuses an old one).
 */
const accessCache = new Map<string, {token: string; expiresAt: number}>();
const cacheKey = (connectionId: string, refreshToken: string) => `${connectionId}|${refreshToken.length}|${refreshToken.slice(-6)}`;
export function rememberMicrosoftAccessToken(connectionId: string, refreshToken: string, token: string, expiresAt: number) { accessCache.set(cacheKey(connectionId, refreshToken), {token, expiresAt}); }
export function forgetMicrosoftAccessTokens(connectionId: string) { for (const key of accessCache.keys()) if (key.startsWith(`${connectionId}|`)) accessCache.delete(key); }

/**
 * A valid access token for the grant. Microsoft may hand back a new refresh
 * token; `onRotated` stores it (sealed) before the token is used.
 */
export async function microsoftAccessTokenFor(connectionId: string, refreshToken: string, onRotated: (next: string) => Promise<void>) {
  const key = cacheKey(connectionId, refreshToken);
  const cached = accessCache.get(key);
  if (cached && cached.expiresAt - 60_000 > Date.now()) return {ok: true as const, token: cached.token};
  const client = microsoftClient();
  if (!client) return {ok: false, status: 0, code: "NOT_CONFIGURED", message: "Microsoft sign-in is not configured on this server."} satisfies MicrosoftFailure;
  const result = await call<TokenResponse>(microsoftEndpoints().token, form({grant_type: "refresh_token", refresh_token: refreshToken, client_id: client.id, client_secret: client.secret, scope: MICROSOFT_SCOPES.join(" ")}));
  if (!result.ok) return result;
  if (typeof result.data.access_token !== "string" || !result.data.access_token) return {ok: false, status: 200, code: "NO_ACCESS_TOKEN", message: "Microsoft returned no access token."} satisfies MicrosoftFailure;
  const entry = {token: result.data.access_token, expiresAt: expiry(result.data.expires_in)};
  const rotated = typeof result.data.refresh_token === "string" && result.data.refresh_token && result.data.refresh_token !== refreshToken ? result.data.refresh_token : null;
  if (rotated) { await onRotated(rotated); accessCache.set(cacheKey(connectionId, rotated), entry); }
  accessCache.set(key, entry);
  return {ok: true as const, token: entry.token};
}

// --- Microsoft Graph --------------------------------------------------------------------------
const graph = <T>(token: string, path: string, init: {method?: "GET" | "POST" | "PATCH" | "DELETE"; json?: unknown; timeoutMs?: number} = {}) =>
  call<T>(`${microsoftEndpoints().graph}/v1.0/me/${path}`, {method: init.method ?? "GET", body: init.json === undefined ? undefined : JSON.stringify(init.json),
    headers: {Authorization: `Bearer ${token}`, ...IMMUTABLE, ...(init.json === undefined ? {} : {"Content-Type": "application/json"})}}, init.timeoutMs);
const id = (value: string) => encodeURIComponent(value);

/** The mailbox the grant really belongs to (its primary address, or the sign-in name of a personal account). */
export async function microsoftProfile(token: string) {
  const result = await call<{mail?: unknown; userPrincipalName?: unknown}>(`${microsoftEndpoints().graph}/v1.0/me?$select=mail,userPrincipalName`, {method: "GET", headers: {Authorization: `Bearer ${token}`}});
  if (!result.ok) return result;
  const address = normalizeEmailIdentity(typeof result.data.mail === "string" && result.data.mail ? result.data.mail : typeof result.data.userPrincipalName === "string" ? result.data.userPrincipalName : null);
  if (!address) return {ok: false, status: 200, code: "PROFILE", message: "Microsoft returned no mailbox address for this account."} satisfies MicrosoftFailure;
  return {ok: true as const, address};
}

const HEADER_FIELDS = "id,conversationId,receivedDateTime,subject,from,toRecipients,internetMessageId,internetMessageHeaders,isDraft,hasAttachments";

/** Inbox messages received at or after `since`, oldest first. */
export const outlookInboxPage = (token: string, since: string, top: number) =>
  graph<{value?: Array<{id?: string; receivedDateTime?: string}>}>(token, `mailFolders/inbox/messages?${new URLSearchParams({"$filter": `receivedDateTime ge ${since}`, "$orderby": "receivedDateTime asc", "$top": String(top), "$select": "id,receivedDateTime"})}`);
export const outlookMessageHeaders = (token: string, messageId: string) => graph<OutlookMessage>(token, `messages/${id(messageId)}?$select=${HEADER_FIELDS}`);
export const outlookMessage = (token: string, messageId: string) => graph<OutlookMessage>(token, `messages/${id(messageId)}?$select=${HEADER_FIELDS},body,uniqueBody`);
export const outlookAttachments = (token: string, messageId: string) => graph<{value?: OutlookAttachment[]}>(token, `messages/${id(messageId)}/attachments?$select=id,name,contentType,size,isInline`);
export const outlookAttachment = (token: string, messageId: string, attachmentId: string) => graph<OutlookAttachment>(token, `messages/${id(messageId)}/attachments/${id(attachmentId)}`);

/**
 * Replies in the customer's thread with Outlook's own reply action, which needs
 * only Mail.Send (preparing and editing a draft would need Mail.ReadWrite, which
 * EstateOS does not ask for). Outlook quotes the original; EstateOS sets exactly
 * one recipient, the customer (never the original's Reply-To, copies or blind
 * copies), and its approved text, escaped. Microsoft answers 202 Accepted with no
 * body and no ID, so the reply is recorded under EstateOS's own reference
 * (`m365-reply:…`); it appears in the mailbox's Sent Items.
 */
export async function outlookReply(token: string, input: {replyToId: string; to: string; text: string; reference: string}) {
  const sent = await graph(token, `messages/${id(input.replyToId)}/reply`, {method: "POST", timeoutMs: SEND_TIMEOUT_MS, json: {
    message: {toRecipients: [{emailAddress: {address: input.to}}], ccRecipients: [], bccRecipients: []},
    comment: outlookReplyComment(input.text),
  }});
  if (!sent.ok) return sent;
  return {ok: true as const, providerMessageId: outlookReplyReference(input.reference)};
}

/** EstateOS's own reference for an Outlook reply (Microsoft returns no message ID). */
export const outlookReplyReference = (reference: string) => `m365-reply:${reference}`.slice(0, 200);

/**
 * After an unanswered reply: whether Sent Items holds it (same conversation as the
 * message replied to, to the customer, sent since the attempt began). Read-only.
 */
export async function outlookFindSentReply(token: string, input: {replyToId: string; to: string; since: string}) {
  const original = await outlookMessageHeaders(token, input.replyToId);
  const conversationId = original.ok ? original.data.conversationId : null;
  if (!conversationId) return null;
  const sent = await graph<{value?: OutlookSentItem[]}>(token, `mailFolders/sentitems/messages?${new URLSearchParams({
    "$filter": `conversationId eq '${conversationId.replace(/'/g, "''")}'`, "$select": "id,sentDateTime,toRecipients", "$top": "25"})}`);
  return sent.ok ? matchOutlookSentReply(sent.data.value ?? [], {since: input.since, to: input.to}) : null;
}
