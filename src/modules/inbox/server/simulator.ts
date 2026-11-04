import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { asServer, sdk, type Context } from "@/modules/communications/server/data";
import { requireSimulator } from "@/modules/communications/server/simulator";
import { idSchema, parseInput } from "@/modules/communications/server/validation";
import { fictionalNumber } from "@/modules/communications/dev/scenarios";
import { listLeadCaptureForms, submitPublicLead } from "@/modules/lead-capture/server/service";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { ingestInbound } from "./ingest";

/*
 * Developer inbox simulator (docs/UNIFIED_INBOX.md#simulator). Developer tools
 * only (never production) and OWNER or ADMIN only. Inbound WhatsApp and email
 * messages go through the real ingestion pipeline on the company's simulator
 * connection; website enquiries go through the real public form path. Senders
 * are fictional (+44 7700 900xxx, example.test) and everything is labelled
 * SIMULATED. Nothing is delivered to a real number or address.
 */

const actor = (context: Context) => context.request.user.uid;

async function simulatorChannel(context: Context) {
  const data = await asServer("InboxSimulatorChannel", dc => sdk.inboxSimulatorChannel(dc, {organizationId: context.organizationId, actorUid: actor(context)}));
  if (data.connections[0]) return {id: canonicalUuid(data.connections[0].id), conversations: data.conversations};
  const id = randomUUID();
  await asServer("CreateInboxSimulatorChannel", dc => sdk.createInboxSimulatorChannel(dc, {organizationId: context.organizationId, id, actorUid: actor(context)}));
  return {id, conversations: data.conversations};
}

export async function inboxSimulatorState(context: Context) {
  requireSimulator(context);
  const data = await asServer("InboxSimulatorChannel", dc => sdk.inboxSimulatorChannel(dc, {organizationId: context.organizationId, actorUid: actor(context)}));
  return {conversations: data.conversations.map(row => ({...row, id: canonicalUuid(row.id)}))};
}
export type InboxSimulatorView = Awaited<ReturnType<typeof inboxSimulatorState>>;

const inboundSchema = z.strictObject({
  channel: z.enum(["WHATSAPP", "EMAIL"]),
  /** A simulator lead (its fictional number or email), or an unknown fictional sender. */
  leadId: idSchema.optional(),
  text: z.string().trim().min(1).max(4000),
  subject: z.string().trim().max(200).optional(),
  /** Deliver an earlier simulated message again, exactly as a provider retry would. */
  replayOf: z.string().max(200).optional(),
});

export async function simulateInbound(context: Context, body: unknown) {
  requireSimulator(context);
  const input = parseInput(inboundSchema, body);
  const channel = await simulatorChannel(context);
  let phone: string, email: string, name: string | null = null;
  if (input.leadId) {
    const state = await asServer("CommunicationSimulationState", dc => sdk.communicationSimulationState(dc, {organizationId: context.organizationId, actorUid: actor(context)}));
    const record = state.records.find(row => canonicalUuid(row.leadId) === input.leadId);
    if (!record) throw new WorkspaceError("VALIDATION_ERROR", 400, "Simulated messages can only come from the simulator's own fictional leads, or an unknown fictional sender.");
    phone = record.lead.phone ?? "";
    email = record.lead.email ?? "";
    name = record.lead.fullName;
  } else {
    const seed = Math.floor(Math.random() * 1000);
    phone = fictionalNumber(seed);
    email = `unknown-${seed}@example.test`;
  }
  const identity = input.channel === "WHATSAPP" ? phone.replace(/\s/g, "") : email;
  const externalMessageId = input.replayOf ?? `sim-${randomUUID()}`;
  const result = await ingestInbound({
    organizationId: context.organizationId, channelConnectionId: channel.id, channel: input.channel,
    externalThreadId: input.channel === "WHATSAPP" ? `wa:${identity}` : `mail:${identity}:${(input.subject ?? "").toLowerCase().slice(0, 80)}`,
    externalMessageId, from: input.channel === "WHATSAPP" ? {phone, name} : {email, name}, to: "simulator", subject: input.channel === "EMAIL" ? input.subject ?? "(no subject)" : null,
    messageType: "TEXT", content: input.text, providerTimestamp: new Date().toISOString(), simulated: true,
  });
  return {...result, externalMessageId};
}

const websiteSchema = z.strictObject({message: z.string().trim().min(1).max(4000), formId: idSchema.optional()});

/** A website enquiry from a fictional visitor through the real public form path, then registered and labelled as simulated. */
export async function simulateWebsiteEnquiry(context: Context, body: unknown) {
  requireSimulator(context);
  const input = parseInput(websiteSchema, body);
  const forms = (await listLeadCaptureForms() as unknown as {forms: Array<{id: string; publicId: string; status: string}>}).forms.filter(form => form.status === "ACTIVE");
  const form = input.formId ? forms.find(item => canonicalUuid(item.id) === input.formId) : forms[0];
  if (!form) throw new WorkspaceError("VALIDATION_ERROR", 400, "Create and activate a lead capture form first (Leads, then Lead capture forms).");
  const tag = randomUUID().slice(0, 4).toUpperCase();
  const phone = fictionalNumber(Number.parseInt(tag, 16));
  const result = await submitPublicLead({publicId: form.publicId, idempotencyKey: `sim-${randomUUID()}`, rawBody: {
    fields: {FULL_NAME: `[SIM] Website visitor ${tag}`, EMAIL: `sim-web-${tag.toLowerCase()}@example.test`, PHONE: phone, MESSAGE: input.message}, consent: true, elapsedMs: 8000,
  }});
  const leadId = "leadId" in result && result.leadId ? canonicalUuid(result.leadId) : null;
  if (!leadId) return {accepted: result.accepted, pending: result.pending, leadId: null};
  await asServer("RegisterSimulationLead", dc => sdk.registerSimulationLead(dc, {organizationId: context.organizationId, id: randomUUID(), actorUid: actor(context), leadId, label: `Simulated website visitor ${tag}`}));
  await asServer("MarkInboxLeadConversationsSimulated", dc => sdk.markInboxLeadConversationsSimulated(dc, {organizationId: context.organizationId, actorUid: actor(context), leadId}));
  return {accepted: true, pending: false, leadId};
}

export async function resetInboxSimulation(context: Context) {
  requireSimulator(context);
  const result = await asServer("ResetInboxSimulation", dc => sdk.resetInboxSimulation(dc, {organizationId: context.organizationId, actorUid: actor(context)}));
  return {conversations: result.conversations, messages: result.messages};
}

