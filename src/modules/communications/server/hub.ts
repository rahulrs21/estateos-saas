import "server-only";

import { z } from "zod";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { isMissed } from "../call-state";
import { callTotals, outcomeCounts, totalsByAgent, type MetricCall } from "../metrics";
import { CALL_DIRECTIONS, CALL_OUTCOMES, CALL_SOURCES, CALL_STATUSES, type CallDirection, type CallOutcome, type CallStatus } from "../model";
import { presentCall } from "./calls";
import { asMember, isAdministrator, sdk, type Context } from "./data";
import { idSchema, parseInput } from "./validation";

/*
 * The communication hub (docs/COMMUNICATION_HUB.md#hub). Everything comes from
 * stored records the member may read: OWNERs and ADMINs see the company,
 * other members the calls they handled and the calls on their leads.
 */

const PAGE_SIZE = 25;
const DAY_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_DAYS = 30;
const DASHBOARD_LIMIT = 1000;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

const listSchema = z.strictObject({
  direction: z.enum(CALL_DIRECTIONS).optional(),
  callStatus: z.enum(CALL_STATUSES).optional(),
  outcome: z.enum(CALL_OUTCOMES).optional(),
  source: z.enum(CALL_SOURCES).optional(),
  agent: idSchema.optional(),
  from: date,
  to: date,
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

/** A Dubai calendar day as an instant (the hub shows Dubai dates). */
const dubaiDay = (value: string, nextDay = false) => new Date(Date.parse(`${value}T00:00:00+04:00`) + (nextDay ? DAY_MS : 0)).toISOString();

export async function listCalls(context: Context, query: unknown) {
  const filters = parseInput(listSchema, query);
  if (filters.agent && !isAdministrator(context)) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only owners and administrators can filter by agent.");
  const data = await asMember(context, "ListCalls", (dc, options) => sdk.listCalls(dc, {
    organizationId: context.organizationId, limit: PAGE_SIZE, offset: filters.offset,
    direction: filters.direction ? sdk.CallDirection[filters.direction] : undefined, callStatus: filters.callStatus ? sdk.CallStatus[filters.callStatus] : undefined,
    outcome: filters.outcome ? sdk.CallOutcome[filters.outcome] : undefined, source: filters.source ? sdk.CallSource[filters.source] : undefined,
    agentMembershipId: filters.agent, startedFrom: filters.from ? dubaiDay(filters.from) : undefined, startedBefore: filters.to ? dubaiDay(filters.to, true) : undefined,
  }, options));
  const total = data.total[0]?.count ?? 0;
  return {
    calls: data.calls.map(call => presentCall(context, call)), total, offset: filters.offset, pageSize: PAGE_SIZE, hasMore: filters.offset + PAGE_SIZE < total,
    agents: isAdministrator(context) ? data.agents.map(agent => ({id: agent.id, name: agent.userProfile?.displayName || agent.email})) : [],
    filters, companyWide: isAdministrator(context),
  };
}
export type CallListView = Awaited<ReturnType<typeof listCalls>>;

export async function communicationDashboard(context: Context) {
  const now = new Date();
  const data = await asMember(context, "CommunicationDashboard", (dc, options) => sdk.communicationDashboard(dc, {
    organizationId: context.organizationId, since: new Date(now.getTime() - DASHBOARD_DAYS * DAY_MS).toISOString(), now: now.toISOString(), until: new Date(now.getTime() + 7 * DAY_MS).toISOString(),
  }, options));
  const metricCalls: MetricCall[] = data.calls.map(call => ({
    direction: call.direction as CallDirection, callStatus: call.callStatus as CallStatus, answeredAt: call.answeredAt ?? null, outcome: (call.outcome ?? null) as CallOutcome | null,
    durationSeconds: call.durationSeconds, agentId: call.agentMembershipId, agentName: call.agentMembership.userProfile?.displayName || call.agentMembership.email,
  }));
  const calls = data.calls.map(call => presentCall(context, {...call, notes: null, revision: 0, followUp: null, viewing: null}));
  return {
    periodDays: DASHBOARD_DAYS,
    truncated: data.calls.length >= DASHBOARD_LIMIT,
    companyWide: isAdministrator(context),
    totals: callTotals(metricCalls),
    outcomes: outcomeCounts(metricCalls),
    byAgent: isAdministrator(context) ? totalsByAgent(metricCalls) : [],
    recent: calls.slice(0, 8),
    missed: calls.filter(call => isMissed(call)).slice(0, 8),
    leadCalls: calls.filter(call => call.lead).slice(0, 8),
    needsFollowUp: calls.filter(call => call.followUpRequired && !data.calls.find(row => row.id === call.id)?.followUpId).slice(0, 8),
    followUps: data.followUps,
    viewings: data.viewings,
  };
}
export type CommunicationDashboardView = Awaited<ReturnType<typeof communicationDashboard>>;
