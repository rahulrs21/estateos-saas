import "server-only";

import { z } from "zod";
import { getAppOrigin } from "@/modules/auth/server/config";
import { isAdministrator, type Context } from "@/modules/communications/server/data";
import { parseInput } from "@/modules/communications/server/validation";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { SIGNUP_PIN } from "../embedded-signup";
import { vaultConfigured } from "../vault";
import { PLATFORM_APP_SECRET } from "./channel-credentials";
import { VERIFY_TOKEN_SUFFIX, checkConnection, createConnection, readInboxSecret, webhookPath } from "./connections";
import { checkBusinessAccount, checkPhoneNumber, exchangeSignupCode, graphVersion, registerPhoneNumber, subscribeAccountWebhooks } from "./whatsapp-cloud";

/*
 * One-click "Connect WhatsApp" with Meta's Embedded Signup (docs/CHANNEL_ADAPTERS.md#embedded-signup). The owner or an
 * administrator signs in to Facebook in Meta's own popup and picks the business number; the popup returns a one-time
 * code (about 30 seconds) and the number's IDs. The server swaps the code for the company's token with EstateOS's
 * app secret, confirms the number belongs to the account, saves the channel with the token encrypted, sends that
 * account's webhooks to the channel's own address, registers the number with the owner's PIN and checks the connection.
 * Sending stays off until an administrator turns it on, as for any channel.
 */

const appId = () => process.env.INBOX_META_APP_ID?.trim() ?? "";
const configId = () => process.env.INBOX_META_EMBEDDED_SIGNUP_CONFIG_ID?.trim() ?? "";

/** What the browser needs to open the popup (all public values), and whether this server can complete a signup. */
export function signupSetup(context: Context) {
  if (!isAdministrator(context)) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only company owners and administrators can connect WhatsApp.");
  const missing = [
    !/^\d{5,30}$/.test(appId()) && "INBOX_META_APP_ID",
    !/^\d{5,30}$/.test(configId()) && "INBOX_META_EMBEDDED_SIGNUP_CONFIG_ID",
    !readInboxSecret(PLATFORM_APP_SECRET) && PLATFORM_APP_SECRET,
    !readInboxSecret(`${PLATFORM_APP_SECRET}${VERIFY_TOKEN_SUFFIX}`) && `${PLATFORM_APP_SECRET}${VERIFY_TOKEN_SUFFIX}`,
    !vaultConfigured() && "INBOX_TOKEN_ENCRYPTION_KEY",
  ].filter((name): name is string => Boolean(name));
  return {enabled: missing.length === 0, appId: missing.length ? null : appId(), configId: missing.length ? null : configId(), graphVersion: graphVersion(),
    // Names only (for EstateOS staff); never values.
    missing};
}

const completeSchema = z.strictObject({
  code: z.string().trim().min(10).max(2048).regex(/^[A-Za-z0-9._#|-]+$/, "Meta's sign-in code is not valid."),
  phoneNumberId: z.string().regex(/^\d{5,30}$/),
  businessAccountId: z.string().regex(/^\d{5,30}$/),
  pin: z.string().regex(SIGNUP_PIN, "Choose a 6-digit PIN."),
  displayName: z.string().trim().min(2).max(80),
});

/** Completes a signup started in the browser. Each step is reported; nothing secret is returned or logged. */
export async function completeSignup(context: Context, body: unknown) {
  const setup = signupSetup(context);
  if (!setup.enabled) throw new WorkspaceError("INBOX_SIGNUP_UNAVAILABLE", 409, "Connect WhatsApp is not set up on this server yet. Ask the EstateOS administrator.");
  const input = parseInput(completeSchema, body);
  const log = (step: string, ok: boolean, code?: string) => console.info(JSON.stringify({event: "inbox.whatsapp_signup", step, ok, code: code ?? null}));

  const exchanged = await exchangeSignupCode(appId(), readInboxSecret(PLATFORM_APP_SECRET)!, input.code);
  log("exchange", exchanged.ok, exchanged.ok ? undefined : exchanged.code);
  if (!exchanged.ok) throw new WorkspaceError("INBOX_SIGNUP_FAILED", 409, `Meta did not accept the sign-in (${exchanged.code}). Please try Connect WhatsApp again; the sign-in is valid for about 30 seconds.`);
  const token = exchanged.token;

  // The number must be one this token reaches, in the account the popup named.
  const phone = await checkPhoneNumber(token, input.phoneNumberId);
  const account = phone.ok ? await checkBusinessAccount(token, input.businessAccountId, input.phoneNumberId) : null;
  log("verify", phone.ok && Boolean(account?.ok), !phone.ok ? phone.code : account && !account.ok ? account.code : undefined);
  if (!phone.ok || !account?.ok) throw new WorkspaceError("INBOX_SIGNUP_FAILED", 409, "Meta did not confirm that number for this account. Please try again and choose the number in the popup.");

  // The channel, with the token encrypted (the same path as pasting a token in Inbox settings).
  const {id} = await createConnection(context, {provider: "WHATSAPP_CLOUD", displayName: input.displayName, externalAccountReference: input.phoneNumberId,
    credentialReference: null, accessTokenReference: null, businessAccountReference: input.businessAccountId, accessToken: token});

  const notes: string[] = [];
  const path = webhookPath("WHATSAPP_CLOUD", id);
  const subscribed = await subscribeAccountWebhooks(token, input.businessAccountId, `${getAppOrigin()}${path}`, readInboxSecret(`${PLATFORM_APP_SECRET}${VERIFY_TOKEN_SUFFIX}`)!);
  log("subscribe", subscribed.ok, subscribed.ok ? undefined : subscribed.code);
  if (!subscribed.ok) notes.push(`Incoming messages are not connected yet: Meta refused the webhook subscription (${subscribed.code}). Try Connect WhatsApp again later.`);

  const registered = await registerPhoneNumber(token, input.phoneNumberId, input.pin);
  log("register", registered.ok, registered.ok ? undefined : registered.code);
  if (!registered.ok) notes.push(`Meta did not register the number (${registered.code}): ${registered.message} If it already has a two-step verification PIN, enter that PIN and connect again.`);

  let verified = false;
  try { verified = (await checkConnection(context, id)).verified; }
  catch (error) { notes.push(error instanceof WorkspaceError ? error.message : "The connection check did not complete; use Check connection in Inbox settings."); }
  return {id, verified, subscribed: subscribed.ok, registered: registered.ok, notes};
}
