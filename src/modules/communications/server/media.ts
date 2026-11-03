import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getFirebaseAdminStorageBucket } from "@/lib/firebase/admin";
import { enforceRateLimit } from "@/lib/rate-limit/server";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import {
  MAX_RECORDING_SECONDS, RECORDING_DURATION_TOLERANCE_SECONDS, TranscriptFormatError, audioFacts, detectLanguage, parseTranscript, type ParsedTranscript, type TranscriptSegment,
} from "../media";
import { asMember, asServer, isAdministrator, sdk, serverDataConnect, type Context } from "./data";
import { idSchema, parseInput } from "./validation";

/*
 * Consent, recordings and transcripts (docs/CALL_PRIVACY_COMPLIANCE.md#recording-transcripts-and-consent).
 * - Nothing is recorded by EstateOS: agents upload a recording or transcript
 *   their approved phone or transcription service produced, only when the
 *   company enabled recording and the call has current consent evidence.
 * - Files are checked by content, stored privately under paths built here, and
 *   served only through routes that re-check the member and audit the access.
 * - Withdrawing consent, deleting, or reaching the retention date removes them.
 */

const UPLOAD_RULE = {scope: "communications.media.upload", limit: 20, windowSeconds: 3600};
const CONSENT_STATUSES = ["NOTICE_GIVEN", "GIVEN", "DECLINED"] as const;
const CONSENT_METHODS = ["VERBAL_ON_CALL", "ANNOUNCEMENT", "WRITTEN"] as const;
const ACTIVE_CONSENT = new Set(["NOTICE_GIVEN", "GIVEN"]);

const mediaRoot = (organizationId: string, callId: string) => `organizations/${canonicalUuid(organizationId)}/communications/calls/${canonicalUuid(callId)}`;

export async function callMedia(context: Context, rawCallId: string) {
  const callId = parseInput(idSchema, rawCallId);
  const data = await asMember(context, "GetCallMedia", (dc, options) => sdk.getCallMedia(dc, {organizationId: context.organizationId, callId}, options));
  if (!data.call) throw new WorkspaceError("NOT_FOUND", 404, "This call was not found.");
  const canEdit = isAdministrator(context) || data.call.agentMembershipId === context.membership.id;
  const answered = data.call.callStatus === "COMPLETED" || data.call.callStatus === "IN_PROGRESS";
  const activeConsent = data.consents.filter(item => ACTIVE_CONSENT.has(item.status));
  return {
    recordingEnabled: Boolean(data.settings?.recordingEnabled),
    noticeText: data.settings?.recordingNoticeText ?? null,
    legalBasis: data.settings?.recordingLegalBasis ?? null,
    retentionDays: data.settings?.retentionDays ?? 90,
    answered, canEdit, canDelete: isAdministrator(context),
    canRecordConsent: canEdit && answered && Boolean(data.settings?.recordingEnabled),
    canUpload: canEdit && data.call.callStatus === "COMPLETED" && Boolean(data.settings?.recordingEnabled) && activeConsent.length > 0,
    consents: data.consents, recordings: data.recordings, transcripts: data.transcripts,
  };
}
export type CallMediaView = Awaited<ReturnType<typeof callMedia>>;

export async function recordConsent(context: Context, rawCallId: string, body: unknown) {
  const callId = parseInput(idSchema, rawCallId);
  const input = parseInput(z.strictObject({status: z.enum(CONSENT_STATUSES), method: z.enum(CONSENT_METHODS), note: z.string().trim().max(500).nullable().default(null).transform(value => value || null)}), body);
  const id = randomUUID();
  await asMember(context, "RecordCallConsent", (dc, options) => sdk.recordCallConsent(dc, {organizationId: context.organizationId, id, callId, status: sdk.CallConsentStatus[input.status], method: input.method, note: input.note}, options));
  return {id};
}

export async function withdrawConsent(context: Context, rawId: string, body: unknown) {
  const id = parseInput(idSchema, rawId);
  const {note} = parseInput(z.strictObject({note: z.string().trim().min(3).max(500)}), body);
  await asMember(context, "WithdrawCallConsent", (dc, options) => sdk.withdrawCallConsent(dc, {organizationId: context.organizationId, id, note}, options));
  // The recordings and transcripts that relied on it are deleted in the same transaction; remove their files now.
  await removeDeletedFiles(20).catch(() => undefined);
  return {id, withdrawn: true};
}

/** Checks, before anything is stored, that the member may add media to this call and which consent it relies on. */
async function uploadTarget(context: Context, callId: string, consentEvidenceId: string) {
  const media = await callMedia(context, callId);
  if (!media.recordingEnabled) throw new WorkspaceError("RECORDING_NOT_ENABLED", 409, "Recording is not enabled for your company.");
  if (!media.canEdit) throw new WorkspaceError("PERMISSION_DENIED", 403, "Only the call's agent, or an owner or administrator, can add a recording or transcript.");
  if (!media.canUpload) throw new WorkspaceError("CALL_CONSENT_REQUIRED", 409, "Record the customer's notice or consent for this answered call first.");
  const consent = media.consents.find(item => canonicalUuid(item.id) === consentEvidenceId && ACTIVE_CONSENT.has(item.status));
  if (!consent) throw new WorkspaceError("CALL_CONSENT_REQUIRED", 409, "Choose current consent evidence for this call.");
  return media;
}

export async function uploadRecording(context: Context, rawCallId: string, rawConsentId: string | null, bytes: Uint8Array) {
  const callId = parseInput(idSchema, rawCallId);
  const consentEvidenceId = parseInput(idSchema, rawConsentId ?? "");
  await enforceRateLimit([{rule: UPLOAD_RULE, subject: context.membership.id}], "You are uploading too many files. Wait a while and try again.");
  const facts = audioFacts(bytes);
  if (!facts) throw new WorkspaceError("VALIDATION_ERROR", 415, "Upload a WAV (PCM) or MP3 recording.");
  if (facts.durationSeconds <= 0 || facts.durationSeconds > MAX_RECORDING_SECONDS) throw new WorkspaceError("VALIDATION_ERROR", 400, "Recordings must be between 1 second and 4 hours long.");
  await uploadTarget(context, callId, consentEvidenceId);
  const {call} = await asMember(context, "GetCallRecord", (dc, options) => sdk.getCallRecord(dc, {organizationId: context.organizationId, id: callId}, options));
  if (call && call.durationSeconds > 0 && facts.durationSeconds > call.durationSeconds + RECORDING_DURATION_TOLERANCE_SECONDS) {
    throw new WorkspaceError("VALIDATION_ERROR", 400, "The recording is longer than the call. Check that it is the right file, or correct the call's duration.");
  }
  const id = randomUUID();
  const storagePath = `${mediaRoot(context.organizationId, callId)}/recordings/${id}.${facts.extension}`;
  const file = getFirebaseAdminStorageBucket().file(storagePath);
  await file.save(Buffer.from(bytes), {resumable: false, metadata: {contentType: facts.contentType, cacheControl: "private, no-store", metadata: {estateosCallRecordingId: id}}});
  try {
    await asServer("CreateCallRecording", dc => sdk.createCallRecording(dc, {organizationId: context.organizationId, id, callId, consentEvidenceId, actorUid: context.request.user.uid, source: "UPLOAD",
      storagePath, contentType: facts.contentType, byteSize: bytes.byteLength, durationSeconds: facts.durationSeconds, recordedAt: call?.startedAt ?? new Date().toISOString()}));
  } catch (error) {
    await file.delete({ignoreNotFound: true}).catch(() => undefined);
    throw error;
  }
  return {id, durationSeconds: facts.durationSeconds, contentType: facts.contentType};
}

const transcriptSchema = z.strictObject({
  consentEvidenceId: idSchema,
  sourceName: z.string().trim().min(2).max(80),
  content: z.string().min(1).max(1_100_000),
});

export async function uploadTranscript(context: Context, rawCallId: string, body: unknown) {
  const callId = parseInput(idSchema, rawCallId);
  const input = parseInput(transcriptSchema, body);
  await enforceRateLimit([{rule: UPLOAD_RULE, subject: context.membership.id}], "You are uploading too many files. Wait a while and try again.");
  let parsed: ParsedTranscript;
  try { parsed = parseTranscript(input.content); } catch (error) {
    if (error instanceof TranscriptFormatError) throw new WorkspaceError("VALIDATION_ERROR", 400, error.message);
    throw error;
  }
  await uploadTarget(context, callId, input.consentEvidenceId);
  const id = randomUUID();
  const language = detectLanguage(parsed.segments.map(segment => segment.text).join(" "));
  const transcriptReference = `${mediaRoot(context.organizationId, callId)}/transcripts/${id}.json`;
  const file = getFirebaseAdminStorageBucket().file(transcriptReference);
  const document = {format: parsed.format, language, sourceName: input.sourceName, segments: parsed.segments};
  await file.save(Buffer.from(JSON.stringify(document)), {resumable: false, metadata: {contentType: "application/json", cacheControl: "private, no-store", metadata: {estateosCallTranscriptId: id}}});
  try {
    await asServer("CreateCallTranscript", dc => sdk.createCallTranscript(dc, {organizationId: context.organizationId, id, callId, consentEvidenceId: input.consentEvidenceId, actorUid: context.request.user.uid,
      source: sdk.TranscriptSource.UPLOAD, sourceName: input.sourceName, language, transcriptReference, segmentCount: parsed.segments.length, hasTimestamps: parsed.hasTimestamps, generatedAt: new Date().toISOString()}));
  } catch (error) {
    await file.delete({ignoreNotFound: true}).catch(() => undefined);
    throw error;
  }
  return {id, segmentCount: parsed.segments.length, language, hasTimestamps: parsed.hasTimestamps};
}

/** The recording's bytes for a member who may read the call; every access is audited. */
export async function recordingFile(context: Context, rawId: string) {
  const id = parseInput(idSchema, rawId);
  const {recording} = await asMember(context, "GetCallRecordingFile", (dc, options) => sdk.getCallRecordingFile(dc, {organizationId: context.organizationId, id}, options));
  if (!recording) throw new WorkspaceError("NOT_FOUND", 404, "This recording was not found.");
  const [bytes] = await getFirebaseAdminStorageBucket().file(recording.storagePath).download();
  await asServer("RecordCallMediaAccess", dc => sdk.recordCallMediaAccess(dc, {organizationId: context.organizationId, actorUid: context.request.user.uid, targetType: sdk.AuditTargetType.CALL_RECORDING, targetId: id}));
  return {bytes, contentType: recording.contentType};
}

export async function transcriptFile(context: Context, rawId: string) {
  const id = parseInput(idSchema, rawId);
  const {transcript} = await asMember(context, "GetCallTranscriptFile", (dc, options) => sdk.getCallTranscriptFile(dc, {organizationId: context.organizationId, id}, options));
  if (!transcript) throw new WorkspaceError("NOT_FOUND", 404, "This transcript was not found.");
  const [bytes] = await getFirebaseAdminStorageBucket().file(transcript.transcriptReference).download();
  const document = JSON.parse(bytes.toString("utf8")) as {segments: TranscriptSegment[]};
  await asServer("RecordCallMediaAccess", dc => sdk.recordCallMediaAccess(dc, {organizationId: context.organizationId, actorUid: context.request.user.uid, targetType: sdk.AuditTargetType.CALL_TRANSCRIPT, targetId: id}));
  return {id, callId: transcript.callId, language: transcript.language, source: transcript.source, sourceName: transcript.sourceName ?? null, hasTimestamps: transcript.hasTimestamps, generatedAt: transcript.generatedAt, segments: document.segments};
}

export async function deleteRecording(context: Context, rawId: string) {
  const id = parseInput(idSchema, rawId);
  await asMember(context, "DeleteCallRecording", (dc, options) => sdk.deleteCallRecording(dc, {organizationId: context.organizationId, id}, options));
  await removeFile(context.organizationId, id, true).catch(() => undefined);
  return {id, deleted: true};
}

export async function deleteTranscript(context: Context, rawId: string) {
  const id = parseInput(idSchema, rawId);
  await asMember(context, "DeleteCallTranscript", (dc, options) => sdk.deleteCallTranscript(dc, {organizationId: context.organizationId, id}, options));
  await removeFile(context.organizationId, id, false).catch(() => undefined);
  return {id, deleted: true};
}

async function removeFile(organizationId: string, id: string, isRecording: boolean) {
  const dc = serverDataConnect();
  const row = (await sdk.deletedCallMediaFile(dc, {organizationId, id})).data;
  const path = isRecording ? row.recording?.status === "DELETED" ? row.recording.storagePath : null : row.transcript?.status === "DELETED" ? row.transcript.transcriptReference : null;
  if (!path) return;
  await getFirebaseAdminStorageBucket().file(path).delete({ignoreNotFound: true});
  await sdk.markCallMediaFileDeleted(dc, {organizationId, recordingId: isRecording ? id : null, transcriptId: isRecording ? null : id, isRecording});
}

/** Removes the files of deleted media (deleted, withdrawn or past retention). */
async function removeDeletedFiles(limit: number) {
  const dc = serverDataConnect();
  const due = (await sdk.callMediaToRemove(dc, {now: new Date().toISOString(), limit})).data;
  let removed = 0;
  for (const item of due.deletedRecordings) { await removeFile(item.organizationId, item.id, true); removed += 1; }
  for (const item of due.deletedTranscripts) { await removeFile(item.organizationId, item.id, false); removed += 1; }
  return removed;
}

/**
 * Worker tick (docs/AUTOMATION_OPERATIONS.md#worker): expires recordings and
 * transcripts past their retention date and removes deleted files, in small
 * batches. Safe to repeat: each step only acts on rows still in that state.
 */
export async function runCommunicationMaintenance(limit = 25) {
  const dc = serverDataConnect();
  const due = (await sdk.callMediaToRemove(dc, {now: new Date().toISOString(), limit})).data;
  let expired = 0;
  for (const item of due.expiredRecordings) { await sdk.expireCallRecording(dc, {organizationId: item.organizationId, id: item.id}).then(() => { expired += 1; }, () => undefined); }
  for (const item of due.expiredTranscripts) { await sdk.expireCallTranscript(dc, {organizationId: item.organizationId, id: item.id}).then(() => { expired += 1; }, () => undefined); }
  const filesRemoved = await removeDeletedFiles(limit);
  return {expired, filesRemoved};
}
