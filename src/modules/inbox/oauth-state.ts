import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { openSecret, sealSecret } from "./vault";

/*
 * The OAuth state for connecting a mailbox (docs/EMAIL_INTEGRATION_PLAN.md#connecting).
 * Kept in an encrypted, httpOnly, short-lived cookie: the session cookie is
 * SameSite=strict and is not sent on the return from Google, so the callback
 * trusts only this sealed state (bound to the member and company that started
 * it) and the `state` parameter that must equal it. The server re-checks the
 * membership before saving anything. PKCE (S256) protects the code exchange.
 */

export const OAUTH_STATE_TTL_SECONDS = 600;
const BINDING = {purpose: "oauth-state", organizationId: "-", recordId: "-"};

export interface OAuthState {
  v: 1;
  state: string;
  verifier: string;
  uid: string;
  organizationId: string;
  provider: "GMAIL" | "MICROSOFT_365";
  personal: boolean;
  displayName: string;
  /** Reconnecting this existing connection (the mailbox address must stay the same). */
  connectionId: string | null;
  expiresAt: number;
}

const token = (bytes: number) => randomBytes(bytes).toString("base64url");

/** A fresh state and PKCE pair. */
export function newOAuthState(input: Omit<OAuthState, "v" | "state" | "verifier" | "expiresAt">, now = Date.now()): OAuthState {
  return {v: 1, state: token(24), verifier: token(48), ...input, expiresAt: now + OAUTH_STATE_TTL_SECONDS * 1000};
}

/** The PKCE S256 challenge of a verifier. */
export const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier, "ascii").digest("base64url");

export const sealOAuthState = (state: OAuthState, key?: Buffer | null) => sealSecret(JSON.stringify(state), BINDING, key).ciphertext;

export type OAuthStateCheck = {ok: true; state: OAuthState} | {ok: false; reason: "MISSING" | "UNREADABLE" | "EXPIRED" | "MISMATCH"};

/** The sealed state, only if intact, unexpired and equal to the `state` the provider returned. */
export function openOAuthState(cookie: string | null | undefined, returnedState: string | null | undefined, now = Date.now(), key?: Buffer | null): OAuthStateCheck {
  if (!cookie || !returnedState) return {ok: false, reason: "MISSING"};
  let state: OAuthState;
  try {
    state = JSON.parse(openSecret(cookie, "k1", BINDING, key)) as OAuthState;
  } catch {
    return {ok: false, reason: "UNREADABLE"};
  }
  if (state?.v !== 1 || typeof state.state !== "string" || typeof state.verifier !== "string" || typeof state.uid !== "string" || typeof state.organizationId !== "string") return {ok: false, reason: "UNREADABLE"};
  if (!(state.expiresAt > now)) return {ok: false, reason: "EXPIRED"};
  const a = Buffer.from(state.state), b = Buffer.from(returnedState);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return {ok: false, reason: "MISMATCH"};
  return {ok: true, state};
}
