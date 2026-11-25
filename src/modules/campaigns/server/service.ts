import "server-only";

import { randomUUID } from "node:crypto";
import * as sdk from "@dataconnect/admin-generated";
import { z } from "zod";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { campaignKey } from "@/modules/lead-capture/attribution";
import { localDateStartUtc } from "@/modules/lead-capture/reporting-policy";
import { crmMutationContext } from "@/modules/leads/server/crm-service";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { validateInput } from "@/modules/organizations/server/validation";
import {
  CAMPAIGN_PLATFORMS, CAMPAIGN_STATUSES, addSpendSchema, campaignRows, campaignTotals, createCampaignSchema, updateCampaignSchema, updateSpendSchema,
  type CampaignStatus,
} from "../model";

/*
 * Phase 7F.1: campaigns and cost per lead (docs/CAMPAIGNS_PLAN.md). Owners, administrators and managers read
 * campaigns and spend; owners and administrators change them; agents never see spend. Every operation runs as the
 * signed-in member, and the database checks the role again. The company always comes from the member's context.
 */

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;
const TIME_ZONE = "Asia/Dubai";
const canView = (context: Context) => ["OWNER", "ADMIN", "MANAGER"].includes(context.membership.role);
const canManage = (context: Context) => ["OWNER", "ADMIN"].includes(context.membership.role);
function assertView(context: Context) {
  if (!canView(context)) throw new WorkspaceError("PERMISSION_DENIED", 403, "Campaigns and spend are for owners, administrators and managers.");
}
async function manageContext(expectedOrganizationId: string | null) {
  const context = await crmMutationContext(expectedOrganizationId);
  if (!canManage(context)) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only owners and administrators can change campaigns and spend.");
  return context;
}

// --- Period -----------------------------------------------------------------------------------------------------

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
function shift(value: string, days: number) {
  const d = new Date(Date.parse(`${value}T00:00:00Z`) + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}
const pageSchema = z.object({
  from: z.iso.date().optional(), to: z.iso.date().optional(),
  status: z.enum(CAMPAIGN_STATUSES).or(z.literal("")).optional(), platform: z.enum(CAMPAIGN_PLATFORMS).or(z.literal("")).optional(),
});

/** The chosen days (Dubai calendar), last 30 days by default, at most 366 days; and their instants. */
export function campaignPeriod(input: unknown) {
  const parsed = validateInput(pageSchema, input);
  const to = parsed.to ?? today();
  const from = parsed.from ?? shift(to, -29);
  if (from > to || (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 > 365) {
    throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose a date range of at most 366 days, ending on or after its start.");
  }
  return {
    from, to, status: parsed.status || "", platform: parsed.platform || "",
    fromInstant: localDateStartUtc(from, TIME_ZONE).toISOString(), toInstant: localDateStartUtc(shift(to, 1), TIME_ZONE).toISOString(),
  };
}

async function performance(context: Context, period: ReturnType<typeof campaignPeriod>, key: string | null) {
  const data = await executeWorkspaceOperation(() => sdk.campaignPerformance(context.request.dc, {
    organizationId: context.organizationId, fromDate: period.from, toDate: period.to, from: period.fromInstant, to: period.toInstant, campaignKey: key,
  }, context.request.options), "CampaignPerformance");
  return campaignRows(data.campaigns, data.spend);
}

async function owners(context: Context) {
  if (!canManage(context)) return [];
  const data = await executeWorkspaceOperation(() => sdk.campaignOwners(context.request.dc, { organizationId: context.organizationId }, context.request.options), "CampaignOwners");
  return data.members.map(member => ({ id: canonicalUuid(member.id), label: member.userProfile?.displayName || member.email }));
}

// --- Reads ------------------------------------------------------------------------------------------------------

/** The Marketing page: every campaign (with a record or found in leads) for the chosen days, filtered and totalled. */
export async function getCampaignsPage(params: Record<string, string | undefined>) {
  const context = await requireActiveOrganizationRequest();
  assertView(context);
  const period = campaignPeriod(params);
  const [all, members] = await Promise.all([performance(context, period, null), owners(context)]);
  // A campaign found only in leads has no status yet: it counts as active.
  const rows = all.filter(row => (!period.status || (row.status ?? "ACTIVE") === period.status) && (!period.platform || row.platform === period.platform));
  return {
    organization: { id: canonicalUuid(context.organizationId), name: context.organization.name },
    role: context.membership.role, canManage: canManage(context), period, rows, totals: campaignTotals(rows), owners: members,
  };
}
export type CampaignsPageData = Awaited<ReturnType<typeof getCampaignsPage>>;

/** One campaign: its record (if it has one), figures for the chosen days, spend entries and leads by channel. */
export async function getCampaignPage(rawKey: string, params: Record<string, string | undefined>) {
  const context = await requireActiveOrganizationRequest();
  assertView(context);
  const key = validateInput(z.string().trim().min(1).max(200), rawKey);
  const period = campaignPeriod(params);
  const [rows, detail, members] = await Promise.all([
    performance(context, period, key),
    executeWorkspaceOperation(() => sdk.getCampaign(context.request.dc, { organizationId: context.organizationId, campaignKey: key }, context.request.options), "GetCampaign"),
    owners(context),
  ]);
  const row = rows[0];
  if (!row) throw new WorkspaceError("NOT_FOUND", 404, "This campaign was not found.");
  const record = detail.campaign ?? null;
  const channels = (Array.isArray(detail.channels) ? detail.channels : []).flatMap(item => {
    const value = item as Record<string, unknown>;
    return typeof value.channel === "string" ? [{ channel: value.channel, leads: Number(value.leads ?? 0) || 0 }] : [];
  });
  return {
    organization: { id: canonicalUuid(context.organizationId), name: context.organization.name },
    canManage: canManage(context), period, row, channels, owners: members,
    record: record ? {
      id: canonicalUuid(record.id), revision: record.revision, name: record.name, platform: record.platform ?? null, status: record.status as CampaignStatus,
      startsOn: record.startsOn ?? null, endsOn: record.endsOn ?? null, budgetMinor: record.budgetMinor == null ? null : Number(record.budgetMinor), currency: record.currency,
      ownerMembershipId: record.ownerMembershipId ? canonicalUuid(record.ownerMembershipId) : null,
      ownerName: record.ownerMembership ? record.ownerMembership.userProfile?.displayName || record.ownerMembership.email : null,
      notes: record.notes ?? null, metaCampaignId: record.metaCampaignId ?? null, googleCampaignId: record.googleCampaignId ?? null, tiktokCampaignId: record.tiktokCampaignId ?? null,
      entries: record.entries.map(entry => ({
        id: canonicalUuid(entry.id), source: entry.source, spentFrom: entry.spentFrom, spentTo: entry.spentTo, amountMinor: Number(entry.amountMinor), currency: entry.currency,
        note: entry.note ?? null, impressions: entry.impressions == null ? null : Number(entry.impressions), clicks: entry.clicks == null ? null : Number(entry.clicks),
      })),
    } : null,
  };
}
export type CampaignPageData = Awaited<ReturnType<typeof getCampaignPage>>;

/** Phase 7F.1: spend and cost per lead by campaign key for the Reports page (owners and administrators only). */
export async function campaignSpendForReport(context: Context, period: { from: string; to: string; fromInstant: string; toInstant: string }) {
  if (!canManage(context)) return null;
  const rows = await performance(context, { ...period, status: "", platform: "" }, null);
  return new Map(rows.map(row => [row.key, row.spend]));
}

// --- Changes ----------------------------------------------------------------------------------------------------

const optional = <T>(value: T | null | undefined) => value ?? null;
function campaignVariables(input: z.infer<typeof createCampaignSchema>) {
  return {
    name: input.name, platform: optional(input.platform), status: sdk.CampaignStatus[input.status], startsOn: optional(input.startsOn), endsOn: optional(input.endsOn),
    budgetMinor: input.budget == null ? null : String(input.budget), currency: input.currency, hasOwner: Boolean(input.ownerMembershipId), ownerMembershipId: optional(input.ownerMembershipId),
    notes: optional(input.notes), metaCampaignId: optional(input.metaCampaignId), googleCampaignId: optional(input.googleCampaignId), tiktokCampaignId: optional(input.tiktokCampaignId),
  };
}
/** A campaign's owner must be an active member of the company (the database's foreign key checks the company too). */
async function assertOwner(context: Context, ownerMembershipId: string | null | undefined) {
  if (!ownerMembershipId) return;
  if (!(await owners(context)).some(owner => owner.id === canonicalUuid(ownerMembershipId))) {
    throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose an active member of your company as the campaign's owner.");
  }
}
const isDuplicate = (error: unknown) => (error as { code?: unknown })?.code === "data-connect/already-exists" || /duplicate key|already exists/i.test(String((error as Error)?.message ?? ""));

/** A campaign added before any lead arrives. Its key comes from its name, so leads tagged with that name join it. */
export async function createCampaign(input: unknown, expectedOrganizationId: string | null) {
  const context = await manageContext(expectedOrganizationId);
  const parsed = validateInput(createCampaignSchema, input);
  const key = campaignKey(parsed.name);
  if (!key) throw new WorkspaceError("VALIDATION_ERROR", 400, "Enter the campaign's name.");
  await assertOwner(context, parsed.ownerMembershipId);
  const id = randomUUID();
  try {
    await executeWorkspaceOperation(() => sdk.createCampaign(context.request.dc, { organizationId: context.organizationId, id, campaignKey: key, ...campaignVariables(parsed) }, context.request.options), "CreateCampaign");
  } catch (error) {
    if (error instanceof WorkspaceError && error.status === 409) throw new WorkspaceError("CONFLICT", 409, "A campaign with this name already exists. Open it from the list instead.");
    throw error;
  }
  return { campaign: { id, key } };
}

/** Details for a campaign; its key never changes, so its leads stay with it. */
export async function updateCampaign(input: unknown, expectedOrganizationId: string | null) {
  const context = await manageContext(expectedOrganizationId);
  const parsed = validateInput(updateCampaignSchema, input);
  await assertOwner(context, parsed.ownerMembershipId);
  await executeWorkspaceOperation(() => sdk.updateCampaign(context.request.dc, {
    organizationId: context.organizationId, id: parsed.id, expectedRevision: parsed.expectedRevision, ...campaignVariables(parsed),
  }, context.request.options), "UpdateCampaign");
  return { campaign: { id: parsed.id, revision: parsed.expectedRevision + 1 } };
}

/**
 * Gives a campaign found only in leads a record (named by its newest name), so details and spend can be added.
 * Only keys the company's leads actually carry are accepted.
 */
async function ensureCampaign(context: Context, key: string) {
  const existing = await executeWorkspaceOperation(() => sdk.getCampaign(context.request.dc, { organizationId: context.organizationId, campaignKey: key }, context.request.options), "GetCampaign");
  if (existing.campaign) return { id: canonicalUuid(existing.campaign.id), currency: existing.campaign.currency };
  const today = new Date().toISOString();
  const [row] = await performance(context, { from: "2000-01-01", to: today.slice(0, 10), fromInstant: "2000-01-01T00:00:00.000Z", toInstant: today, status: "", platform: "" }, key);
  if (!row) throw new WorkspaceError("NOT_FOUND", 404, "This campaign was not found.");
  const id = randomUUID();
  const platform = (CAMPAIGN_PLATFORMS as readonly string[]).includes(row.platform ?? "") ? row.platform : null;
  try {
    await executeWorkspaceOperation(() => sdk.createCampaign(context.request.dc, {
      organizationId: context.organizationId, id, campaignKey: key, name: row.name.slice(0, 200), platform, status: sdk.CampaignStatus.ACTIVE, startsOn: null, endsOn: null,
      budgetMinor: null, currency: "AED", hasOwner: false, ownerMembershipId: null, notes: null, metaCampaignId: null, googleCampaignId: null, tiktokCampaignId: null,
    }, context.request.options), "CreateCampaign");
  } catch (error) {
    // Another member gave it a record a moment ago.
    if (!(error instanceof WorkspaceError && error.status === 409) && !isDuplicate(error)) throw error;
    return ensureCampaign(context, key);
  }
  return { id, currency: "AED" };
}

/** Spend entered by hand for a period. A campaign's entries never overlap; the database checks it. */
export async function addCampaignSpend(input: unknown, expectedOrganizationId: string | null) {
  const context = await manageContext(expectedOrganizationId);
  const parsed = validateInput(addSpendSchema, input);
  const campaignId = parsed.campaignId ?? (await ensureCampaign(context, parsed.campaignKey!)).id;
  const id = randomUUID();
  await executeWorkspaceOperation(() => sdk.addCampaignSpend(context.request.dc, {
    organizationId: context.organizationId, id, campaignId, spentFrom: parsed.spentFrom, spentTo: parsed.spentTo, amountMinor: String(parsed.amount), currency: parsed.currency, note: optional(parsed.note),
  }, context.request.options), "AddCampaignSpend");
  return { spend: { id, campaignId } };
}

export async function updateCampaignSpend(input: unknown, expectedOrganizationId: string | null) {
  const context = await manageContext(expectedOrganizationId);
  const parsed = validateInput(updateSpendSchema, input);
  await executeWorkspaceOperation(() => sdk.updateCampaignSpend(context.request.dc, {
    organizationId: context.organizationId, id: parsed.id, spentFrom: parsed.spentFrom, spentTo: parsed.spentTo, amountMinor: String(parsed.amount), currency: parsed.currency, note: optional(parsed.note),
  }, context.request.options), "UpdateCampaignSpend");
  return { spend: { id: parsed.id } };
}

export async function deleteCampaignSpend(input: unknown, expectedOrganizationId: string | null) {
  const context = await manageContext(expectedOrganizationId);
  const parsed = validateInput(z.strictObject({ id: z.uuid() }), input);
  await executeWorkspaceOperation(() => sdk.deleteCampaignSpend(context.request.dc, { organizationId: context.organizationId, id: parsed.id }, context.request.options), "DeleteCampaignSpend");
  return { spend: { id: parsed.id, deleted: true } };
}
