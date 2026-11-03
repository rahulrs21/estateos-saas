import { retellAdapter } from "./retell";
import { twilioAdapter } from "./twilio";
import { ProviderNotSupportedError, WebhookPayloadError, type ProviderType, type TelephonyAdapter } from "./types";

/*
 * Adapter registry (docs/TELEPHONY_PROVIDERS.md). PBX and other providers are
 * placeholders until a specific UAE telecom or PBX is approved and its API and
 * webhook contract are verified: they accept no webhooks and place no calls.
 */

function unavailable(type: ProviderType, label: string): TelephonyAdapter {
  return {
    type, label,
    capabilities: {outboundCalls: false, endCall: false, statusEvents: false, inboundEvents: false, recordingEvents: false, transcripts: false, voiceAgent: false, verifiedWebhooks: false},
    signatureHeader: null, accountIdLabel: "Provider account reference", accountIdPattern: null,
    async verifyWebhook() { return false; },
    parseWebhook() { throw new WebhookPayloadError("This provider has no verified webhook contract."); },
    webhookResponse() { return {body: "", contentType: "text/plain"}; },
    async verifyCredentials() { return {ok: false, note: "EstateOS has no verified integration for this provider yet."}; },
    async initiateCall() { throw new ProviderNotSupportedError("starting calls"); },
    async endCall() { throw new ProviderNotSupportedError("ending calls"); },
  };
}

export const ADAPTERS: Record<ProviderType, TelephonyAdapter> = {
  TWILIO: twilioAdapter,
  RETELL: retellAdapter,
  PBX: unavailable("PBX", "UAE telecom or PBX (not available yet)"),
  OTHER_APPROVED_PROVIDER: unavailable("OTHER_APPROVED_PROVIDER", "Other approved provider (not available yet)"),
};

export const adapterFor = (type: ProviderType) => ADAPTERS[type];

/** Secret names EstateOS will read: COMMS_ followed by upper-case letters, digits and underscores. */
export const SECRET_REF = /^COMMS_[A-Z0-9_]{3,60}$/;

/** The webhook path for a connection (the public origin comes from APP_ORIGIN). */
export const webhookPath = (type: ProviderType, connectionId: string) => `/api/communications/webhooks/${type.toLowerCase()}/${connectionId}`;
