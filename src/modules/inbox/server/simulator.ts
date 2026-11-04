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
import { getFirebaseAdminStorageBucket } from "@/lib/firebase/admin";
import { attachmentFileName, attachmentPath, sniffAttachment } from "../attachments";
import type { NormalizedAttachment } from "../adapters/types";
import { receiveEvent } from "./webhooks";

/*
 * Developer inbox simulator (docs/UNIFIED_INBOX.md#simulator). Developer tools
 * only (never production) and OWNER or ADMIN only. Inbound WhatsApp and email
 * messages go through the real ingestion pipeline on the company's simulator
 * connection; website enquiries go through the real public form path. Senders
 * are fictional (+44 7700 900xxx, example.test) and everything is labelled
 * SIMULATED. Nothing is delivered to a real number or address.
 */

const actor = (context: Context) => context.request.user.uid;
/** Simulator files are small (2 MB); the general attachment limit is 25 MB. */
const SIM_FILE_BYTES = 2 * 1024 * 1024;
const SIM_FILE_BASE64 = Math.ceil(SIM_FILE_BYTES / 3) * 4 + 8;
export const SIMULATOR_BODY_BYTES = SIM_FILE_BASE64 + 16 * 1024;

async function storeSimulatorFile(context: Context, input: {fileName: string; dataBase64: string}): Promise<NormalizedAttachment> {
  const bytes = Buffer.from(input.dataBase64, "base64");
  if (!bytes.byteLength || bytes.byteLength > SIM_FILE_BYTES) throw new WorkspaceError("VALIDATION_ERROR", 400, "Simulator attachments must be between 1 byte and 2 MB.");
  const type = sniffAttachment(bytes, input.fileName);
  if (!type) throw new WorkspaceError("VALIDATION_ERROR", 415, "This file type is not accepted. Attach an image, PDF, Office document, audio or video file.");
  const attachmentId = randomUUID();
  const storagePath = attachmentPath(canonicalUuid(context.organizationId), attachmentId, type.extension);
  await getFirebaseAdminStorageBucket().file(storagePath).save(bytes, {resumable: false, metadata: {contentType: type.mimeType, cacheControl: "private, no-store", metadata: {estateosInboxAttachmentId: attachmentId}}});
  return {providerMediaId: null, mimeType: type.mimeType, fileName: attachmentFileName(input.fileName, type), sizeBytes: bytes.byteLength, stored: {attachmentId, storagePath}};
}

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
  /** A small file to attach (checked by content like any attachment). */
  attachment: z.strictObject({fileName: z.string().trim().min(1).max(200), dataBase64: z.string().min(4).max(SIM_FILE_BASE64)}).optional(),
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
  const attachments = input.attachment && !input.replayOf ? [await storeSimulatorFile(context, input.attachment)] : [];
  const kind = attachments[0]?.mimeType.split("/")[0];
  // The same durable path as a verified provider webhook: recorded once, then applied.
  const outcome = await receiveEvent({organizationId: context.organizationId, id: channel.id, provider: "DEVELOPMENT_SIMULATOR"}, {
    kind: "MESSAGE", accountId: "simulator", channel: input.channel, externalMessageId,
    threadId: input.channel === "WHATSAPP" ? `wa:${identity}` : `mail:${identity}:${(input.subject ?? "").toLowerCase().slice(0, 80)}`,
    from: input.channel === "WHATSAPP" ? {phone, name} : {email, name}, to: "simulator", subject: input.channel === "EMAIL" ? input.subject ?? "(no subject)" : null,
    messageType: kind === "image" ? "IMAGE" : kind === "audio" ? "AUDIO" : kind === "video" ? "VIDEO" : attachments.length ? "DOCUMENT" : "TEXT",
    text: input.text, timestamp: new Date().toISOString(), attachments,
  }, {payloadDigest: null, simulated: true});
  if (outcome.status === "PROCESSED") return {status: outcome.created ? "CREATED" : "APPENDED", conversationId: outcome.conversationId, messageId: outcome.messageId, match: outcome.result, eventId: outcome.eventId, externalMessageId};
  if (outcome.status === "DUPLICATE") return {status: "DUPLICATE", conversationId: outcome.conversationId ?? null, eventId: outcome.eventId, externalMessageId};
  throw new WorkspaceError("INBOX_EVENT_FAILED", 503, `The simulated event was recorded but could not be applied (${outcome.errorCode}); the worker will retry it.`);
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

