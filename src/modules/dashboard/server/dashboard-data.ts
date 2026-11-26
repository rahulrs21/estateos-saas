import "server-only";

import { getLeadMetrics, listRecentLeadActivity } from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { getLeadAnalytics } from "@/modules/lead-capture/server/reports";
import { listMyTasks } from "@/modules/automations/server/tasks";
import {
  DASHBOARD_TIME_ZONE, activityLabel, calendarDate, dashboardSections, fillVolumeSeries, orderStages, periodChange, previousRange, rangeDates,
  shareSlices, taskAgenda, toSection, topAgents,
  type DashboardRange,
} from "../dashboard-model";

/** Page size of ListMyTasks; a full page means the task counts are a lower bound. */
const TASK_PAGE_SIZE = 100;
/** Rows in the "Your activity" feed. */
const ACTIVITY_LIMIT = 6;

const safeMessage = (reason: unknown) => reason instanceof WorkspaceError ? reason.message : null;

/**
 * Everything the dashboard shows above the inventory section, for the signed-in
 * member's active company. Each section loads independently through the
 * existing scoped operations (no new authorization paths), so one failure
 * shows an error in that card only. Lead figures are company-wide for OWNER and
 * ADMIN and the member's assigned leads otherwise (enforced in SQL).
 */
export async function loadDashboard(range: DashboardRange) {
  const context = await requireActiveOrganizationRequest();
  const sections = dashboardSections(context.membership.role);
  const now = new Date();
  const {from, to, bucket} = rangeDates(range, calendarDate(now, DASHBOARD_TIME_ZONE));
  const previous = previousRange(from, range);
  const {dc, options} = context.request;

  const [analytics, priorAnalytics, metrics, tasks, activity] = await Promise.allSettled([
    getLeadAnalytics({from, to, bucket, timeZone: DASHBOARD_TIME_ZONE}),
    // The equally long period before, for "vs previous period" on new and won leads (same scope and rules).
    getLeadAnalytics({from: previous.from, to: previous.to, bucket, timeZone: DASHBOARD_TIME_ZONE}),
    executeWorkspaceOperation(() => getLeadMetrics(dc, {organizationId: context.organizationId}, options), "GetLeadMetrics"),
    listMyTasks(context),
    executeWorkspaceOperation(() => listRecentLeadActivity(dc, {organizationId: context.organizationId, limit: ACTIVITY_LIMIT}, options), "ListRecentLeadActivity"),
  ]);

  const leads = toSection(analytics, safeMessage, "Lead analytics could not be loaded.");
  const pipeline = toSection(metrics, safeMessage, "Pipeline figures could not be loaded.");
  const agenda = toSection(tasks, safeMessage, "Tasks could not be loaded.");
  const feed = toSection(activity, safeMessage, "Recent activity could not be loaded.");
  // A failed comparison only hides the change figures; the current period still shows.
  const prior = priorAnalytics.status === "fulfilled" ? priorAnalytics.value.summary : null;

  return {
    range, from, to, bucket, sections, now: now.toISOString(),
    canManageInventory: context.membership.role === "OWNER" || context.membership.role === "ADMIN",
    leads: leads.status === "ok" ? {status: "ok" as const, data: {
      summary: leads.data.summary,
      change: prior ? {
        leads: periodChange(leads.data.summary.totalLeads, prior.totalLeads),
        won: periodChange(leads.data.summary.wonLeads, prior.wonLeads),
      } : null,
      sources: shareSlices(leads.data.origins.channels.map(row => ({label: row.label, count: row.leads}))),
      volume: fillVolumeSeries(leads.data.volume, from, to, bucket),
      channels: leads.data.origins.channels.filter(row => row.leads > 0).map(row => ({label: row.label, count: row.leads})),
      stages: orderStages(leads.data.stages, leads.data.options.stages.map(stage => stage.label)),
      agents: sections.leaderboard ? topAgents(leads.data.byAgent) : null,
    }} : leads,
    // A server whose deployed connector predates the negotiation field returns no array; show the tile as unavailable, not 0.
    pipeline: pipeline.status === "ok" && Array.isArray(pipeline.data.negotiation)
      ? {status: "ok" as const, data: {negotiation: pipeline.data.negotiation[0]?.count ?? 0, openLeads: pipeline.data.total[0]?.count ?? 0}}
      : {status: "error" as const, message: pipeline.status === "error" ? pipeline.message : "Pipeline figures are not available yet."},
    tasks: agenda.status === "ok" ? {status: "ok" as const, data: taskAgenda(agenda.data.followUps, agenda.data.workTasks, now, TASK_PAGE_SIZE)} : agenda,
    activity: feed.status === "ok" ? {status: "ok" as const, data: feed.data.activities.flatMap(row => row.leadId ? [{
      id: row.id, ...activityLabel(row.kind, row.metadata), leadId: row.leadId, leadName: row.lead?.fullName ?? "Lead",
      actor: row.actor.displayName || "Team member", createdAt: row.createdAt,
    }] : [])} : feed,
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
