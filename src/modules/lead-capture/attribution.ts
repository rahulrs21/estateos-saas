/*
 * Lead source attribution (docs/LEAD_ATTRIBUTION_PLAN.md). Pure functions, no I/O, shared by the server and tests.
 * Every value comes from a URL or a browser and is untrusted: lengths are bounded, control characters removed, URLs
 * kept as host and path only (a query string can carry personal data), and click IDs must look like click IDs.
 */

export const LEAD_CHANNELS = ["MANUAL", "WEBSITE_FORM", "LANDING_PAGE", "META_LEAD_AD", "WHATSAPP_AD", "WHATSAPP", "EMAIL", "PORTAL", "OTHER"] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number];
/** Phase 7E.3: how each channel is named in the CRM. */
export const LEAD_CHANNEL_LABELS: Record<LeadChannel, string> = {
  MANUAL: "Added by hand", WEBSITE_FORM: "Website form", LANDING_PAGE: "Landing page", META_LEAD_AD: "Meta lead ad",
  WHATSAPP_AD: "WhatsApp ad", WHATSAPP: "WhatsApp", EMAIL: "Email", PORTAL: "Property portal", OTHER: "Other",
};
export const LEAD_PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta (Facebook, Instagram)", google: "Google", tiktok: "TikTok", snapchat: "Snapchat", linkedin: "LinkedIn",
  organic: "Organic search", referral: "Another website", direct: "Direct",
};
export type LeadPlatform = "meta" | "google" | "tiktok" | "snapchat" | "linkedin" | "organic" | "referral" | "direct";

/** What a browser sends with an enquiry (all optional, all untrusted). */
export interface AttributionInput {
  utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null; utmContent?: string | null; utmTerm?: string | null;
  gclid?: string | null; fbclid?: string | null; ttclid?: string | null;
  landingPageUrl?: string | null; referrer?: string | null;
}

/** One lead's attribution, as stored in LeadAttribution. */
export interface LeadAttributionRecord {
  channel: LeadChannel;
  platform: LeadPlatform;
  utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; utmContent: string | null; utmTerm: string | null;
  campaignKey: string | null;
  landingHost: string | null; landingPath: string | null; referrerHost: string | null;
  gclid: string | null; fbclid: string | null; ttclid: string | null;
}

export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

/** A click ID from Google (gclid), Meta (fbclid), TikTok (ttclid) or a click-to-WhatsApp ad (ctwa_clid). */
export function cleanClickId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9._~-]{4,256}$/.test(value.trim()) ? value.trim() : null;
}

/** The host and path of an http(s) URL: never its query, fragment or credentials. */
export function urlParts(value: unknown): {host: string | null; path: string | null} {
  if (typeof value !== "string" || !value.trim()) return {host: null, path: null};
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return {host: null, path: null};
    return {host: url.hostname.toLowerCase().slice(0, 253) || null, path: (url.pathname || "/").slice(0, 500)};
  } catch {
    return {host: null, path: null};
  }
}

/** The key campaigns are grouped by: "Marina_Launch", "marina-launch" and "Marina Launch" are one campaign. */
export function campaignKey(value: unknown): string | null {
  const text = cleanText(value, 200);
  if (!text) return null;
  const key = text.toLowerCase().replace(/[_+-]+/g, " ").replace(/\s+/g, " ").trim();
  return key || null;
}

const SEARCH_ENGINES = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia)\.[a-z.]+$/;
const SOCIAL = [
  ["meta", /(^|\.)(facebook|instagram|fb|messenger)\.com$|^l\.facebook\.com$|^lm\.facebook\.com$/],
  ["tiktok", /(^|\.)tiktok\.com$/],
  ["snapchat", /(^|\.)snapchat\.com$/],
  ["linkedin", /(^|\.)(linkedin\.com|lnkd\.in)$/],
] as const;

/**
 * Which ad platform (or none) brought the visitor: a click ID is the strongest sign, then utm_source, then the
 * referring site. A search engine without a click ID is organic search; another site is a referral; nothing is direct.
 */
export function inferPlatform(input: {utmSource?: string | null; gclid?: string | null; fbclid?: string | null; ttclid?: string | null; referrerHost?: string | null}): LeadPlatform {
  if (input.gclid) return "google";
  if (input.fbclid) return "meta";
  if (input.ttclid) return "tiktok";
  const source = (input.utmSource ?? "").toLowerCase();
  if (source) {
    if (/facebook|instagram|^fb$|^ig$|^meta$|messenger|whatsapp/.test(source)) return "meta";
    if (/google|adwords|^gads$|youtube/.test(source)) return "google";
    if (/tiktok/.test(source)) return "tiktok";
    if (/snap/.test(source)) return "snapchat";
    if (/linkedin/.test(source)) return "linkedin";
  }
  const host = (input.referrerHost ?? "").toLowerCase();
  if (host) {
    for (const [platform, pattern] of SOCIAL) if (pattern.test(host)) return platform;
    if (SEARCH_ENGINES.test(host)) return "organic";
    return "referral";
  }
  return source ? "referral" : "direct";
}

/** A website form or landing page enquiry's attribution, from what the browser sent (already cleaned or not). */
export function websiteAttribution(channel: "WEBSITE_FORM" | "LANDING_PAGE", input: AttributionInput, landingPageUrl?: string | null): LeadAttributionRecord {
  const utm = (value: unknown) => cleanText(value, 200);
  const landing = urlParts(landingPageUrl ?? input.landingPageUrl);
  const referrerHost = urlParts(input.referrer).host;
  const record = {
    utmSource: utm(input.utmSource), utmMedium: utm(input.utmMedium), utmCampaign: utm(input.utmCampaign), utmContent: utm(input.utmContent), utmTerm: utm(input.utmTerm),
    gclid: cleanClickId(input.gclid), fbclid: cleanClickId(input.fbclid), ttclid: cleanClickId(input.ttclid),
    landingHost: landing.host, landingPath: landing.path,
    // The agency's own site referring to its own form is not a source.
    referrerHost: referrerHost && referrerHost !== landing.host ? referrerHost : null,
  };
  return {channel, platform: inferPlatform(record), campaignKey: campaignKey(record.utmCampaign), ...record};
}

/** A Meta lead ad's campaign key: its campaign name, or its ID when Meta gave no name. */
export function metaCampaignKey(name: string | null | undefined, id: string | null | undefined) {
  return campaignKey(name) ?? (id ? `meta campaign ${id}` : null);
}

/**
 * Phase 7E.3: the name a campaign is shown with: Meta's campaign name, the UTM campaign (or the campaign typed on a
 * lead added by hand), the ad's name, then the grouping key itself.
 */
export function campaignLabel(row: {campaignKey?: string | null; metaCampaignName?: string | null; utmCampaign?: string | null; metaAdName?: string | null}) {
  return row.metaCampaignName || row.utmCampaign || row.metaAdName || row.campaignKey || null;
}

/** Phase 7E.3: one option per campaign key (rows newest first, so each takes its newest name), at most `limit`. */
export function campaignOptions(rows: Array<{campaignKey?: string | null; metaCampaignName?: string | null; utmCampaign?: string | null; metaAdName?: string | null}>, limit = 100) {
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (!row.campaignKey || seen.has(row.campaignKey)) continue;
    seen.set(row.campaignKey, campaignLabel(row) ?? row.campaignKey);
    if (seen.size >= limit) break;
  }
  return [...seen].map(([key, label]) => ({key, label})).sort((x, y) => x.label.localeCompare(y.label, "en"));
}
