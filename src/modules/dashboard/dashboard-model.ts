/*
 * Pure dashboard rules: reporting ranges, chart series, the task agenda and
 * which sections a role sees. No I/O here, so every rule is unit-tested
 * (tests/dashboard-model.test.ts). Data access lives in server/dashboard-data.ts.
 */

export const DASHBOARD_TIME_ZONE = "Asia/Dubai";

export const DASHBOARD_RANGES = {
  "today": {days: 1, bucket: "day", label: "Today"},
  "7d": {days: 7, bucket: "day", label: "7 days"},
  "30d": {days: 30, bucket: "day", label: "30 days"},
  "90d": {days: 90, bucket: "week", label: "90 days"},
  "1y": {days: 365, bucket: "month", label: "1 year"},
} as const;

export type DashboardRange = keyof typeof DASHBOARD_RANGES;
export type VolumeBucket = (typeof DASHBOARD_RANGES)[DashboardRange]["bucket"];
export const DEFAULT_DASHBOARD_RANGE: DashboardRange = "30d";

/** The `?range=` value, or the default when it is missing or not one of the offered ranges. */
export function parseDashboardRange(raw: unknown): DashboardRange {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && Object.hasOwn(DASHBOARD_RANGES, value) ? value as DashboardRange : DEFAULT_DASHBOARD_RANGE;
}

/** Calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function calendarDate(instant: Date, timeZone = DASHBOARD_TIME_ZONE) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {timeZone, year: "numeric", month: "2-digit", day: "2-digit"})
    .formatToParts(instant).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Shifts a YYYY-MM-DD date by whole days. */
export function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Inclusive calendar dates the range covers, ending today, and the chart bucket. */
export function rangeDates(range: DashboardRange, today: string) {
  const {days, bucket} = DASHBOARD_RANGES[range];
  return {from: shiftDate(today, -(days - 1)), to: today, bucket};
}

/** A YYYY-MM-DD string that is a real calendar date. */
export function isCalendarDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

/** Days from `from` to `to`, both included. */
export function inclusiveDays(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** The lead report covers at most 366 days. */
export const MAX_CUSTOM_DAYS = 366;

/** Daily points up to a month, weekly up to six months, monthly beyond. */
export function bucketForDays(days: number): VolumeBucket {
  return days <= 31 ? "day" : days <= 183 ? "week" : "month";
}

export type DashboardPeriod = {
  key: DashboardRange | "custom";
  from: string; to: string; days: number; bucket: VolumeBucket;
  /** "Last 7 days", "Today" or "1 Nov – 26 Nov 2026". */
  label: string;
  /** What a change is measured against: "previous 7 days", "yesterday", "previous period". */
  versus: string;
  /** "in the last 7 days", "today", "in this period". */
  within: string;
};

const shortDay = new Intl.DateTimeFormat("en-AE", {day: "numeric", month: "short", timeZone: "UTC"});
const fullDay = new Intl.DateTimeFormat("en-AE", {day: "numeric", month: "short", year: "numeric", timeZone: "UTC"});
const asUtc = (date: string) => new Date(`${date}T00:00:00Z`);

/** "1 Nov – 26 Nov 2026", "28 Dec 2025 – 3 Jan 2026" or "26 Nov 2026" for a single day. */
export function periodLabel(from: string, to: string) {
  if (from === to) return fullDay.format(asUtc(to));
  return `${(from.slice(0, 4) === to.slice(0, 4) ? shortDay : fullDay).format(asUtc(from))} – ${fullDay.format(asUtc(to))}`;
}

/**
 * The reporting period from the URL (?range=… or ?range=custom&from=…&to=…).
 * A custom period must be real dates, from on or before to, not after today
 * and at most 366 days; anything else falls back to the default range.
 */
export function parseDashboardPeriod(params: {range?: unknown; from?: unknown; to?: unknown}, today: string): DashboardPeriod {
  const first = (value: unknown) => Array.isArray(value) ? value[0] : value;
  const range = first(params.range), from = first(params.from), to = first(params.to);
  if (range === "custom" && isCalendarDate(from) && isCalendarDate(to) && from <= to && to <= today) {
    const days = inclusiveDays(from, to);
    if (days <= MAX_CUSTOM_DAYS) {
      return {key: "custom", from, to, days, bucket: bucketForDays(days), label: periodLabel(from, to), versus: "previous period", within: "in this period"};
    }
  }
  const key = parseDashboardRange(range);
  const preset = DASHBOARD_RANGES[key];
  const dates = rangeDates(key, today);
  return key === "today"
    ? {key, ...dates, days: 1, label: "Today", versus: "yesterday", within: "today"}
    : {key, ...dates, days: preset.days, label: `Last ${preset.label}`, versus: `previous ${preset.label}`, within: `in the last ${preset.label}`};
}

/** The equally long period just before, for "vs previous period" comparisons. */
export function previousPeriod(period: Pick<DashboardPeriod, "from" | "days">) {
  return {from: shiftDate(period.from, -period.days), to: shiftDate(period.from, -1)};
}

/** The equally long period just before a range, for "vs previous period" comparisons. */
export function previousRange(from: string, range: DashboardRange) {
  const {days} = DASHBOARD_RANGES[range];
  return {from: shiftDate(from, -days), to: shiftDate(from, -1)};
}

/** The first day of the month of a date, matching PostgreSQL's date_trunc('month'). */
function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

/** The first day of the next month. */
function nextMonth(date: string) {
  const [year, month] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

/** Monday on or before a date, matching PostgreSQL's date_trunc('week'). */
function weekStart(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftDate(date, -((weekday + 6) % 7));
}

export type VolumePoint = {date: string; count: number};

/**
 * One point per day or week from `from` to `to`, with zero where the database
 * returned no row, so the trend line never skips a quiet period.
 */
export function fillVolumeSeries(rows: ReadonlyArray<{label: string; count: number; bucket?: string}>, from: string, to: string, bucket: VolumeBucket): VolumePoint[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = (row.bucket ?? row.label).slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + row.count);
  }
  const points: VolumePoint[] = [];
  const first = bucket === "month" ? monthStart(from) : bucket === "week" ? weekStart(from) : from;
  const next = (date: string) => bucket === "month" ? nextMonth(date) : shiftDate(date, bucket === "week" ? 7 : 1);
  for (let date = first; date <= to; date = next(date)) {
    points.push({date, count: counts.get(date) ?? 0});
  }
  return points;
}

/** Stage rows in pipeline order (as configured), then any stage not in the configuration by count. */
export function orderStages(rows: ReadonlyArray<{label: string; count: number}>, configuredOrder: readonly string[]) {
  const position = new Map<string, number>();
  configuredOrder.forEach((label, index) => { if (!position.has(label)) position.set(label, index); });
  return [...rows].sort((a, b) => {
    const left = position.get(a.label) ?? Number.MAX_SAFE_INTEGER;
    const right = position.get(b.label) ?? Number.MAX_SAFE_INTEGER;
    return left - right || b.count - a.count || a.label.localeCompare(b.label);
  });
}

export const UNASSIGNED_LABEL = "Unassigned";

/** The agents with the most leads (ties by name), with unassigned leads reported separately. */
export function topAgents(rows: ReadonlyArray<{label: string; count: number}>, limit = 5) {
  const assigned = rows.filter(row => row.label !== UNASSIGNED_LABEL)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return {
    agents: assigned.slice(0, limit),
    others: assigned.length - Math.min(assigned.length, limit),
    unassigned: rows.find(row => row.label === UNASSIGNED_LABEL)?.count ?? 0,
  };
}

export type AgendaDue = "OVERDUE" | "TODAY" | "THIS_WEEK" | "LATER";
export type AgendaItem = {id: string; kind: "FOLLOW_UP" | "WORK_TASK"; title: string; context: string; dueAt: string; due: AgendaDue; href: string | null};

type FollowUpRow = {id: string; title: string; dueAt: string; leadId: string; lead?: {fullName: string} | null};
type WorkTaskRow = {id: string; title: string; dueAt: string; leadId?: string | null; listingId?: string | null; listing?: {title: string; listingReference: string} | null};

/** Overdue before now; otherwise by the calendar day of the due time in the reporting time zone. */
export function classifyDue(dueAt: string, now: Date, timeZone = DASHBOARD_TIME_ZONE): AgendaDue {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime()) || due < now) return "OVERDUE";
  const today = calendarDate(now, timeZone);
  const day = calendarDate(due, timeZone);
  if (day === today) return "TODAY";
  return day <= shiftDate(today, 7) ? "THIS_WEEK" : "LATER";
}

/**
 * The caller's open follow-ups and work tasks as one list, soonest first, with
 * counts for the KPI tile. `truncated` is true when either source returned its
 * full page, so the counts are a lower bound.
 */
export function taskAgenda(followUps: readonly FollowUpRow[], workTasks: readonly WorkTaskRow[], now: Date, pageSize: number, timeZone = DASHBOARD_TIME_ZONE) {
  const items: AgendaItem[] = [
    ...followUps.map(row => ({
      id: `f-${row.id}`, kind: "FOLLOW_UP" as const, title: row.title, context: row.lead?.fullName ?? "Lead",
      dueAt: row.dueAt, due: classifyDue(row.dueAt, now, timeZone), href: `/leads/${row.leadId}`,
    })),
    ...workTasks.map(row => ({
      id: `w-${row.id}`, kind: "WORK_TASK" as const, title: row.title,
      context: row.listing ? `${row.listing.listingReference} · ${row.listing.title}` : "Team task",
      dueAt: row.dueAt, due: classifyDue(row.dueAt, now, timeZone),
      href: row.leadId ? `/leads/${row.leadId}` : row.listingId ? `/listings/${row.listingId}` : null,
    })),
  ].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.id.localeCompare(b.id));
  const count = (due: AgendaDue) => items.filter(item => item.due === due).length;
  return {
    items,
    overdue: count("OVERDUE"),
    dueToday: count("TODAY"),
    dueNext7Days: count("TODAY") + count("THIS_WEEK"),
    truncated: followUps.length >= pageSize || workTasks.length >= pageSize,
  };
}

export type DashboardRole = "OWNER" | "ADMIN" | "MANAGER" | "AGENT";

/**
 * Sections each role is shown. Inventory (and its map) is not available to
 * managers, who have no verified inventory scope (docs/PERMISSIONS.md); the
 * agent leaderboard compares colleagues, so only company-wide roles see it.
 * The stored queries enforce the same rules; this only avoids requests that
 * would be refused.
 */
export function dashboardSections(role: string) {
  const companyWide = role === "OWNER" || role === "ADMIN";
  return {inventory: role !== "MANAGER", map: role !== "MANAGER", leaderboard: companyWide, leadScope: companyWide ? "COMPANY" as const : "ASSIGNED_TO_YOU" as const};
}

export type Section<T> = {status: "ok"; data: T} | {status: "error"; message: string};

/** A settled section load, with a user-safe message on failure. */
export function toSection<T>(result: PromiseSettledResult<T>, safeMessage: (reason: unknown) => string | null, fallback: string): Section<T> {
  return result.status === "fulfilled"
    ? {status: "ok", data: result.value}
    : {status: "error", message: safeMessage(result.reason) ?? fallback};
}

export type Change = {direction: "up" | "down" | "flat"; percent: number} | {direction: "new"} | null;

/**
 * Change from the previous period, rounded to a whole percent. "new" when
 * there was nothing before and something now; null when both are zero (no
 * comparison worth showing).
 */
export function periodChange(current: number, previous: number): Change {
  if (previous <= 0) return current > 0 ? {direction: "new"} : null;
  const percent = Math.round((current - previous) / previous * 100);
  return {direction: percent > 0 ? "up" : percent < 0 ? "down" : "flat", percent: Math.abs(percent)};
}

/** Hour of the day (0–23) of an instant in the reporting time zone. */
export function zonedHour(instant: Date, timeZone = DASHBOARD_TIME_ZONE) {
  return Number(new Intl.DateTimeFormat("en-GB", {timeZone, hour: "2-digit", hourCycle: "h23"}).format(instant));
}

/** Morning 05:00–11:59, afternoon 12:00–16:59, evening otherwise. */
export function greetingFor(hour: number) {
  return hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : "Good evening";
}

/** First word of a display name, or null for an email-like or empty value. */
export function firstName(name: string | null | undefined) {
  const value = name?.trim();
  if (!value || value.includes("@")) return null;
  return value.split(/\s+/)[0];
}

export const OTHER_LABEL = "Other";

/**
 * Part-to-whole rows for a donut: at most `max` slices, largest first, with
 * the rest folded into "Other" so colours never run out.
 */
export function shareSlices(rows: ReadonlyArray<{label: string; count: number}>, max = 5) {
  const sorted = rows.filter(row => row.count > 0).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const kept = sorted.length > max ? sorted.slice(0, max - 1) : sorted;
  const rest = sorted.slice(kept.length).reduce((sum, row) => sum + row.count, 0);
  const slices = rest > 0 ? [...kept, {label: OTHER_LABEL, count: rest}] : kept;
  const total = slices.reduce((sum, row) => sum + row.count, 0);
  return {total, slices: slices.map(row => ({...row, percent: total ? Math.round(row.count / total * 100) : 0}))};
}

export type ActivityTone = "lead" | "stage" | "note" | "task" | "property" | "other";

/** What an activity row says and which icon family it uses. */
export function activityLabel(kind: string, metadata?: unknown): {title: string; tone: ActivityTone} {
  const status = typeof metadata === "object" && metadata !== null && typeof (metadata as {status?: unknown}).status === "string"
    ? (metadata as {status: string}).status.replaceAll("_", " ").toLowerCase() : null;
  switch (kind) {
    case "LEAD_CREATED": return {title: "New lead added", tone: "lead"};
    case "WEBSITE_LEAD_CAPTURED": return {title: "New lead from a website form", tone: "lead"};
    case "LEAD_STATUS_CHANGED": return {title: status ? `Lead moved to ${status}` : "Lead stage changed", tone: "stage"};
    case "LEAD_ASSIGNED": return {title: "Lead assigned", tone: "lead"};
    case "LEAD_NOTE_ADDED": return {title: "Note added", tone: "note"};
    case "LEAD_UPDATED": return {title: "Lead details updated", tone: "note"};
    case "LEAD_QUALIFICATION_UPDATED": return {title: "Qualification updated", tone: "note"};
    case "FOLLOW_UP_SCHEDULED": return {title: "Follow-up scheduled", tone: "task"};
    case "FOLLOW_UP_COMPLETED": return {title: "Follow-up completed", tone: "task"};
    case "LEAD_PROPERTY_VIEWING_SCHEDULED": return {title: "Viewing scheduled", tone: "property"};
    case "LEAD_PROPERTY_VIEWING_UPDATED": return {title: "Viewing updated", tone: "property"};
    case "LEAD_PROPERTY_INTEREST_CHANGED": return {title: "Property shortlist updated", tone: "property"};
    case "LEAD_PRIMARY_INTEREST_CHANGED": return {title: "Interested property changed", tone: "property"};
    default: return {title: "Lead activity", tone: "other"};
  }
}

/** "just now", "12 min ago", "3 h ago", "2 days ago", then a short date. */
export function relativeTime(iso: string, now: Date) {
  const seconds = Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 1000));
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Intl.DateTimeFormat("en-AE", {day: "numeric", month: "short", timeZone: DASHBOARD_TIME_ZONE}).format(new Date(iso));
}
