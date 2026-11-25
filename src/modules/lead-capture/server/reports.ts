import "server-only";

import * as sdk from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { validateInput } from "@/modules/organizations/server/validation";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { localDateStartUtc } from "../reporting-policy";
import { backfillPreview, sourceReport, sourceReportCsv } from "../source-report";
import { crmMutationContext } from "@/modules/leads/server/crm-service";
import { z } from "zod";

const dateSchema = z.iso.date();
const reportFiltersSchema = z.strictObject({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  timeZone: z.string().trim().min(1).max(64).default("Asia/Dubai"),
  bucket: z.enum(["day", "week", "month"]).default("day"),
  sourceId: z.union([z.uuid(), z.literal("")]).optional(),
  pipelineStageId: z.union([z.uuid(), z.literal("")]).optional(),
  assignedMembershipId: z.union([z.uuid(), z.literal("")]).optional(),
});

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function calendarToday(timeZone: string) {
  const parts = localParts(new Date(), timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateShift(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function validateTimeZone(value: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0); }
  catch { throw new WorkspaceError("INVALID_INPUT", 400, "Choose a valid reporting timezone."); }
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function rows(value: unknown): { label: string; count: number; bucket?: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const row = item as Record<string, unknown>;
    const label = String(row.label ?? row.bucket ?? "Other").slice(0, 120);
    return [{ label, count: number(row.count), ...(row.bucket ? { bucket: String(row.bucket).slice(0, 32) } : {}) }];
  });
}

/** The period, filters and member a report covers; shared by the page and the CSV download. */
async function reportScope(input: unknown) {
  const parsed = validateInput(reportFiltersSchema, input);
  validateTimeZone(parsed.timeZone);
  const to = parsed.to ?? calendarToday(parsed.timeZone);
  const from = parsed.from ?? dateShift(to, -29);
  if (from > to || (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 > 365) {
    throw new WorkspaceError("INVALID_INPUT", 400, "Choose a date range of at most 366 days.");
  }
  const fromInstant = localDateStartUtc(from, parsed.timeZone).toISOString();
  const toInstant = localDateStartUtc(dateShift(to, 1), parsed.timeZone).toISOString();
  const context = await requireActiveOrganizationRequest();
  const canFilterAllAgents = context.membership.role === "OWNER" || context.membership.role === "ADMIN";
  const selectedAgent = parsed.assignedMembershipId ? canonicalUuid(parsed.assignedMembershipId) : null;
  if (selectedAgent && !canFilterAllAgents && selectedAgent !== canonicalUuid(context.membership.id)) {
    throw new WorkspaceError("FORBIDDEN", 403, "You can only report on leads assigned to you.");
  }
  const filterIds = {
    sourceId: parsed.sourceId ? canonicalUuid(parsed.sourceId) : null,
    pipelineStageId: parsed.pipelineStageId ? canonicalUuid(parsed.pipelineStageId) : null,
    assignedMembershipId: selectedAgent,
  };
  return { parsed, from, to, fromInstant, toInstant, context, canFilterAllAgents, filterIds };
}

/** Phase 7E.4: leads by channel and campaign for the same period, filters and visibility as the rest of the report. */
async function loadSourceReport(scope: Awaited<ReturnType<typeof reportScope>>) {
  const { context, fromInstant, toInstant, filterIds } = scope;
  const data = await executeWorkspaceOperation(() => sdk.getLeadSourceReport(context.request.dc, {
    organizationId: context.organizationId, from: fromInstant, to: toInstant, ...filterIds,
  }, context.request.options), "GetLeadSourceReport");
  return sourceReport(data.channels, data.campaigns);
}

/** Phase 7E.4: the "Where leads come from" CSV download. */
export async function getLeadSourceReportCsv(input: unknown = {}) {
  const scope = await reportScope(input);
  const report = await loadSourceReport(scope);
  const csv = sourceReportCsv(report, { from: scope.from, to: scope.to, timeZone: scope.parsed.timeZone, scope: scope.canFilterAllAgents ? "All company leads" : "Leads assigned to you" });
  return { csv, fileName: `lead-sources-${scope.from}-to-${scope.to}.csv` };
}

/**
 * Phase 7E.5: what filling the sources of older leads would do, for owners and administrators (null for others).
 * Company-wide, not limited to the report's period, since the fill covers every lead without a source.
 */
async function loadBackfillPreview(context: Awaited<ReturnType<typeof reportScope>>["context"]) {
  if (context.membership.role !== "OWNER" && context.membership.role !== "ADMIN") return null;
  const data = await executeWorkspaceOperation(() => sdk.leadSourceBackfillPreview(context.request.dc, { organizationId: context.organizationId }, context.request.options), "LeadSourceBackfillPreview");
  return backfillPreview(data.channels);
}

/** Phase 7E.5: fills the sources of the company's leads that have none, from their own history (owners and administrators). */
export async function backfillLeadSources(_input: unknown, expectedOrganizationId: string | null) {
  const context = await crmMutationContext(expectedOrganizationId);
  if (context.membership.role !== "OWNER" && context.membership.role !== "ADMIN") throw new WorkspaceError("FORBIDDEN", 403, "Only owners and administrators can fill lead sources.");
  const data = await executeWorkspaceOperation(() => sdk.backfillLeadSources(context.request.dc, { organizationId: context.organizationId }, context.request.options), "BackfillLeadSources");
  return { filled: number(data.filled) };
}

export async function getLeadAnalytics(input: unknown = {}) {
  const scope = await reportScope(input);
  const { parsed, from, to, fromInstant, toInstant, context, canFilterAllAgents, filterIds } = scope;
  const selectedAgent = filterIds.assignedMembershipId;
  const [analytics, configuration, members, sources] = await Promise.all([
    executeWorkspaceOperation(() => sdk.getLeadAnalytics(context.request.dc, {
      organizationId: context.organizationId, from: fromInstant, to: toInstant,
      timeZone: parsed.timeZone, bucket: parsed.bucket,
      sourceId: parsed.sourceId ? canonicalUuid(parsed.sourceId) : null,
      pipelineStageId: parsed.pipelineStageId ? canonicalUuid(parsed.pipelineStageId) : null,
      assignedMembershipId: selectedAgent,
    }, context.request.options)),
    executeWorkspaceOperation(() => sdk.getLeadConfiguration(context.request.dc, { organizationId: context.organizationId }, context.request.options)),
    canFilterAllAgents
      ? executeWorkspaceOperation(() => sdk.listTeamMembers(context.request.dc, { organizationId: context.organizationId, limit: 100, offset: 0, status: sdk.MembershipStatus.ACTIVE }, context.request.options))
      : Promise.resolve(null),
    loadSourceReport(scope),
  ]);
  const backfill = await loadBackfillPreview(context);
  const summaryValue = analytics.summary;
  const summary = (Array.isArray(summaryValue) ? summaryValue[0] : summaryValue) as Record<string, unknown> | null | undefined;
  const agents = members?.memberships.map((member) => ({
    id: canonicalUuid(member.id), label: member.userProfile?.displayName || member.email,
  })) ?? [{ id: canonicalUuid(context.membership.id), label: context.profile.displayName || context.membership.email }];
  const stages = configuration.pipelines.flatMap((pipeline) => pipeline.pipelineStages_on_pipeline.map((stage) => ({
    id: canonicalUuid(stage.id), label: stage.name, pipelineId: canonicalUuid(pipeline.id),
  })));
  return {
    filters: { from, to, timeZone: parsed.timeZone, bucket: parsed.bucket,
      sourceId: parsed.sourceId ?? "", pipelineStageId: parsed.pipelineStageId ?? "", assignedMembershipId: parsed.assignedMembershipId ?? "" },
    scope: canFilterAllAgents ? "COMPANY" as const : "ASSIGNED_TO_YOU" as const,
    summary: {
      totalLeads: number(summary?.total_leads), unassignedLeads: number(summary?.unassigned_leads),
      wonLeads: number(summary?.won_leads), overdueFollowUps: number(summary?.overdue_follow_ups),
      leadToWonPercent: number(summary?.lead_to_won_percent),
    },
    sources: rows(analytics.sources), stages: rows(analytics.stages), byAgent: rows(analytics.agents),
    volume: rows(analytics.volume),
    origins: sources,
    backfill,
    organizationId: canonicalUuid(context.organizationId),
    options: {
      sources: configuration.leadSources.map((source) => ({ id: canonicalUuid(source.id), label: source.name })),
      stages,
      agents,
    },
    denominator: "Won leads created in the selected period divided by all visible, non-archived leads created in that period.",
  };
}

