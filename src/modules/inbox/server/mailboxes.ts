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
import { authorizationUrl, exchangeCode, forgetAccessTokens, GMAIL_SCOPES, gmailProfile, googleConfigured, rememberAccessToken, revokeGrant } from "./google";

/*
 * Mailboxes connected through OAuth (docs/EMAIL_INTEGRATION_PLAN.md#connecting).
 * Company mailboxes are connected by an OWNER or ADMIN; any member may connect
 * their own personal mailbox (one each). EstateOS never asks for a password:
 * the member signs in on Google's consent screen, and the address Google proves
 * is the one stored. The refresh token is sealed with the server key and bound
 * to its company and connection; nothing about it ever reaches a browser.
 */

const ADMIN_ONLY = "Only company owners and administrators can connect company mailboxes.";
const STATE_COOKIE_PATH = "/api/inbox/oauth";
const stateCookieName = () => process.env.NODE_ENV === "production" ? "__Secure-estateos_inbox_oauth" : "estateos_inbox_oauth";
const GRANT = (organizationId: string, connectionId: string) => ({purpose: "mailbox-grant", organizationId, recordId: connectionId});

/** Phase 7C.1 test mode: the addresses email may be sent to (comma separated). Empty means no email is sent. */
export function emailTestRecipients(): string[] {
  return (process.env.INBOX_EMAIL_TEST_RECIPIENTS ?? "").split(",").map(item => normalizeEmailIdentity(item.trim())).filter((item): item is string => Boolean(item)).slice(0, 20);
}
export const emailSendingConfigured = () => emailTestRecipients().length > 0;
export const emailRecipientAllowed = (address: string) => emailTestRecipients().includes(address.toLowerCase());

export function mailboxSetup() {
  return {googleConfigured: googleConfigured(), vaultConfigured: vaultConfigured(), sendingConfigured: emailSendingConfigured(), testRecipients: emailTestRecipients().length};
}

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
  provider: z.literal("GMAIL").default("GMAIL"),
  kind: z.enum(["COMPANY", "PERSONAL"]),
  displayName: z.string().trim().min(2).max(80),
  connectionId: idSchema.nullable().default(null),
});

async function mailboxForAction(context: Context, id: string) {
  const data = await asServer("MailboxForAction", dc => sdk.mailboxForAction(dc, {organizationId: context.organizationId, id, actorUid: uid(context)}));
  if (!data.mailbox) throw new WorkspaceError("NOT_FOUND", 404, "This mailbox was not found.");
  return data.mailbox;
}

/** Starts Google's consent flow: returns the consent URL and sets the sealed, short-lived state cookie. */
export async function startMailboxConnect(context: Context, body: unknown) {
  const input = parseInput(startSchema, body);
  if (!googleConfigured()) throw new WorkspaceError("INBOX_MAILBOX_NOT_CONFIGURED", 409, "Google sign-in is not set up on this server. An administrator must add INBOX_GOOGLE_CLIENT_ID and INBOX_GOOGLE_CLIENT_SECRET to the server environment.");
  if (!vaultConfigured()) throw new WorkspaceError("INBOX_MAILBOX_NOT_CONFIGURED", 409, "This server has no encryption key for mailbox sign-ins (INBOX_TOKEN_ENCRYPTION_KEY), so nothing can be stored safely yet.");
  const personal = input.kind === "PERSONAL";
  if (!personal && !isAdministrator(context)) throw new WorkspaceError("PERMISSION_DENIED", 403, ADMIN_ONLY);
  let loginHint: string | null = null;
  if (input.connectionId) {
    const mailbox = await mailboxForAction(context, input.connectionId);
    const own = mailbox.ownerMembership?.userProfileUid === uid(context);
    if (Boolean(mailbox.ownerMembershipId) !== personal || (personal ? !own : !isAdministrator(context))) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only this mailbox's owner can reconnect it.");
    loginHint = mailbox.externalAccountReference ?? null;
  } else if (personal) {
    const data = await overview(context);
    if (data.mailboxes.some(row => row.ownerMembership?.userProfileUid === uid(context) && row.connectionStatus !== "DISABLED")) {
      throw new WorkspaceError("CONFLICT", 409, "You already have a connected mailbox. Disconnect it first, or reconnect it.");
    }
  }
  const state = newOAuthState({uid: uid(context), organizationId: canonicalUuid(context.organizationId), provider: "GMAIL", personal, displayName: input.displayName, connectionId: input.connectionId});
  (await cookies()).set(stateCookieName(), sealOAuthState(state), {httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: STATE_COOKIE_PATH, maxAge: 600});
  return {authorizationUrl: authorizationUrl({state: state.state, verifier: state.verifier, loginHint})};
}

export type ConnectOutcome = {ok: true; address: string; personal: boolean} | {ok: false; code: string; message: string};
const refused = (code: string, message: string): ConnectOutcome => ({ok: false, code, message});

/**
 * Google's return. The session cookie is SameSite=strict and is not sent here,
 * so the member and company come only from the sealed state, which must match
 * the returned `state`; the membership is checked again before anything is saved.
 */
export async function completeMailboxConnect(url: URL): Promise<ConnectOutcome> {
  const store = await cookies();
  const sealedState = store.get(stateCookieName())?.value ?? null;
  // Single use: the state is removed whatever happens next.
  store.set(stateCookieName(), "", {httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: STATE_COOKIE_PATH, maxAge: 0});
  const checked = openOAuthState(sealedState, url.searchParams.get("state"));
  if (!checked.ok) return refused(`STATE_${checked.reason}`, checked.reason === "EXPIRED" ? "The sign-in took too long. Start connecting the mailbox again." : "This sign-in could not be confirmed. Start connecting the mailbox again from Inbox settings.");
  const state: OAuthState = checked.state;
  const providerError = url.searchParams.get("error");
  if (providerError) return refused("CANCELLED", providerError === "access_denied" ? "Google sign-in was cancelled, so nothing was connected." : "Google did not complete the sign-in.");
  const code = url.searchParams.get("code");
  if (!code || code.length > 2000) return refused("NO_CODE", "Google did not complete the sign-in.");

  const actor = (await asServer("MailboxActor", dc => sdk.mailboxActor(dc, {organizationId: state.organizationId, actorUid: state.uid}))).actor;
  if (!actor || (!state.personal && actor.role !== "OWNER" && actor.role !== "ADMIN")) return refused("NOT_ALLOWED", "Your membership no longer allows connecting this mailbox.");

  const tokens = await exchangeCode(code, state.verifier);
  if (!tokens.ok) return refused(`GOOGLE_${tokens.code}`, tokens.code === "SCOPES_MISSING" || tokens.code === "NO_REFRESH_TOKEN" ? tokens.message : `Google refused the sign-in (${tokens.code}).`);
  const profile = await gmailProfile(tokens.accessToken);
  if (!profile.ok) { await revokeGrant(tokens.refreshToken); return refused(`GOOGLE_${profile.code}`, "Google did not confirm the mailbox address."); }

  const conflicts = await asServer("MailboxConflicts", dc => sdk.mailboxConflicts(dc, {provider: sdk.ChannelProvider.GMAIL, mailbox: profile.address, organizationId: state.organizationId, actorUid: state.uid}));
  const sameAddress = conflicts.sameAddress.map(row => ({...row, id: canonicalUuid(row.id), organizationId: canonicalUuid(row.organizationId)}));
  const elsewhere = sameAddress.find(row => row.organizationId !== state.organizationId);
  const here = sameAddress.find(row => row.organizationId === state.organizationId) ?? null;
  const refuse = async (reason: string, message: string) => { await revokeGrant(tokens.refreshToken); return refused(reason, message); };
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
  // Reconnecting keeps the old history cursor, so mail that arrived meanwhile is still imported.
  let historyId = profile.historyId;
  if (here) {
    const existing = await asServer("MailboxForAction", dc => sdk.mailboxForAction(dc, {organizationId: state.organizationId, id: connectionId, actorUid: state.uid}));
    if (existing.mailbox?.account?.historyId && existing.mailbox.account.syncState !== "DISCONNECTED") historyId = existing.mailbox.account.historyId;
  }
  let sealed: {ciphertext: string; keyId: string};
  try { sealed = sealSecret(tokens.refreshToken, GRANT(state.organizationId, connectionId)); }
  catch (error) { return refuse("NO_KEY", error instanceof TokenVaultError ? error.message : "The sign-in could not be stored safely."); }
  try {
    await asServer("SaveMailboxConnection", dc => sdk.saveMailboxConnection(dc, {
      organizationId: state.organizationId, id: connectionId, actorUid: state.uid, provider: sdk.ChannelProvider.GMAIL, personal: state.personal, ownerMembershipId: state.personal ? canonicalUuid(actor.id) : null,
      existing: Boolean(here), displayName: state.displayName, mailbox: profile.address, tokenCiphertext: sealed.ciphertext, tokenKeyId: sealed.keyId, scopes: tokens.scopes.filter(scope => (GMAIL_SCOPES as readonly string[]).includes(scope)).join(" "), historyId,
    }));
  } catch (error) {
    await revokeGrant(tokens.refreshToken);
    if (error instanceof WorkspaceError && error.code === "CONFLICT") return refused("ADDRESS_TAKEN", "This mailbox is already connected to EstateOS.");
    throw error;
  }
  forgetAccessTokens(connectionId);
  rememberAccessToken(connectionId, tokens.refreshToken, tokens.accessToken, tokens.expiresAt);
  console.info(JSON.stringify({event: "inbox.mailbox.connected", connectionId, personal: state.personal, reconnected: Boolean(here)}));
  return {ok: true, address: profile.address, personal: state.personal};
}

/** The decrypted refresh token of a mailbox (server only), or null when it cannot be read. */
export function mailboxGrant(organizationId: string, connectionId: string, account: {tokenCiphertext?: string | null; tokenKeyId?: string | null} | null | undefined) {
  if (!account?.tokenCiphertext) return null;
  try { return openSecret(account.tokenCiphertext, account.tokenKeyId, GRANT(canonicalUuid(organizationId), canonicalUuid(connectionId))); } catch { return null; }
}

const revisionSchema = z.strictObject({expectedRevision: z.number().int().min(1)});

/** Disconnects: the owner of a personal mailbox, or an OWNER or ADMIN. Revokes at Google, then wipes the stored grant. */
export async function disconnectMailbox(context: Context, rawId: string, body: unknown) {
  const id = parseInput(idSchema, rawId);
  const {expectedRevision} = parseInput(revisionSchema, body);
  const mailbox = await mailboxForAction(context, id);
  const own = mailbox.ownerMembership?.userProfileUid === uid(context);
  if (!(own || isAdministrator(context)) || (!mailbox.ownerMembershipId && !isAdministrator(context))) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only the mailbox's owner or a company administrator can disconnect it.");
  const grant = mailboxGrant(context.organizationId, id, mailbox.account);
  const revoked = grant ? await revokeGrant(grant) : true;
  await asServer("DisconnectMailbox", dc => sdk.disconnectMailbox(dc, {organizationId: context.organizationId, id, actorUid: uid(context), expectedRevision}));
  forgetAccessTokens(id);
  return {id, disconnected: true, revoked};
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
  if (enabled && !emailSendingConfigured()) throw new WorkspaceError("INBOX_SENDING_DISABLED", 409, "Email sending is off on this server. In Phase 7C.1 it needs INBOX_EMAIL_TEST_RECIPIENTS (your own test addresses) in the server environment.");
  await asServer("SetMailboxSending", dc => sdk.setMailboxSending(dc, {organizationId: context.organizationId, id, actorUid: uid(context), expectedRevision, enabled}));
  return {id, sendingEnabled: enabled};
}
