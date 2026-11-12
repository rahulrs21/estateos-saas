import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { asServer, isAdministrator, sdk, type Context } from "@/modules/communications/server/data";
import { idSchema, parseInput } from "@/modules/communications/server/validation";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { normalizeEmailIdentity } from "../identity";
import { newOAuthState, openOAuthState, sealOAuthState, type OAuthState } from "../oauth-state";
import { openSecret, sealSecret, TokenVaultError, vaultConfigured } from "../vault";
import { accessTokenFor, authorizationUrl, exchangeCode, forgetAccessTokens, GMAIL_SCOPES, gmailProfile, googleConfigured, rememberAccessToken, revokeGrant } from "./google";
import { forgetMicrosoftAccessTokens, microsoftAccessTokenFor, microsoftAuthorizationUrl, microsoftConfigured, microsoftExchangeCode, microsoftProfile, rememberMicrosoftAccessToken } from "./microsoft";

/*
 * Mailboxes connected through OAuth (docs/EMAIL_INTEGRATION_PLAN.md#connecting):
 * Gmail (Phase 7C.1) and Microsoft 365 / Outlook (Phase 7C.2). Company mailboxes
 * are connected by an OWNER or ADMIN; any member may connect their own personal
 * mailbox (one each). EstateOS never asks for a password: the member signs in on
 * the provider's own page, and the address the provider proves is the one
 * stored. The refresh token is sealed with the server key and bound to its
 * company and connection; nothing about it ever reaches a browser.
 */

const ADMIN_ONLY = "Only company owners and administrators can connect company mailboxes.";
const STATE_COOKIE_PATH = "/api/inbox/oauth";
const stateCookieName = () => process.env.NODE_ENV === "production" ? "__Secure-estateos_inbox_oauth" : "estateos_inbox_oauth";
const GRANT = (organizationId: string, connectionId: string) => ({purpose: "mailbox-grant", organizationId, recordId: connectionId});

/** Test mode (Phase 7C): the addresses email may be sent to (comma separated). Empty means no email is sent. */
export function emailTestRecipients(): string[] {
  return (process.env.INBOX_EMAIL_TEST_RECIPIENTS ?? "").split(",").map(item => normalizeEmailIdentity(item.trim())).filter((item): item is string => Boolean(item)).slice(0, 20);
}
export const emailSendingConfigured = () => emailTestRecipients().length > 0;
export const emailRecipientAllowed = (address: string) => emailTestRecipients().includes(address.toLowerCase());

export function mailboxSetup() {
  return {googleConfigured: googleConfigured(), microsoftConfigured: microsoftConfigured(), vaultConfigured: vaultConfigured(), sendingConfigured: emailSendingConfigured(), testRecipients: emailTestRecipients().length};
}

export type MailProvider = "GMAIL" | "MICROSOFT_365";
type Failure = {ok: false; status: number; code: string; message: string};
type Exchanged = {ok: true; accessToken: string; refreshToken: string; expiresAt: number; scopes: string[]};

/** What differs between the providers; everything else (state, vault, checks, storage) is shared. */
const PROVIDERS: Record<MailProvider, {
  label: string; codePrefix: string; configured: () => boolean; setupMessage: string;
  authorizationUrl: (input: {state: string; verifier: string; loginHint?: string | null}) => string;
  exchange: (code: string, verifier: string) => Promise<Exchanged | Failure>;
  profile: (token: string) => Promise<{ok: true; address: string; cursor: string} | Failure>;
  /** Withdraws the grant at the provider where it allows that (Microsoft has no per-app revocation). */
  revoke: ((refreshToken: string) => Promise<boolean>) | null;
  remember: (connectionId: string, refreshToken: string, token: string, expiresAt: number) => void;
  profileProblem: (failure: Failure) => string;
}> = {
  GMAIL: {
    label: "Google", codePrefix: "GOOGLE", configured: googleConfigured,
    setupMessage: "Google sign-in is not set up on this server. An administrator must add INBOX_GOOGLE_CLIENT_ID and INBOX_GOOGLE_CLIENT_SECRET to the server environment.",
    authorizationUrl, exchange: exchangeCode,
    profile: async token => { const result = await gmailProfile(token); return result.ok ? {ok: true, address: result.address, cursor: result.historyId} : result; },
    revoke: revokeGrant, remember: rememberAccessToken,
    // The usual cause is a project without the Gmail API turned on (403); say so, with Google's own code.
    profileProblem: failure => failure.status === 403 || /PERMISSION_DENIED|SERVICE_DISABLED|accessNotConfigured/i.test(`${failure.code} ${failure.message}`)
      ? `Google signed you in, but the Gmail API is not enabled for this OAuth client's Google Cloud project (${failure.code}). Enable it (APIs & Services → Library → Gmail API), wait a few minutes, and connect again.`
      : `Google did not confirm the mailbox address (${failure.code}: ${failure.message}).`,
  },
  MICROSOFT_365: {
    label: "Microsoft", codePrefix: "MICROSOFT", configured: microsoftConfigured,
    setupMessage: "Microsoft sign-in is not set up on this server. An administrator must add INBOX_MICROSOFT_CLIENT_ID and INBOX_MICROSOFT_CLIENT_SECRET to the server environment.",
    authorizationUrl: microsoftAuthorizationUrl, exchange: microsoftExchangeCode,
    // The first sync reads the last few days; afterwards the cursor is the newest message read.
    profile: async token => { const result = await microsoftProfile(token); return result.ok ? {ok: true, address: result.address, cursor: new Date().toISOString().replace(/\.\d{3}Z$/, "Z")} : result; },
    revoke: null, remember: rememberMicrosoftAccessToken,
    // Usually an account without an Exchange Online mailbox (for example a work account with no mail licence).
    profileProblem: failure => `Microsoft signed you in, but did not return a mailbox for this account (${failure.code}: ${failure.message}). Use an account with an Outlook or Microsoft 365 mailbox.`,
  },
};
export const providerLabel = (provider: string | null | undefined) => provider === "MICROSOFT_365" ? "Microsoft" : "Google";
const isMailProvider = (provider: string | null | undefined): provider is MailProvider => provider === "GMAIL" || provider === "MICROSOFT_365";

/** Forgets the access tokens held in memory for a mailbox, whichever provider it is. */
export function forgetMailboxAccess(connectionId: string) { forgetAccessTokens(connectionId); forgetMicrosoftAccessTokens(connectionId); }

const uid = (context: Context) => context.request.user.uid;

async function overview(context: Context) {
  return asServer("MailboxesOverview", dc => sdk.mailboxesOverview(dc, {organizationId: context.organizationId, actorUid: uid(context)}));
}

/** What the member may see: administrators every mailbox, others only their own. Never a token. */
export async function listMailboxes(context: Context) {
  const data = await overview(context);
  const admin = isAdministrator(context);
  const mine = (row: (typeof data.mailboxes)[number]) => row.ownerMembership?.userProfileUid === uid(context);
  const view = (row: (typeof data.mailboxes)[number]) => {
    const personal = Boolean(row.ownerMembershipId);
    const own = mine(row);
    return {
      id: canonicalUuid(row.id), provider: row.provider, displayName: row.displayName, address: row.externalAccountReference ?? null, personal,
      owner: personal ? row.ownerMembership?.userProfile?.displayName ?? "A former member" : null, ownerActive: personal ? row.ownerMembership?.status === "ACTIVE" : null, mine: own,
      connectionStatus: row.connectionStatus, sendingEnabled: row.sendingEnabled, revision: row.revision, verifiedAt: row.verifiedAt ?? null, createdAt: row.createdAt,
      syncState: row.account?.syncState ?? null, lastSyncedAt: row.account?.lastSyncedAt ?? null, failures: row.account?.failures ?? 0, lastErrorCode: row.account?.lastErrorCode ?? null,
      // Reconnecting needs the mailbox's own manager: an administrator for a company mailbox, the owner for a personal one.
      can: {
        reconnect: personal ? own : admin,
        disconnect: (personal ? own || admin : admin) && row.connectionStatus !== "DISABLED",
        sendingOn: (personal ? own : admin) && row.connectionStatus === "VERIFIED",
        sendingOff: (own || admin) && row.sendingEnabled,
        check: (own || admin) && row.connectionStatus === "VERIFIED",
      },
    };
  };
  return {
    setup: mailboxSetup(),
    canConnectCompany: admin,
    company: admin ? data.mailboxes.filter(row => !row.ownerMembershipId).map(view) : [],
    personal: data.mailboxes.filter(row => row.ownerMembershipId && (admin || mine(row))).map(view),
  };
}
export type MailboxesView = Awaited<ReturnType<typeof listMailboxes>>;

const startSchema = z.strictObject({
  provider: z.enum(["GMAIL", "MICROSOFT_365"]).default("GMAIL"),
  kind: z.enum(["COMPANY", "PERSONAL"]),
  displayName: z.string().trim().min(2).max(80),
  connectionId: idSchema.nullable().default(null),
});

async function mailboxForAction(context: Context, id: string) {
  const data = await asServer("MailboxForAction", dc => sdk.mailboxForAction(dc, {organizationId: context.organizationId, id, actorUid: uid(context)}));
  if (!data.mailbox) throw new WorkspaceError("NOT_FOUND", 404, "This mailbox was not found.");
  return data.mailbox;
}

/** Starts the provider's consent flow: returns its sign-in URL and sets the sealed, short-lived state cookie. The route decides the provider. */
export async function startMailboxConnect(context: Context, body: unknown, provider: MailProvider = "GMAIL") {
  const input = parseInput(startSchema, {...(typeof body === "object" && body !== null ? body : {}), provider});
  const settings = PROVIDERS[input.provider];
  if (!settings.configured()) throw new WorkspaceError("INBOX_MAILBOX_NOT_CONFIGURED", 409, settings.setupMessage);
  if (!vaultConfigured()) throw new WorkspaceError("INBOX_MAILBOX_NOT_CONFIGURED", 409, "This server has no encryption key for mailbox sign-ins (INBOX_TOKEN_ENCRYPTION_KEY), so nothing can be stored safely yet.");
  const personal = input.kind === "PERSONAL";
  if (!personal && !isAdministrator(context)) throw new WorkspaceError("PERMISSION_DENIED", 403, ADMIN_ONLY);
  let loginHint: string | null = null;
  if (input.connectionId) {
    const mailbox = await mailboxForAction(context, input.connectionId);
    const own = mailbox.ownerMembership?.userProfileUid === uid(context);
    if (Boolean(mailbox.ownerMembershipId) !== personal || (personal ? !own : !isAdministrator(context))) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only this mailbox's owner can reconnect it.");
    if (mailbox.provider !== input.provider) throw new WorkspaceError("VALIDATION_ERROR", 400, `This mailbox is reconnected with ${providerLabel(mailbox.provider)} sign-in.`);
    loginHint = mailbox.externalAccountReference ?? null;
  } else if (personal) {
    const data = await overview(context);
    if (data.mailboxes.some(row => row.ownerMembership?.userProfileUid === uid(context) && row.connectionStatus !== "DISABLED")) {
      throw new WorkspaceError("CONFLICT", 409, "You already have a connected mailbox. Disconnect it first, or reconnect it.");
    }
  }
  const state = newOAuthState({uid: uid(context), organizationId: canonicalUuid(context.organizationId), provider: input.provider, personal, displayName: input.displayName, connectionId: input.connectionId});
  (await cookies()).set(stateCookieName(), sealOAuthState(state), {httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: STATE_COOKIE_PATH, maxAge: 600});
  return {authorizationUrl: settings.authorizationUrl({state: state.state, verifier: state.verifier, loginHint})};
}

export type ConnectOutcome = {ok: true; address: string; personal: boolean} | {ok: false; code: string; message: string};
const refused = (code: string, message: string): ConnectOutcome => ({ok: false, code, message});

/**
 * The provider's return. The session cookie is SameSite=strict and is not sent
 * here, so the member and company come only from the sealed state, which must
 * match the returned `state` and this provider; the membership is checked again
 * before anything is saved.
 */
export async function completeMailboxConnect(url: URL, provider: MailProvider = "GMAIL"): Promise<ConnectOutcome> {
  const store = await cookies();
  const sealedState = store.get(stateCookieName())?.value ?? null;
  // Single use: the state is removed whatever happens next.
  store.set(stateCookieName(), "", {httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: STATE_COOKIE_PATH, maxAge: 0});
  const checked = openOAuthState(sealedState, url.searchParams.get("state"));
  if (!checked.ok) return refused(`STATE_${checked.reason}`, checked.reason === "EXPIRED" ? "The sign-in took too long. Start connecting the mailbox again." : "This sign-in could not be confirmed. Start connecting the mailbox again from Inbox settings.");
  const state: OAuthState = checked.state;
  if (state.provider !== provider) return refused("STATE_MISMATCH", "This sign-in could not be confirmed. Start connecting the mailbox again from Inbox settings.");
  const settings = PROVIDERS[provider], label = settings.label, prefix = settings.codePrefix;
  const providerError = url.searchParams.get("error");
  if (providerError) {
    // Microsoft explains a refusal with an AADSTS number (for example an organisation that requires an administrator's consent).
    const aadsts = /AADSTS\d{4,6}/.exec(url.searchParams.get("error_description") ?? "")?.[0];
    if (providerError === "access_denied" && !aadsts) return refused("CANCELLED", `${label} sign-in was cancelled, so nothing was connected.`);
    const reason = (aadsts ?? providerError).replace(/[^A-Za-z0-9_]/g, "_").slice(0, 40);
    return refused(`${prefix}_${reason}`, `${label} did not complete the sign-in (${aadsts ?? providerError}).`);
  }
  const code = url.searchParams.get("code");
  if (!code || code.length > 4000) return refused("NO_CODE", `${label} did not complete the sign-in.`);

  const actor = (await asServer("MailboxActor", dc => sdk.mailboxActor(dc, {organizationId: state.organizationId, actorUid: state.uid}))).actor;
  if (!actor || (!state.personal && actor.role !== "OWNER" && actor.role !== "ADMIN")) return refused("NOT_ALLOWED", "Your membership no longer allows connecting this mailbox.");

  const tokens = await settings.exchange(code, state.verifier);
  if (!tokens.ok) return refused(`${prefix}_${tokens.code}`, tokens.code === "SCOPES_MISSING" || tokens.code === "NO_REFRESH_TOKEN" ? tokens.message
    : `${label} refused the sign-in (${tokens.code}${tokens.message.startsWith("AADSTS") ? `: ${tokens.message.slice(0, 160)}` : ""}).`);
  const withdraw = async () => { if (settings.revoke) await settings.revoke(tokens.refreshToken).catch(() => false); };
  const profile = await settings.profile(tokens.accessToken);
  if (!profile.ok) { await withdraw(); return refused(`${prefix}_${profile.code}`, settings.profileProblem(profile)); }

  const conflicts = await asServer("MailboxConflicts", dc => sdk.mailboxConflicts(dc, {provider: sdk.ChannelProvider[provider], mailbox: profile.address, organizationId: state.organizationId, actorUid: state.uid}));
  const sameAddress = conflicts.sameAddress.map(row => ({...row, id: canonicalUuid(row.id), organizationId: canonicalUuid(row.organizationId)}));
  const elsewhere = sameAddress.find(row => row.organizationId !== state.organizationId);
  const here = sameAddress.find(row => row.organizationId === state.organizationId) ?? null;
  const refuse = async (reason: string, message: string) => { await withdraw(); return refused(reason, message); };
  if (elsewhere) return refuse("ADDRESS_TAKEN", "This mailbox is already connected to another EstateOS company. A mailbox can belong to one company only.");
  if (state.connectionId && (!here || here.id !== canonicalUuid(state.connectionId))) {
    return refuse("WRONG_MAILBOX", `You signed in to ${profile.address}, which is not the mailbox being reconnected. Sign in to the original mailbox instead.`);
  }
  if (here) {
    const herePersonal = Boolean(here.ownerMembershipId);
    if (herePersonal !== state.personal || (herePersonal && here.ownerMembership?.userProfileUid !== state.uid)) {
      return refuse("ADDRESS_TAKEN", herePersonal ? "This mailbox is already connected as another member's personal mailbox." : "This mailbox is already connected as a company mailbox.");
    }
  }
  if (state.personal && !here && conflicts.mine.some(row => row.connectionStatus !== "DISABLED")) return refuse("ALREADY_CONNECTED", "You already have a connected mailbox. Disconnect it first.");
  if (!state.personal && !here && conflicts.company.length >= 10) return refuse("LIMIT", "This company already has the maximum of 10 company channels.");

  const connectionId = here?.id ?? randomUUID();
  // Reconnecting keeps the old cursor, so mail that arrived meanwhile is still imported.
  let historyId = profile.cursor;
  if (here) {
    const existing = await asServer("MailboxForAction", dc => sdk.mailboxForAction(dc, {organizationId: state.organizationId, id: connectionId, actorUid: state.uid}));
    if (existing.mailbox?.account?.historyId && existing.mailbox.account.syncState !== "DISCONNECTED") historyId = existing.mailbox.account.historyId;
  }
  let sealed: {ciphertext: string; keyId: string};
  try { sealed = sealSecret(tokens.refreshToken, GRANT(state.organizationId, connectionId)); }
  catch (error) { return refuse("NO_KEY", error instanceof TokenVaultError ? error.message : "The sign-in could not be stored safely."); }
  const scopes = (provider === "GMAIL" ? tokens.scopes.filter(scope => (GMAIL_SCOPES as readonly string[]).includes(scope)) : tokens.scopes).join(" ").slice(0, 400);
  try {
    await asServer("SaveMailboxConnection", dc => sdk.saveMailboxConnection(dc, {
      organizationId: state.organizationId, id: connectionId, actorUid: state.uid, provider: sdk.ChannelProvider[provider], personal: state.personal, ownerMembershipId: state.personal ? canonicalUuid(actor.id) : null,
      existing: Boolean(here), displayName: state.displayName, mailbox: profile.address, tokenCiphertext: sealed.ciphertext, tokenKeyId: sealed.keyId, scopes, historyId,
    }));
  } catch (error) {
    await withdraw();
    if (error instanceof WorkspaceError && error.code === "CONFLICT") return refused("ADDRESS_TAKEN", "This mailbox is already connected to EstateOS.");
    throw error;
  }
  forgetMailboxAccess(connectionId);
  settings.remember(connectionId, tokens.refreshToken, tokens.accessToken, tokens.expiresAt);
  console.info(JSON.stringify({event: "inbox.mailbox.connected", connectionId, provider, personal: state.personal, reconnected: Boolean(here)}));
  return {ok: true, address: profile.address, personal: state.personal};
}

/** The decrypted refresh token of a mailbox (server only), or null when it cannot be read. */
export function mailboxGrant(organizationId: string, connectionId: string, account: {tokenCiphertext?: string | null; tokenKeyId?: string | null} | null | undefined) {
  if (!account?.tokenCiphertext) return null;
  try { return openSecret(account.tokenCiphertext, account.tokenKeyId, GRANT(canonicalUuid(organizationId), canonicalUuid(connectionId))); } catch { return null; }
}

/**
 * A valid access token for a mailbox (server only). Microsoft replaces the refresh
 * token as it is used: the new one is sealed and stored, but only over the exact
 * grant that was read, so a mailbox disconnected or reconnected meanwhile is left alone.
 */
export async function mailboxAccessToken(organizationId: string, connectionId: string, provider: string, account: {tokenCiphertext?: string | null; tokenKeyId?: string | null} | null | undefined):
  Promise<{ok: true; token: string} | Failure> {
  const grant = mailboxGrant(organizationId, connectionId, account);
  if (!grant || !isMailProvider(provider)) return {ok: false, status: 401, code: "GRANT_UNREADABLE", message: "The mailbox's sign-in could not be read."};
  if (provider === "GMAIL") return accessTokenFor(connectionId, grant);
  const org = canonicalUuid(organizationId), id = canonicalUuid(connectionId), previous = account!.tokenCiphertext!;
  return microsoftAccessTokenFor(id, grant, async next => {
    const sealed = sealSecret(next, GRANT(org, id));
    await asServer("UpdateMailboxToken", dc => sdk.updateMailboxToken(dc, {organizationId: org, id, previousCiphertext: previous, tokenCiphertext: sealed.ciphertext, tokenKeyId: sealed.keyId}));
  });
}

/** Withdraws a grant at its provider where that is possible; false when it is not (Microsoft) or it failed. */
export async function withdrawGrant(provider: string, refreshToken: string) {
  const revoke = isMailProvider(provider) ? PROVIDERS[provider].revoke : null;
  return revoke ? revoke(refreshToken).catch(() => false) : false;
}

const revisionSchema = z.strictObject({expectedRevision: z.number().int().min(1)});

/**
 * Disconnects: the owner of a personal mailbox, or an OWNER or ADMIN. The grant is
 * revoked at Google; Microsoft has no per-app revocation, so the member is told
 * where to remove EstateOS's access. Either way the stored grant is wiped.
 */
export async function disconnectMailbox(context: Context, rawId: string, body: unknown) {
  const id = parseInput(idSchema, rawId);
  const {expectedRevision} = parseInput(revisionSchema, body);
  const mailbox = await mailboxForAction(context, id);
  const own = mailbox.ownerMembership?.userProfileUid === uid(context);
  if (!(own || isAdministrator(context)) || (!mailbox.ownerMembershipId && !isAdministrator(context))) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only the mailbox's owner or a company administrator can disconnect it.");
  const grant = mailboxGrant(context.organizationId, id, mailbox.account);
  const revocable = mailbox.provider === "GMAIL";
  const revoked = revocable ? (grant ? await withdrawGrant(mailbox.provider, grant) : true) : false;
  await asServer("DisconnectMailbox", dc => sdk.disconnectMailbox(dc, {organizationId: context.organizationId, id, actorUid: uid(context), expectedRevision}));
  forgetMailboxAccess(id);
  return {id, disconnected: true, revoked, provider: mailbox.provider};
}

/** Sending on (test recipients required) or off. On: an administrator for a company mailbox, the owner for a personal one. */
export async function setMailboxSending(context: Context, rawId: string, body: unknown) {
  const id = parseInput(idSchema, rawId);
  const {expectedRevision, enabled} = parseInput(z.strictObject({expectedRevision: z.number().int().min(1), enabled: z.boolean()}), body);
  const mailbox = await mailboxForAction(context, id);
  const own = mailbox.ownerMembership?.userProfileUid === uid(context);
  const manager = mailbox.ownerMembershipId ? own : isAdministrator(context);
  if (enabled && !manager) throw new WorkspaceError("PERMISSION_DENIED", 403, mailbox.ownerMembershipId ? "Only this mailbox's owner can turn sending on: nobody else may send as them." : ADMIN_ONLY);
  if (!enabled && !(own || isAdministrator(context))) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only the mailbox's owner or a company administrator can turn sending off.");
  if (enabled && mailbox.connectionStatus !== "VERIFIED") throw new WorkspaceError("VALIDATION_ERROR", 400, "Reconnect the mailbox first. Only a connected mailbox can send.");
  if (enabled && !emailSendingConfigured()) throw new WorkspaceError("INBOX_SENDING_DISABLED", 409, "Email sending is off on this server. In test mode it needs INBOX_EMAIL_TEST_RECIPIENTS (your own test addresses) in the server environment.");
  await asServer("SetMailboxSending", dc => sdk.setMailboxSending(dc, {organizationId: context.organizationId, id, actorUid: uid(context), expectedRevision, enabled}));
  return {id, sendingEnabled: enabled};
}
