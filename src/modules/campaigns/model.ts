import { z } from "zod";

/*
 * Phase 7F.1: campaigns and cost per lead (docs/CAMPAIGNS_PLAN.md). Pure: money, periods, validation and the
 * figures shown on the Marketing page. Amounts are integers in minor units of their own currency (fils for AED)
 * and are never converted between currencies.
 */

export const CAMPAIGN_STATUSES = ["ACTIVE", "PAUSED", "ENDED"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = { ACTIVE: "Active", PAUSED: "Paused", ENDED: "Ended" };
export const CAMPAIGN_PLATFORMS = ["meta", "google", "tiktok", "snapchat", "linkedin", "portal", "other"] as const;
export type CampaignPlatform = (typeof CAMPAIGN_PLATFORMS)[number];
export const CAMPAIGN_PLATFORM_LABELS: Record<CampaignPlatform, string> = {
  meta: "Meta (Facebook, Instagram)", google: "Google", tiktok: "TikTok", snapchat: "Snapchat", linkedin: "LinkedIn", portal: "Property portal", other: "Other",
};
/** The largest amount accepted: 10 billion in major units. */
export const MAX_MINOR = 1_000_000_000_000;
/** The longest period one spend entry may cover. */
export const MAX_SPEND_DAYS = 366;

// --- Money ------------------------------------------------------------------------------------------------------

/** "1,250.5" → 125050 (minor units, two decimals); null when it is not a non-negative amount with at most 2 decimals. */
export function parseMoney(value: unknown): number | null {
  if (typeof value === "number") value = String(value);
  if (typeof value !== "string") return null;
  const text = value.replace(/[,\s]/g, "");
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor <= MAX_MINOR ? minor : null;
}

/** 125050, "AED" → "AED 1,250.50"; whole amounts drop the decimals ("AED 1,250"). */
export function formatMoney(minor: number, currency: string, options: { decimals?: boolean } = {}) {
  const whole = minor % 100 === 0 && options.decimals !== true;
  return `${currency} ${(minor / 100).toLocaleString("en-GB", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
}

/** Minor units as an amount for an input field: 125050 → "1250.50", 125000 → "1250". */
export function moneyInput(minor: number) {
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}

/** Cost per lead (or per qualified or won lead) in minor units, rounded; null when there is nothing to divide by. */
export function costPer(spendMinor: number, count: number) {
  return count > 0 ? Math.round(spendMinor / count) : null;
}

// --- Periods ----------------------------------------------------------------------------------------------------

const DAY = 86_400_000;
const isoDay = (value: string) => Date.parse(`${value}T00:00:00Z`);
/** Days in a period, both ends included; 0 when the end is before the start or a date is invalid. */
export function periodDays(from: string, to: string) {
  const a = isoDay(from), b = isoDay(to);
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b - a) / DAY) + 1 : 0;
}

/** The share of an amount spent from..to that falls inside rangeFrom..rangeTo (same rule as the database). */
export function proratedMinor(amountMinor: number, spentFrom: string, spentTo: string, rangeFrom: string, rangeTo: string) {
  const total = periodDays(spentFrom, spentTo);
  const from = spentFrom > rangeFrom ? spentFrom : rangeFrom, to = spentTo < rangeTo ? spentTo : rangeTo;
  const inside = periodDays(from, to);
  return total > 0 && inside > 0 ? Math.round(amountMinor * inside / total) : 0;
}

// --- Validation -------------------------------------------------------------------------------------------------

const date = z.iso.date();
const text = (max: number) => z.string().trim().max(max).transform(value => value || null).nullable().optional();
const externalId = z.string().trim().regex(/^\d{1,40}$/, "Use the platform's numeric campaign ID.").or(z.literal("")).transform(value => value || null).nullable().optional();
const money = z.union([z.string(), z.number()]).transform((value, context) => {
  const minor = parseMoney(value);
  if (minor === null) { context.addIssue({ code: "custom", message: "Enter an amount such as 1250 or 1250.50." }); return z.NEVER; }
  return minor;
});
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a three-letter currency code such as AED.").default("AED");

const campaignFields = {
  name: z.string().trim().min(1, "Enter the campaign's name.").max(200),
  platform: z.enum(CAMPAIGN_PLATFORMS).nullable().optional(),
  status: z.enum(CAMPAIGN_STATUSES).default("ACTIVE"),
  startsOn: date.or(z.literal("")).transform(value => value || null).nullable().optional(),
  endsOn: date.or(z.literal("")).transform(value => value || null).nullable().optional(),
  budget: money.or(z.literal("").transform(() => null)).nullable().optional(),
  currency,
  ownerMembershipId: z.uuid().or(z.literal("")).transform(value => value || null).nullable().optional(),
  notes: text(2000),
  metaCampaignId: externalId, googleCampaignId: externalId, tiktokCampaignId: externalId,
};
const datesInOrder = (value: { startsOn?: string | null; endsOn?: string | null }) => !value.startsOn || !value.endsOn || value.startsOn <= value.endsOn;

export const createCampaignSchema = z.strictObject(campaignFields).refine(datesInOrder, { message: "The end date must be on or after the start date.", path: ["endsOn"] });
export const updateCampaignSchema = z.strictObject({ ...campaignFields, id: z.uuid(), expectedRevision: z.number().int().min(1) })
  .refine(datesInOrder, { message: "The end date must be on or after the start date.", path: ["endsOn"] });

const spendFields = {
  spentFrom: date, spentTo: date, amount: money, currency, note: text(300),
};
const spendPeriod = (value: { spentFrom: string; spentTo: string }) => periodDays(value.spentFrom, value.spentTo) >= 1 && periodDays(value.spentFrom, value.spentTo) <= MAX_SPEND_DAYS;
const periodMessage = { message: `Choose a period of 1 to ${MAX_SPEND_DAYS} days, ending on or after its start.`, path: ["spentTo"] };
/** Spend for a campaign with a record (campaignId) or one found in leads only (campaignKey, given a record first). */
export const addSpendSchema = z.strictObject({ ...spendFields, campaignId: z.uuid().optional(), campaignKey: z.string().trim().min(1).max(200).optional() })
  .refine(value => Boolean(value.campaignId) !== Boolean(value.campaignKey), "Choose the campaign.")
  .refine(spendPeriod, periodMessage);
export const updateSpendSchema = z.strictObject({ ...spendFields, id: z.uuid() }).refine(spendPeriod, periodMessage);

// --- Figures ----------------------------------------------------------------------------------------------------

export interface CampaignFigures { leads: number; qualified: number; won: number; spend: Array<{ currency: string; amountMinor: number }> }
export interface CampaignRow extends CampaignFigures {
  key: string; id: string | null; name: string; platform: string | null; channel: string | null; status: CampaignStatus | null;
  startsOn: string | null; endsOn: string | null; budgetMinor: number | null; currency: string;
}

const count = (value: unknown) => { const n = typeof value === "number" ? value : Number(value ?? 0); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0; };
const str = (value: unknown, max: number) => typeof value === "string" && value ? value.slice(0, max) : null;
const isStatus = (value: unknown): value is CampaignStatus => typeof value === "string" && (CAMPAIGN_STATUSES as readonly string[]).includes(value);

/** The database's campaign and spend rows to typed rows: one per campaign, its spend by currency. */
export function campaignRows(rawCampaigns: unknown, rawSpend: unknown): CampaignRow[] {
  const list = (value: unknown) => Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null) : [];
  const spend = new Map<string, Array<{ currency: string; amountMinor: number }>>();
  for (const row of list(rawSpend)) {
    const key = str(row.key, 200), currencyCode = str(row.currency, 3);
    if (!key || !currencyCode) continue;
    spend.set(key, [...(spend.get(key) ?? []), { currency: currencyCode, amountMinor: count(row.amount_minor) }]);
  }
  return list(rawCampaigns).flatMap((row): CampaignRow[] => {
    const key = str(row.key, 200);
    if (!key) return [];
    const budget = row.budget_minor === null || row.budget_minor === undefined ? null : count(row.budget_minor);
    return [{
      key, id: str(row.id, 40), name: str(row.name, 200) ?? str(row.label, 300) ?? key, platform: str(row.platform, 20) ?? str(row.lead_platform, 20), channel: str(row.channel, 20),
      status: isStatus(row.status) ? row.status : null, startsOn: str(row.starts_on, 10), endsOn: str(row.ends_on, 10), budgetMinor: budget, currency: str(row.currency, 3) ?? "AED",
      leads: count(row.leads), qualified: count(row.qualified), won: count(row.won), spend: spend.get(key) ?? [],
    }];
  });
}

/** Totals: leads, qualified and won, and spend per currency (never added across currencies). */
export function campaignTotals(rows: CampaignRow[]): CampaignFigures {
  const spend = new Map<string, number>();
  for (const row of rows) for (const item of row.spend) spend.set(item.currency, (spend.get(item.currency) ?? 0) + item.amountMinor);
  return {
    leads: rows.reduce((sum, row) => sum + row.leads, 0), qualified: rows.reduce((sum, row) => sum + row.qualified, 0), won: rows.reduce((sum, row) => sum + row.won, 0),
    spend: [...spend].map(([currencyCode, amountMinor]) => ({ currency: currencyCode, amountMinor })).sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}

/** Cost per lead, qualified lead and won lead, when the spend is in one currency (null otherwise or with no count). */
export function costs(figures: CampaignFigures) {
  if (figures.spend.length !== 1) return { currency: null, perLead: null, perQualified: null, perWon: null };
  const [{ currency: currencyCode, amountMinor }] = figures.spend;
  return { currency: currencyCode, perLead: costPer(amountMinor, figures.leads), perQualified: costPer(amountMinor, figures.qualified), perWon: costPer(amountMinor, figures.won) };
}
