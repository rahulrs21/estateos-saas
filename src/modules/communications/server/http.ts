import "server-only";

import { cookies } from "next/headers";
import { connection } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertExpectedOrganization, parseWorkspaceJsonRequest } from "@/lib/http/request-policy";
import { authCookies, getAppOrigin } from "@/modules/auth/server/config";
import { authJson } from "@/modules/auth/server/http";
import { validateMutationRequest } from "@/modules/auth/server/request-policy";
import { authorizeLeadRead, leadErrorResponse } from "@/modules/leads/server/http";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { contactCallsView, getCall, leadCallsView, logCall, updateCall } from "./calls";
import { addSuppression, getCommunicationSettings, listSuppressions, saveCommunicationSettings, withdrawSuppression } from "./settings";
import type { Context } from "./data";
import { endLiveCall, startLiveCall } from "./dial";
import { communicationDashboard, listCalls } from "./hub";
import {
  attestLiveCalling, confirmLineRegistration, createLine, createProvider, providerSettings, revokeLiveCalling, setLineActive, setProviderEnabled, updateLine, updateProvider, verifyProvider,
} from "./providers";
import { callMedia, deleteRecording, deleteTranscript, recordConsent, recordingFile, transcriptFile, uploadRecording, uploadTranscript, withdrawConsent } from "./media";
import { callSummaries, decideSuggestion, generateCallSummary, reviewCallSummary } from "./intelligence";
import { createMeeting, decideMeetingSuggestion, getMeeting, listMeetings, meetingAttendeeOptions, setMeetingStatus, summarizeMeeting, updateMeeting } from "./meetings";
import { communicationReport } from "./reports";
import { endVoiceTest, interruptVoiceTurn, saveVoiceAssistant, startVoiceTest, voiceAssistantView, voiceTestSession, voiceTurn } from "./voice";
import { providerWebhookResponse } from "./webhooks";
import { MAX_RECORDING_BYTES } from "../media";

/*
 * Communication endpoints (docs/COMMUNICATION_HUB.md#api). Reads need a
 * verified session; mutations also need same-origin, the CSRF token and the
 * X-EstateOS-Organization header matching the server-resolved company. The
 * company always comes from the session, never from the request.
 */

const BODY_BYTES = 16 * 1024;

function errorResponse(endpoint: string, error: unknown) {
  if (!(error instanceof WorkspaceError)) {
    const detail = process.env.NODE_ENV !== "production" && error instanceof Error ? error.message.slice(0, 300) : undefined;
    console.error(JSON.stringify({event: "communications.unexpected_error", endpoint, name: error instanceof Error ? error.name : typeof error, ...(detail ? {detail} : {})}));
  }
  return leadErrorResponse(error);
}

async function readContext(request: Request) {
  await authorizeLeadRead(request);
  return requireActiveOrganizationRequest();
}

async function mutationContext(request: Request, maxBytes = BODY_BYTES) {
  validateMutationRequest(request, {origin: getAppOrigin(), csrfToken: (await cookies()).get(authCookies().csrf.name)?.value});
  if (!await getSession()) throw new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
  const body = await parseWorkspaceJsonRequest(request, maxBytes);
  const context = await requireActiveOrganizationRequest();
  assertExpectedOrganization(request.headers.get("x-estateos-organization"), context.organizationId);
  return {body, context};
}

function searchParams(request: Request) {
  const input: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    if (key in input) throw new WorkspaceError("VALIDATION_ERROR", 400, "Each filter must have a single value.");
    input[key] = value;
  }
  return input;
}

async function read(request: Request, endpoint: string, work: (context: Context, query: Record<string, string>) => Promise<unknown>) {
  await connection();
  try { return authJson({data: await work(await readContext(request), searchParams(request))}); } catch (error) { return errorResponse(endpoint, error); }
}

async function write(request: Request, endpoint: string, work: (context: Context, body: unknown) => Promise<unknown>, status = 200, maxBytes = BODY_BYTES) {
  try { const {body, context} = await mutationContext(request, maxBytes); return authJson({data: await work(context, body)}, status); } catch (error) { return errorResponse(endpoint, error); }
}

export const leadCallsResponse = (request: Request, leadId: string) => read(request, "lead.calls", (context, query) => leadCallsView(context, leadId, query));
export const contactCallsResponse = (request: Request, contactId: string) => read(request, "contact.calls", (context, query) => contactCallsView(context, contactId, query));
export const logCallResponse = (request: Request) => write(request, "call.log", logCall, 201);
export const getCallResponse = (request: Request, id: string) => read(request, "call.get", context => getCall(context, id));
export const updateCallResponse = (request: Request, id: string) => write(request, "call.update", (context, body) => updateCall(context, id, body));
export const settingsResponse = (request: Request) => read(request, "settings.get", context => getCommunicationSettings(context));
export const saveSettingsResponse = (request: Request) => write(request, "settings.save", saveCommunicationSettings);
export const suppressionsResponse = (request: Request) => read(request, "suppressions.list", context => listSuppressions(context));
export const addSuppressionResponse = (request: Request) => write(request, "suppressions.add", addSuppression, 201);
export const withdrawSuppressionResponse = (request: Request, id: string) => write(request, "suppressions.withdraw", (context, body) => withdrawSuppression(context, id, body));
export const listCallsResponse = (request: Request) => read(request, "calls.list", listCalls);
export const dashboardResponse = (request: Request) => read(request, "dashboard", context => communicationDashboard(context));
export const dialResponse = (request: Request) => write(request, "call.dial", startLiveCall);
export const endCallResponse = (request: Request, id: string) => write(request, "call.end", context => endLiveCall(context, id));
export const providersResponse = (request: Request) => read(request, "providers.get", context => providerSettings(context));
export const createProviderResponse = (request: Request) => write(request, "providers.create", createProvider, 201);
export const updateProviderResponse = (request: Request, id: string) => write(request, "providers.update", (context, body) => updateProvider(context, id, body));
export const providerEnabledResponse = (request: Request, id: string) => write(request, "providers.enabled", (context, body) => setProviderEnabled(context, id, body));
export const verifyProviderResponse = (request: Request, id: string) => write(request, "providers.verify", (context, body) => verifyProvider(context, id, body));
export const createLineResponse = (request: Request) => write(request, "lines.create", createLine, 201);
export const updateLineResponse = (request: Request, id: string) => write(request, "lines.update", (context, body) => updateLine(context, id, body));
export const lineRegistrationResponse = (request: Request, id: string) => write(request, "lines.registration", (context, body) => confirmLineRegistration(context, id, body));
export const lineActiveResponse = (request: Request, id: string) => write(request, "lines.active", (context, body) => setLineActive(context, id, body));
export const attestResponse = (request: Request) => write(request, "attestation.confirm", attestLiveCalling);
export const revokeAttestationResponse = (request: Request) => write(request, "attestation.revoke", context => revokeLiveCalling(context));

/** Provider webhooks: no session; authenticated by the provider's signature (see webhooks.ts). */
export async function webhookResponse(request: Request, provider: string, connectionId: string) {
  await connection();
  try { return await providerWebhookResponse(request, provider, connectionId); }
  catch (error) {
    console.error(JSON.stringify({event: "communications.webhook.failed", name: error instanceof Error ? error.name : typeof error, detail: process.env.NODE_ENV !== "production" && error instanceof Error ? error.message.slice(0, 300) : undefined}));
    // A 5xx asks the provider to retry; the event key keeps a retry from applying twice.
    return new Response(null, {status: 500, headers: {"Cache-Control": "no-store"}});
  }
}
// --- Consent, recordings and transcripts (6F.3) ---------------------------------------------

export const callMediaResponse = (request: Request, callId: string) => read(request, "media.get", context => callMedia(context, callId));
export const recordConsentResponse = (request: Request, callId: string) => write(request, "consent.record", (context, body) => recordConsent(context, callId, body), 201);
export const withdrawConsentResponse = (request: Request, id: string) => write(request, "consent.withdraw", (context, body) => withdrawConsent(context, id, body));
export const uploadTranscriptResponse = (request: Request, callId: string) => write(request, "transcript.upload", (context, body) => uploadTranscript(context, callId, body), 201, 1_200_000);
export const deleteRecordingResponse = (request: Request, id: string) => write(request, "recording.delete", context => deleteRecording(context, id));
export const deleteTranscriptResponse = (request: Request, id: string) => write(request, "transcript.delete", context => deleteTranscript(context, id));
export const transcriptContentResponse = (request: Request, id: string) => read(request, "transcript.content", context => transcriptFile(context, id));

/** Reads an upload with a running size cap (the declared length is not trusted). */
async function readBinary(request: Request, maxBytes: number) {
  const tooLarge = () => new WorkspaceError("VALIDATION_ERROR", 413, "Recordings can be at most 30 MB.");
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose a recording to upload.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const {value, done} = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel().catch(() => undefined); throw tooLarge(); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

/** A recording upload: the raw audio as the body, the consent it relies on in X-Consent-Evidence. */
export async function uploadRecordingResponse(request: Request, callId: string) {
  try {
    validateMutationRequest(request, {origin: getAppOrigin(), csrfToken: (await cookies()).get(authCookies().csrf.name)?.value});
    if (!await getSession()) throw new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
    const context = await requireActiveOrganizationRequest();
    assertExpectedOrganization(request.headers.get("x-estateos-organization"), context.organizationId);
    const bytes = await readBinary(request, MAX_RECORDING_BYTES);
    return authJson({data: await uploadRecording(context, callId, request.headers.get("x-consent-evidence"), bytes)}, 201);
  } catch (error) { return errorResponse("recording.upload", error); }
}

/** Streams a recording to a member who may read the call. Never cached publicly; every access is audited. */
export async function recordingContentResponse(request: Request, id: string) {
  await connection();
  try {
    const file = await recordingFile(await readContext(request), id);
    const body = new Uint8Array(file.bytes.byteLength);
    body.set(file.bytes);
    return new Response(body, {headers: {
      "Content-Type": file.contentType, "Content-Length": String(body.byteLength), "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Content-Disposition": "inline",
    }});
  } catch (error) { return errorResponse("recording.content", error); }
}
// --- Claude call summaries (6F.4) -------------------------------------------------------------

export const callSummariesResponse = (request: Request, callId: string) => read(request, "summaries.get", context => callSummaries(context, callId));
export const generateSummaryResponse = (request: Request, callId: string) => write(request, "summary.generate", (context, body) => generateCallSummary(request, context, callId, body), 201);
export const reviewSummaryResponse = (request: Request, id: string) => write(request, "summary.review", (context, body) => reviewCallSummary(context, id, body));
export const decideSuggestionResponse = (request: Request, id: string) => write(request, "suggestion.decide", (context, body) => decideSuggestion(context, id, body));
export const voiceAssistantResponse = (request: Request) => read(request, "voice.get", context => voiceAssistantView(context));
export const saveVoiceAssistantResponse = (request: Request) => write(request, "voice.save", saveVoiceAssistant);
export const startVoiceTestResponse = (request: Request) => write(request, "voice.test.start", context => startVoiceTest(context), 201);
export const voiceTestSessionResponse = (request: Request, id: string) => read(request, "voice.test.get", context => voiceTestSession(context, id));
export const voiceTurnResponse = (request: Request, id: string) => write(request, "voice.test.turn", (context, body) => voiceTurn(request, context, id, body));
export const interruptVoiceTurnResponse = (request: Request, id: string) => write(request, "voice.test.interrupt", (context, body) => interruptVoiceTurn(context, id, body));
export const endVoiceTestResponse = (request: Request, id: string) => write(request, "voice.test.end", context => endVoiceTest(context, id));

export const listMeetingsResponse = (request: Request) => read(request, "meetings.list", listMeetings);
export const createMeetingResponse = (request: Request) => write(request, "meetings.create", createMeeting, 201);
export const meetingAttendeesResponse = (request: Request) => read(request, "meetings.attendees", context => meetingAttendeeOptions(context));
export const getMeetingResponse = (request: Request, id: string) => read(request, "meetings.get", context => getMeeting(context, id));
export const updateMeetingResponse = (request: Request, id: string) => write(request, "meetings.update", (context, body) => updateMeeting(context, id, body));
export const meetingStatusResponse = (request: Request, id: string) => write(request, "meetings.status", (context, body) => setMeetingStatus(context, id, body));
export const summarizeMeetingResponse = (request: Request, id: string) => write(request, "meetings.summary", context => summarizeMeeting(request, context, id), 201);
export const decideMeetingSuggestionResponse = (request: Request, id: string, index: string) => write(request, "meetings.suggestion", (context, body) => decideMeetingSuggestion(context, id, index, body));
export const reportResponse = (request: Request) => read(request, "reports", communicationReport);
