import "server-only";

import { getLeadMetrics } from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { getLeadAnalytics } from "@/modules/lead-capture/server/reports";
import { listMyTasks } from "@/modules/automations/server/tasks";
import {
  DASHBOARD_TIME_ZONE, calendarDate, dashboardSections, fillVolumeSeries, orderStages, rangeDates, taskAgenda, toSection, topAgents,
  type DashboardRange,
} from "../dashboard-model";

/** Page size of ListMyTasks; a full page means the task counts are a lower bound. */
const TASK_PAGE_SIZE = 100;

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

  const [analytics, metrics, tasks] = await Promise.allSettled([
    getLeadAnalytics({from, to, bucket, timeZone: DASHBOARD_TIME_ZONE}),
    executeWorkspaceOperation(() => getLeadMetrics(context.request.dc, {organizationId: context.organizationId}, context.request.options), "GetLeadMetrics"),
    listMyTasks(context),
  ]);

  const leads = toSection(analytics, safeMessage, "Lead analytics could not be loaded.");
  const pipeline = toSection(metrics, safeMessage, "Pipeline figures could not be loaded.");
  const agenda = toSection(tasks, safeMessage, "Tasks could not be loaded.");

  return {
    range, from, to, bucket, sections,
    leads: leads.status === "ok" ? {status: "ok" as const, data: {
      summary: leads.data.summary,
      volume: fillVolumeSeries(leads.data.volume, from, to, bucket),
      channels: leads.data.origins.channels.filter(row => row.leads > 0).map(row => ({label: row.label, count: row.leads})),
      stages: orderStages(leads.data.stages, leads.data.options.stages.map(stage => stage.label)),
      agents: sections.leaderboard ? topAgents(leads.data.byAgent) : null,
    }} : leads,
    // A server whose deployed connector predates the negotiation field returns no array; show the tile as unavailable, not 0.
    pipeline: pipeline.status === "ok" && Array.isArray(pipeline.data.negotiation)
      ? {status: "ok" as const, data: {negotiation: pipeline.data.negotiation[0]?.count ?? 0}}
      : {status: "error" as const, message: pipeline.status === "error" ? pipeline.message : "Pipeline figures are not available yet."},
    tasks: agenda.status === "ok" ? {status: "ok" as const, data: taskAgenda(agenda.data.followUps, agenda.data.workTasks, now, TASK_PAGE_SIZE)} : agenda,
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
