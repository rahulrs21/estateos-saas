import { cleanText, metaCampaignKey } from "../lead-capture/attribution";

/*
 * Phase 7F.2: Meta ad insights to campaign spend (docs/CAMPAIGNS_PLAN.md#2-spend). Pure. Meta reports each ad's spend
 * per day in the ad account's currency and time zone; EstateOS keeps one row per campaign and day. Everything from
 * Meta is untrusted: IDs must be digits, names are bounded text, amounts are validated.
 */

export const FIRST_SYNC_DAYS = 90;
/** Later syncs re-read the last few days, which Meta still revises. */
export const RESYNC_DAYS = 3;
export const SYNC_EVERY_MS = 6 * 3_600_000;

export interface InsightRow { campaignId: string; campaignName: string | null; adsetId: string | null; adId: string | null; day: string; spendMinor: number; impressions: number | null; clicks: number | null }

const digits = (value: unknown) => typeof value === "string" && /^\d{1,40}$/.test(value) ? value : null;
const day = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ? value : null;
const whole = (value: unknown) => {
  const text = typeof value === "number" ? String(value) : value;
  return typeof text === "string" && /^\d{1,15}$/.test(text) ? Number(text) : null;
};

/** "123.45" (major units, as Meta sends it) → 12345; null when it is not a plain non-negative amount. */
export function spendToMinor(value: unknown): number | null {
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string" || !/^\d{1,13}(\.\d{1,6})?$/.test(text)) return null;
  const minor = Math.round(Number(text) * 100);
  return Number.isSafeInteger(minor) ? minor : null;
}

/** One page of Meta's ad-level daily insights to validated rows (rows that do not validate are left out). */
export function parseInsights(raw: unknown): InsightRow[] {
  const data = raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data) ? (raw as { data: unknown[] }).data : [];
  return data.slice(0, 5000).flatMap((item): InsightRow[] => {
    const row = (item ?? {}) as Record<string, unknown>;
    const campaignId = digits(row.campaign_id), date = day(row.date_start), spendMinor = spendToMinor(row.spend ?? "0");
    if (!campaignId || !date || spendMinor === null) return [];
    return [{ campaignId, campaignName: cleanText(row.campaign_name, 300), adsetId: digits(row.adset_id), adId: digits(row.ad_id), day: date, spendMinor, impressions: whole(row.impressions), clicks: whole(row.clicks) }];
  });
}

/** The next page's cursor, when Meta says there is one. */
export function nextCursor(raw: unknown): string | null {
  const paging = raw && typeof raw === "object" ? (raw as { paging?: { cursors?: { after?: unknown }; next?: unknown } }).paging : undefined;
  const after = paging?.cursors?.after;
  return paging?.next && typeof after === "string" && /^[A-Za-z0-9_=-]{1,512}$/.test(after) ? after : null;
}

export interface CampaignDay { campaignId: string; day: string; spendMinor: number; impressions: number | null; clicks: number | null }

/** Ads' rows added up per campaign and day. */
export function campaignDays(rows: InsightRow[]): CampaignDay[] {
  const days = new Map<string, CampaignDay>();
  const add = (a: number | null, b: number | null) => a === null && b === null ? null : (a ?? 0) + (b ?? 0);
  for (const row of rows) {
    const key = `${row.campaignId}|${row.day}`;
    const current = days.get(key);
    days.set(key, current ? { ...current, spendMinor: current.spendMinor + row.spendMinor, impressions: add(current.impressions, row.impressions), clicks: add(current.clicks, row.clicks) }
      : { campaignId: row.campaignId, day: row.day, spendMinor: row.spendMinor, impressions: row.impressions, clicks: row.clicks });
  }
  return [...days.values()].sort((a, b) => a.campaignId.localeCompare(b.campaignId) || a.day.localeCompare(b.day));
}

/** Each Meta campaign once, by its newest name, with the key its leads are grouped by (the same rule as lead capture). */
export function metaCampaigns(rows: InsightRow[]) {
  const campaigns = new Map<string, { campaignId: string; name: string | null; day: string }>();
  for (const row of rows) {
    const current = campaigns.get(row.campaignId);
    if (!current || (row.campaignName && row.day >= current.day)) campaigns.set(row.campaignId, { campaignId: row.campaignId, name: row.campaignName ?? current?.name ?? null, day: row.day });
  }
  return [...campaigns.values()].map(item => ({ campaignId: item.campaignId, name: item.name, key: metaCampaignKey(item.name, item.campaignId)! }));
}

/** Which campaign each ad belongs to (for WhatsApp ad leads, which arrive with the ad only). */
export function adCampaigns(rows: InsightRow[]) {
  const names = new Map(metaCampaigns(rows).map(item => [item.campaignId, item]));
  const ads = new Map<string, { adId: string; adsetId: string | null; campaignId: string; name: string | null; key: string }>();
  for (const row of rows) {
    if (!row.adId || ads.has(row.adId)) continue;
    const campaign = names.get(row.campaignId)!;
    ads.set(row.adId, { adId: row.adId, adsetId: row.adsetId, campaignId: row.campaignId, name: campaign.name, key: campaign.key });
  }
  return [...ads.values()];
}

/** Today in the ad account's time zone (Meta's days are the account's days). */
export function accountToday(timeZone: string | null, now = new Date()) {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
  catch { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
}

/** The days a sync reads: the last 90 on the first sync, then the last 3, ending today. */
export function syncWindow(today: string, firstSyncDone: boolean) {
  const back = (firstSyncDone ? RESYNC_DAYS : FIRST_SYNC_DAYS) - 1;
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - back * 86_400_000).toISOString().slice(0, 10);
  return { since, until: today };
}
