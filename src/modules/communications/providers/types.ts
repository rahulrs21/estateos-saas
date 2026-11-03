import type { CallDirection, CallStatus } from "../model";

/*
 * The telephony adapter contract (docs/TELEPHONY_PROVIDERS.md#adapter). Every
 * adapter verifies webhook signatures with the provider's own method and turns
 * provider payloads into normalized events; EstateOS decides what they change.
 * Credentials are passed in by the server for each call and never stored here.
 */

export const PROVIDER_TYPES = ["TWILIO", "RETELL", "PBX", "OTHER_APPROVED_PROVIDER"] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export interface ProviderCapabilities {
  /** EstateOS can start an agent's call through the provider (click-to-call). */
  outboundCalls: boolean;
  endCall: boolean;
  statusEvents: boolean;
  inboundEvents: boolean;
  recordingEvents: boolean;
  transcripts: boolean;
  /** An AI voice agent platform (used only by the voice assistant, never for agents' calls). */
  voiceAgent: boolean;
  /** Signed webhooks EstateOS can verify. */
  verifiedWebhooks: boolean;
}

export interface WebhookRequest {
  /** The exact body bytes as received (signatures cover them). */
  rawBody: string;
  contentType: string;
  /** The value of the adapter's signature header, or null when absent. */
  signature: string | null;
  /** The public URL the provider called (from APP_ORIGIN, never the Host header). */
  url: string;
}

export type ProviderEventKind = "CALL_STATUS" | "RECORDING" | "TRANSCRIPT" | "ANALYSIS";

export interface ProviderCallEvent {
  /** Unique per delivery meaning: a repeat of the same key is a duplicate. */
  eventKey: string;
  kind: ProviderEventKind;
  /** The call EstateOS tracks (for a bridged call, the leg EstateOS started). */
  providerCallId: string;
  /** The provider account the event came from, checked against the connection. */
  accountId: string | null;
  direction: CallDirection | null;
  /** AGENT: the leg ringing the agent's phone; CUSTOMER: the customer's leg (or an incoming call). */
  leg: "AGENT" | "CUSTOMER";
  from: string | null;
  to: string | null;
  status: CallStatus | null;
  occurredAt: string | null;
  durationSeconds: number | null;
  /** Provider wording kept for diagnostics (for example a disconnection reason). */
  detail: string | null;
}

export class WebhookPayloadError extends Error {
  constructor(message: string) { super(message); this.name = "WebhookPayloadError"; }
}

export interface OutboundCallRequest {
  /** The company line (caller ID). */
  from: string;
  /** The agent's own phone, rung first. */
  agentNumber: string;
  /** The customer's number on record. */
  customerNumber: string;
  /** Where the provider sends signed status events. */
  statusCallbackUrl: string;
}

export interface TelephonyAdapter {
  type: ProviderType;
  label: string;
  capabilities: ProviderCapabilities;
  /** The request header carrying the signature, lower case. */
  signatureHeader: string | null;
  /** What to store as externalAccountId, for the settings form. */
  accountIdLabel: string;
  accountIdPattern: RegExp | null;
  verifyWebhook(request: WebhookRequest, secret: string): Promise<boolean>;
  /** Throws WebhookPayloadError for a payload that is not a well-formed provider event. */
  parseWebhook(request: WebhookRequest): ProviderCallEvent[];
  /** What the provider expects back from a webhook. */
  webhookResponse(): {body: string; contentType: string};
  /** Checks the credentials with the provider (an external request). */
  verifyCredentials(account: {externalAccountId: string | null}, secret: string): Promise<{ok: boolean; note: string}>;
  initiateCall(account: {externalAccountId: string | null}, secret: string, request: OutboundCallRequest): Promise<{providerCallId: string}>;
  endCall(account: {externalAccountId: string | null}, secret: string, providerCallId: string): Promise<void>;
}

export class ProviderNotSupportedError extends Error {
  constructor(readonly operation: string) { super(`This provider does not support ${operation} in EstateOS.`); this.name = "ProviderNotSupportedError"; }
}
