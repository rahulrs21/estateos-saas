/*
 * Meta's Embedded Signup popup (the one-click "Connect WhatsApp"; docs/CHANNEL_ADAPTERS.md#embedded-signup) reports the
 * customer's choices to the opening page with window messages. Pure helpers, shared by the browser and the tests.
 */

export const SIGNUP_EVENT_TYPE = "WA_EMBEDDED_SIGNUP";
export const SIGNUP_PIN = /^\d{6}$/;
const DIGITS = /^\d{5,30}$/;

export type SignupMessage =
  | {kind: "finish"; phoneNumberId: string; businessAccountId: string}
  /** A WhatsApp Business app number (coexistence): not supported, it turns off features on the phone. */
  | {kind: "business_app"}
  /** Finished without choosing a phone number. */
  | {kind: "no_number"}
  | {kind: "cancel"; step: string | null}
  | {kind: "error"; message: string; code: string | null};

/** Only Meta's own pages over https (facebook.com or a subdomain); "evilfacebook.com" is not Meta. */
export function fromMeta(origin: string) {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && (url.hostname === "facebook.com" || url.hostname.endsWith(".facebook.com"));
  } catch { return false; }
}

const text = (value: unknown, max = 200) => typeof value === "string" ? value.slice(0, max) : null;

/** The signup result in a window message, or null when the message is not one (another origin, type or shape). */
export function parseSignupMessage(origin: string, raw: unknown): SignupMessage | null {
  if (!fromMeta(origin)) return null;
  let message: unknown = raw;
  if (typeof raw === "string") { try { message = JSON.parse(raw); } catch { return null; } }
  const value = message as {type?: unknown; event?: unknown; data?: Record<string, unknown>} | null;
  if (!value || value.type !== SIGNUP_EVENT_TYPE || typeof value.event !== "string") return null;
  const data = value.data ?? {};
  switch (value.event) {
    case "FINISH": {
      const phoneNumberId = text(data.phone_number_id, 40) ?? "";
      // v4 sends waba_id; v5 sends messaging_account_ids instead.
      const accounts = Array.isArray(data.messaging_account_ids) ? data.messaging_account_ids : [];
      const businessAccountId = text(data.waba_id, 40) ?? text(accounts[0], 40) ?? "";
      return DIGITS.test(phoneNumberId) && DIGITS.test(businessAccountId) ? {kind: "finish", phoneNumberId, businessAccountId} : {kind: "no_number"};
    }
    case "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING": return {kind: "business_app"};
    case "FINISH_ONLY_WABA": case "FINISH_GRANT_ONLY_API_ACCESS": return {kind: "no_number"};
    case "CANCEL": return {kind: "cancel", step: text(data.current_step, 80)};
    case "ERROR": return {kind: "error", message: text(data.error_message) ?? "Meta reported an error.", code: text(data.error_code, 20)};
    default: return null;
  }
}
