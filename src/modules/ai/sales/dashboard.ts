import { INTERACTION_KINDS, type AiLeadPriority } from "./scoring";

/**
 * AI Sales dashboard metrics (docs/AI_SALES_INTELLIGENCE.md#ai-sales-dashboard).
 * Pure counts over records the member is permitted to see. Every figure is a
 * count of stored CRM records; nothing is estimated, extrapolated or
 * forecast. Coverage flags say when a list hit its read limit.
 */

export interface DashboardLead {
  id: string; status: string; archived: boolean; assignedMembershipId: string | null; branchId: string | null;
  followUpAt: string | null; createdAt: string; updatedAt: string;
}
export interface DashboardAssessment { leadId: string; id: string; priority: AiLeadPriority; evaluatedAt: string }
export interface DashboardReview { leadId: string; assessmentId: string; reviewedPriority: AiLeadPriority; createdAt: string }
export interface DashboardViewing { leadId: string; scheduledAt: string; status: string; customerConfirmation: string }
export interface DashboardActivity { leadId: string | null; kind: string; createdAt: string }

export const OPEN_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "VIEWING_SCHEDULED", "VIEWING_COMPLETED", "NEGOTIATION"] as const;
const CLOSED = new Set(["WON", "LOST", "CONVERTED"]);
export const STALE_DAYS = 14;
export const ASSESSMENT_WINDOW_DAYS = 90;
export const TREND_DAYS = 14;
const DAY = 86_400_000;

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/** Latest assessment per lead; a review applies only to the assessment it reviewed. */
export function effectivePriorities(assessments: DashboardAssessment[], reviews: DashboardReview[]) {
  const latest = new Map<string, DashboardAssessment>();
  for (const row of assessments) {
    const current = latest.get(row.leadId);
    if (!current || row.evaluatedAt > current.evaluatedAt) latest.set(row.leadId, row);
  }
  const reviewFor = new Map<string, DashboardReview>();
  for (const review of reviews) {
    const current = reviewFor.get(review.assessmentId);
    if (!current || review.createdAt > current.createdAt) reviewFor.set(review.assessmentId, review);
  }
  const result = new Map<string, {priority: AiLeadPriority; reviewed: boolean; suggested: AiLeadPriority}>();
  for (const [leadId, assessment] of latest) {
    const review = reviewFor.get(assessment.id);
    result.set(leadId, {priority: review?.reviewedPriority ?? assessment.priority, reviewed: Boolean(review), suggested: assessment.priority});
  }
  return result;
}

export function computeSalesMetrics(input: {
  now: string; leads: DashboardLead[]; assessments: DashboardAssessment[]; reviews: DashboardReview[];
  viewings: DashboardViewing[]; activities: DashboardActivity[]; showUnassigned: boolean;
}) {
  const now = Date.parse(input.now);
  const leads = input.leads.filter(lead => !lead.archived);
  const leadIds = new Set(leads.map(lead => lead.id));
  const open = leads.filter(lead => !CLOSED.has(lead.status));
  const openIds = new Set(open.map(lead => lead.id));

  const byStatus = OPEN_STATUSES.map(status => {
    const rows = open.filter(lead => lead.status === status);
    const ages = rows.map(lead => Math.floor((now - Date.parse(lead.updatedAt)) / DAY));
    return {status, count: rows.length, stale: ages.filter(age => age >= STALE_DAYS).length, medianDaysSinceUpdate: median(ages)};
  });
  const bottlenecks = byStatus.filter(row => row.stale > 0).sort((a, b) => b.stale - a.stale || b.count - a.count).slice(0, 3);

  const priorities = effectivePriorities(input.assessments.filter(row => openIds.has(row.leadId)), input.reviews.filter(row => openIds.has(row.leadId)));
  const priorityCounts: Record<AiLeadPriority, number> = {HIGH: 0, MEDIUM: 0, LOW: 0, INSUFFICIENT_DATA: 0};
  let overrides = 0;
  for (const value of priorities.values()) { priorityCounts[value.priority] += 1; if (value.reviewed && value.priority !== value.suggested) overrides += 1; }

  const scopedViewings = input.viewings.filter(row => leadIds.has(row.leadId));
  const upcoming = scopedViewings.filter(row => row.status === "SCHEDULED" && Date.parse(row.scheduledAt) > now);

  const trendStart = now - (TREND_DAYS - 1) * DAY;
  const dayKey = (time: number) => new Date(time + 4 * 3_600_000).toISOString().slice(0, 10); // Dubai date
  const trend = new Map<string, number>();
  for (let index = 0; index < TREND_DAYS; index += 1) trend.set(dayKey(trendStart + index * DAY), 0);
  for (const activity of input.activities) {
    if (!activity.leadId || !leadIds.has(activity.leadId) || !INTERACTION_KINDS.has(activity.kind)) continue;
    const key = dayKey(Date.parse(activity.createdAt));
    if (trend.has(key)) trend.set(key, trend.get(key)! + 1);
  }

  return {
    asOf: input.now,
    leads: {
      active: leads.length,
      open: open.length,
      won: leads.filter(lead => lead.status === "WON" || lead.status === "CONVERTED").length,
      lost: leads.filter(lead => lead.status === "LOST").length,
      qualified: open.filter(lead => lead.status === "QUALIFIED").length,
      newLast7Days: leads.filter(lead => now - Date.parse(lead.createdAt) <= 7 * DAY).length,
      overdueFollowUp: open.filter(lead => lead.followUpAt && Date.parse(lead.followUpAt) < now).length,
      noUpcomingFollowUp: open.filter(lead => !lead.followUpAt || Date.parse(lead.followUpAt) < now).length,
      unassigned: input.showUnassigned ? open.filter(lead => !lead.assignedMembershipId).length : null,
    },
    pipeline: {byStatus, bottlenecks, staleAfterDays: STALE_DAYS},
    aiPriority: {...priorityCounts, notAssessed: open.length - priorities.size, overriddenByReview: overrides, windowDays: ASSESSMENT_WINDOW_DAYS},
    viewings: {
      upcoming30Days: upcoming.length,
      awaitingConfirmation: upcoming.filter(row => row.customerConfirmation === "PENDING").length,
      outcomeNotRecorded: scopedViewings.filter(row => row.status === "SCHEDULED" && Date.parse(row.scheduledAt) < now - 2 * 3_600_000).length,
    },
    activityTrend: [...trend.entries()].map(([date, interactions]) => ({date, interactions})),
  };
}
export type SalesMetrics = ReturnType<typeof computeSalesMetrics>;

/**
 * Every number in the metrics, for checking that an AI summary copies figures
 * instead of inventing them. Dates in the metrics (for example the activity
 * trend) contribute their year, month and day, so "28 October 2026" is verified.
 */
export function metricNumbers(value: unknown, into: Array<number> = []): number[] {
  if (typeof value === "number") into.push(value);
  else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) into.push(...value.slice(0, 10).split("-").map(Number));
  else if (Array.isArray(value)) value.forEach(item => metricNumbers(item, into));
  else if (value && typeof value === "object") Object.values(value).forEach(item => metricNumbers(item, into));
  return into;
}
