import { campaignKey, cleanClickId, cleanText, urlParts } from "../lead-capture/attribution";

/*
 * Phase 7E.2: click-to-WhatsApp ads (docs/LEAD_ATTRIBUTION_PLAN.md#2-capture-on-every-path).
 * When a customer taps a Facebook or Instagram ad that opens WhatsApp, Meta adds a `referral`
 * object to their first message: the ad (or post) ID, its headline and text, the ad's link and
 * the click ID (ctwa_clid). Everything in it is untrusted text: bounded, control characters
 * removed, and only the host and path of the link are kept.
 */

export interface AdReferral {
  /** The ad or post ID (digits only). */
  sourceId: string | null;
  /** "ad" or "post". */
  sourceType: "ad" | "post" | null;
  headline: string | null;
  body: string | null;
  sourceHost: string | null;
  sourcePath: string | null;
  ctwaClid: string | null;
  /** How the ad is grouped in reports until 7F reads its campaign: its headline, or its ID. */
  campaignKey: string | null;
}

/** A conversation's ad is kept from the first ad message; a newer ad replaces it only after this long. */
export const REFERRAL_REPLACE_AFTER_MS = 30 * 86_400_000;

/** Meta's `referral` object to a bounded AdReferral, or null when it names no ad at all. */
export function parseAdReferral(raw: unknown): AdReferral | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const id = typeof value.source_id === "string" || typeof value.source_id === "number" ? String(value.source_id).trim() : "";
  const sourceId = /^\d{1,40}$/.test(id) ? id : null;
  const type = typeof value.source_type === "string" ? value.source_type.trim().toLowerCase() : "";
  const sourceType = type === "ad" || type === "post" ? type : null;
  const headline = cleanText(value.headline, 300);
  const body = cleanText(value.body, 500);
  const {host: sourceHost, path: sourcePath} = urlParts(value.source_url);
  const ctwaClid = cleanClickId(value.ctwa_clid);
  if (!sourceId && !headline && !sourceHost && !ctwaClid) return null;
  return {sourceId, sourceType, headline, body, sourceHost, sourcePath, ctwaClid, campaignKey: campaignKey(headline) ?? (sourceId ? `meta ad ${sourceId}` : null)};
}

/** Whether a message's ad replaces the conversation's stored one: none yet, or the stored one is old. */
export function replacesReferral(storedAt: string | null | undefined, now: number) {
  if (!storedAt) return true;
  const at = Date.parse(storedAt);
  return !Number.isFinite(at) || now - at >= REFERRAL_REPLACE_AFTER_MS;
}

/** The lead channel a conversation gives a lead created from it, or null when it gives none. */
export function conversationLeadChannel(conversation: {channel: string; adReferredAt?: string | null}) {
  if (conversation.channel === "WHATSAPP") return conversation.adReferredAt ? "WHATSAPP_AD" as const : "WHATSAPP" as const;
  if (conversation.channel === "EMAIL") return "EMAIL" as const;
  return null;
}

/**
 * What linking a conversation to a lead does to the lead's source. Only a lead created after the
 * conversation began (so it came from this conversation) takes the conversation's source:
 * INSERT when it has none yet, REPLACE when it only has the MANUAL source of a lead added by hand
 * without a campaign (Phase 7E.3). Any other source is kept. The database checks the same rule
 * again (LinkInboxConversation).
 */
export function linkSourceAction(conversation: {channel: string; createdAt: string; adReferredAt?: string | null},
  lead: {createdAt: string; source: {channel: string; campaignKey?: string | null} | null}): "INSERT" | "REPLACE" | null {
  if (!conversationLeadChannel(conversation) || Date.parse(lead.createdAt) < Date.parse(conversation.createdAt)) return null;
  if (!lead.source) return "INSERT";
  return lead.source.channel === "MANUAL" && !lead.source.campaignKey ? "REPLACE" : null;
}
