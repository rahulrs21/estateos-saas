import { LEAD_CHANNEL_LABELS, type LeadChannel } from "./attribution";

/*
 * Phase 7E.4: "Where leads come from" on the reports page (docs/LEAD_ATTRIBUTION_PLAN.md#3-where-it-shows).
 * Pure: shapes the rows the database returned, computes rates and writes the CSV download. Every count comes
 * from GetLeadSourceReport, which applies the member's visibility; nothing here widens it.
 */

export interface SourceReportRow { leads: number; qualified: number; won: number }
export interface ChannelReportRow extends SourceReportRow { channel: LeadChannel | "UNRECORDED"; label: string }
export interface CampaignReportRow extends SourceReportRow {
  key: string; label: string; channel: LeadChannel | null; channelLabel: string; channels: number;
  /** Phase 7F.1: spend in the period by currency (owners and administrators only). */
  spend?: Array<{ currency: string; amountMinor: number }>;
}
export interface SourceReport {
  channels: ChannelReportRow[]; campaigns: CampaignReportRow[]; total: SourceReportRow;
  /** Phase 7F.1: whether spend is shown (owners and administrators, reporting on the whole company). */
  spendShown?: boolean;
}

/** Phase 7F.1: adds each campaign's spend for the period; without a spend map the report stays as it is. */
export function withSpend(report: SourceReport, spend: Map<string, Array<{ currency: string; amountMinor: number }>> | null): SourceReport {
  if (!spend) return report;
  return { ...report, spendShown: true, campaigns: report.campaigns.map(row => ({ ...row, spend: spend.get(row.key) ?? [] })) };
}

/** "AED 5,000" for one currency, "AED 5,000 + USD 100" for several, or "" without spend. */
export function spendLabel(spend: Array<{ currency: string; amountMinor: number }> | undefined) {
  return (spend ?? []).map(item => `${item.currency} ${(item.amountMinor / 100).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`).join(" + ");
}

/** Cost per lead as "AED 250", when the spend is in one currency and there are leads. */
export function costPerLeadLabel(row: CampaignReportRow) {
  if (!row.spend || row.spend.length !== 1 || row.leads === 0) return "";
  const [{ currency, amountMinor }] = row.spend;
  return `${currency} ${(Math.round(amountMinor / row.leads) / 100).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
}

const count = (value: unknown) => { const n = typeof value === "number" ? value : Number(value ?? 0); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0; };
const text = (value: unknown, max: number) => typeof value === "string" ? value.slice(0, max) : "";
const isChannel = (value: string): value is LeadChannel => Object.hasOwn(LEAD_CHANNEL_LABELS, value);
export const UNRECORDED_LABEL = "Not recorded";

/** The database's rows to typed report rows (bounded, unknown channels dropped). */
export function sourceReport(rawChannels: unknown, rawCampaigns: unknown): SourceReport {
  const list = (value: unknown) => Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null) : [];
  const channels = list(rawChannels).flatMap((row): ChannelReportRow[] => {
    const channel = text(row.channel, 20);
    if (channel !== "UNRECORDED" && !isChannel(channel)) return [];
    return [{ channel, label: channel === "UNRECORDED" ? UNRECORDED_LABEL : LEAD_CHANNEL_LABELS[channel], leads: count(row.leads), qualified: count(row.qualified), won: count(row.won) }];
  });
  const campaigns = list(rawCampaigns).slice(0, 50).flatMap((row): CampaignReportRow[] => {
    const key = text(row.key, 200);
    if (!key) return [];
    const channel = text(row.channel, 20);
    const known = isChannel(channel) ? channel : null;
    const channels = Math.max(1, count(row.channels));
    return [{ key, label: text(row.label, 300) || key, channel: known, channels, channelLabel: channels > 1 ? "Several channels" : known ? LEAD_CHANNEL_LABELS[known] : "", leads: count(row.leads), qualified: count(row.qualified), won: count(row.won) }];
  });
  const total = channels.reduce((sum, row) => ({ leads: sum.leads + row.leads, qualified: sum.qualified + row.qualified, won: sum.won + row.won }), { leads: 0, qualified: 0, won: 0 });
  return { channels, campaigns, total };
}

/** A share as a percentage with one decimal, or 0 when there is nothing to divide by. */
export function rate(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

/**
 * One CSV cell: quoted when needed, and a value a spreadsheet would read as a formula (=, +, -, @, tab or carriage
 * return first) is prefixed with an apostrophe, since campaign names come from URLs and ad platforms.
 */
export function csvCell(value: string | number) {
  let cell = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

/** The CSV download: the period and scope, then leads by channel and by campaign, with rates. */
export function sourceReportCsv(report: SourceReport, meta: { from: string; to: string; timeZone: string; scope: string }) {
  const line = (cells: Array<string | number>) => cells.map(csvCell).join(",");
  const rows = [
    line(["Where leads come from"]),
    line(["Period", `${meta.from} to ${meta.to}`, "Time zone", meta.timeZone, "Scope", meta.scope]),
    "",
    line(["Channel", "Leads", "Qualified", "Won", "Qualified %", "Won %"]),
    ...report.channels.map(row => line([row.label, row.leads, row.qualified, row.won, rate(row.qualified, row.leads), rate(row.won, row.leads)])),
    line(["Total", report.total.leads, report.total.qualified, report.total.won, rate(report.total.qualified, report.total.leads), rate(report.total.won, report.total.leads)]),
    "",
    line(["Campaign", "Campaign key", "Channel", "Leads", "Qualified", "Won", "Qualified %", "Won %", ...(report.spendShown ? ["Spend", "Cost per lead"] : [])]),
    ...report.campaigns.map(row => line([row.label, row.key, row.channelLabel, row.leads, row.qualified, row.won, rate(row.qualified, row.leads), rate(row.won, row.leads),
      ...(report.spendShown ? [spendLabel(row.spend), costPerLeadLabel(row)] : [])])),
  ];
  // A byte order mark so spreadsheet programs read the UTF-8 names (Arabic, accents) correctly.
  return "﻿" + rows.join("\r\n") + "\r\n";
}

/** Phase 7E.5: what filling older leads' sources would do: how many leads would get each channel. */
export interface BackfillPreview { total: number; channels: Array<{ channel: LeadChannel; label: string; leads: number }> }
export function backfillPreview(raw: unknown): BackfillPreview {
  const channels = (Array.isArray(raw) ? raw : []).flatMap((row): BackfillPreview["channels"] => {
    if (typeof row !== "object" || row === null) return [];
    const channel = text((row as Record<string, unknown>).channel, 20);
    return isChannel(channel) ? [{ channel, label: LEAD_CHANNEL_LABELS[channel], leads: count((row as Record<string, unknown>).leads) }] : [];
  }).filter(row => row.leads > 0);
  return { total: channels.reduce((sum, row) => sum + row.leads, 0), channels };
}
