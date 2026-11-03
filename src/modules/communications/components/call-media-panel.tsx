"use client";

import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { FileText, Loader2, Mic, RefreshCw, ShieldCheck, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatLeadDate, LeadField, LeadFormMessage, selectClassName, textareaClassName } from "@/modules/leads/components/lead-ui";
import { CommunicationsRequestError, communicationsGet, communicationsSend, errorMessage, formatDuration } from "../client";
import { LANGUAGE_LABELS, timestamp, type TranscriptSegment } from "../media";
import type { CallMediaView } from "../server/media";

const CONSENT_LABELS: Record<string, string> = {NOTICE_GIVEN: "Told about recording", GIVEN: "Agreed to recording", DECLINED: "Declined recording", WITHDRAWN: "Withdrawn"};
const METHOD_LABELS: Record<string, string> = {VERBAL_ON_CALL: "Said on the call", ANNOUNCEMENT: "Recorded announcement", WRITTEN: "In writing"};

type TranscriptView = {id: string; language: string; sourceName: string | null; hasTimestamps: boolean; generatedAt: string; segments: TranscriptSegment[]};

function SmallDialog({trigger, title, description, children, onSubmit, submitLabel, variant = "outline"}: {trigger: ReactNode; title: string; description: string; children: ReactNode; onSubmit: (form: FormData) => Promise<void>; submitLabel: string; variant?: "outline" | "ghost"}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    try { await onSubmit(new FormData(event.currentTarget)); setOpen(false); }
    catch (problem) { setError(errorMessage(problem, "The change could not be saved.")); }
    finally { setPending(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!pending) { setOpen(value); setError(""); } }}>
    <DialogTrigger render={<Button variant={variant} size="sm" />}>{trigger}</DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4">{children}<Button type="submit">{pending ? <><Loader2 className="animate-spin" aria-hidden="true" />Saving…</> : submitLabel}</Button></fieldset><LeadFormMessage message={error} /></form>
    </DialogContent>
  </Dialog>;
}

/** Sends a recording file as the request body (the server checks its contents and size). */
async function uploadRecordingFile(callId: string, organizationId: string, consentId: string, file: File) {
  const csrf = await fetch("/api/auth/csrf", {credentials: "same-origin", cache: "no-store"});
  const token = ((await csrf.json().catch(() => ({}))) as {csrfToken?: string}).csrfToken;
  if (!csrf.ok || !token) throw new CommunicationsRequestError("Could not prepare a secure request. Reload and try again.", "CSRF_UNAVAILABLE", csrf.status);
  const response = await fetch(`/api/communications/calls/${callId}/recordings`, {method: "POST", credentials: "same-origin", cache: "no-store", body: file,
    headers: {"X-CSRF-Token": token, "X-EstateOS-Organization": organizationId, "X-Consent-Evidence": consentId, "Content-Type": file.type || "application/octet-stream"}});
  const body = await response.json().catch(() => ({})) as {error?: {message?: string; code?: string}};
  if (!response.ok) throw new CommunicationsRequestError(body.error?.message || "The recording could not be uploaded.", body.error?.code || "REQUEST_FAILED", response.status);
}

function TranscriptViewer({id}: {id: string}) {
  const [view, setView] = useState<TranscriptView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    communicationsGet<TranscriptView>(`/api/communications/transcripts/${id}/content`, "The transcript could not be loaded.").then(setView, problem => setError(errorMessage(problem, "The transcript could not be loaded.")));
  }, [id]);
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!view) return <p role="status" className="text-sm text-muted-foreground">Loading transcript...</p>;
  return <ol className="max-h-96 space-y-2 overflow-y-auto rounded-lg border bg-muted/20 p-3 text-sm" aria-label="Transcript">
    {view.segments.map(segment => <li key={segment.id} id={`segment-${segment.id}`} dir="auto" className="leading-6">
      {segment.startSeconds !== null && <span className="mr-2 font-mono text-xs text-muted-foreground">{timestamp(segment.startSeconds)}</span>}
      {segment.speaker && <span className="mr-1 font-medium">{segment.speaker}:</span>}{segment.text}
    </li>)}
  </ol>;
}

/** Consent evidence, recordings and transcripts for one call. */
export function CallMediaPanel({callId, organizationId}: {callId: string; organizationId: string}) {
  const prefix = useId();
  const [media, setMedia] = useState<CallMediaView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openTranscript, setOpenTranscript] = useState<string | null>(null);
  const load = useCallback(() => communicationsGet<CallMediaView>(`/api/communications/calls/${callId}/media`, "Recordings could not be loaded.")
    .then(result => { setMedia(result); setError(null); }, problem => setError(errorMessage(problem, "Recordings could not be loaded."))), [callId]);
  useEffect(() => { void load(); }, [load]);

  const send = async (path: string, body: unknown, success: string) => {
    await communicationsSend(path, organizationId, "POST", body);
    toast.success(success); void load();
  };

  const header = <CardHeader className="px-5"><div className="flex items-center gap-2"><Mic className="size-4 text-muted-foreground" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>Recording and transcript</CardTitle></div>
    <CardDescription>Only with the customer&apos;s notice or consent recorded for this call. Transcripts may contain errors; check them against the recording.</CardDescription></CardHeader>;
  if (error) return <Card className="gap-3 py-5 shadow-xs ring-border">{header}<CardContent className="space-y-2 px-5"><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw aria-hidden="true" />Try again</Button></CardContent></Card>;
  if (!media) return <div role="status" className="animate-pulse rounded-xl border p-6 text-sm text-muted-foreground">Loading recordings...</div>;
  if (!media.recordingEnabled) return <Card className="gap-3 py-5 shadow-xs ring-border">{header}<CardContent className="px-5 text-sm text-muted-foreground">Recording is off for your company, so this call has no recording or transcript.{media.canDelete && " An owner or administrator can enable it in Calling settings with the notice read to callers and the legal basis."}</CardContent></Card>;

  const activeConsents = media.consents.filter(item => item.status === "NOTICE_GIVEN" || item.status === "GIVEN");
  const consentOptions = activeConsents.map(item => <option key={item.id} value={item.id}>{CONSENT_LABELS[item.status]}, {formatLeadDate(item.capturedAt, true)}</option>);
  return <Card className="gap-4 py-5 shadow-xs ring-border">{header}<CardContent className="space-y-5 px-5">
    <section aria-label="Consent" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">Notice and consent</h3>
        {media.canRecordConsent && <SmallDialog trigger={<><ShieldCheck aria-hidden="true" />Record notice or consent</>} title="Record notice or consent" description="What the customer was told on this call. The company's notice and legal basis are saved with it." submitLabel="Save"
          onSubmit={form => send(`/api/communications/calls/${callId}/consents`, {status: String(form.get("status")), method: String(form.get("method")), note: String(form.get("note") ?? "").trim() || null}, "Consent evidence saved.")}>
          <blockquote className="rounded-lg border-l-4 bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">{media.noticeText}</blockquote>
          <LeadField id={`${prefix}-status`} label="The customer"><select id={`${prefix}-status`} name="status" className={selectClassName}><option value="NOTICE_GIVEN">Was told the call is recorded</option><option value="GIVEN">Agreed to the recording</option><option value="DECLINED">Declined the recording</option></select></LeadField>
          <LeadField id={`${prefix}-method`} label="How"><select id={`${prefix}-method`} name="method" className={selectClassName}>{Object.entries(METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></LeadField>
          <LeadField id={`${prefix}-note`} label="Note (optional)"><textarea id={`${prefix}-note`} name="note" maxLength={500} className={textareaClassName} /></LeadField>
        </SmallDialog>}
      </div>
      {!media.answered && <p className="text-xs text-muted-foreground">Only answered calls can have a recording.</p>}
      {media.consents.length ? <ul className="space-y-2">{media.consents.map(item => <li key={item.id} className="rounded-lg border p-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{CONSENT_LABELS[item.status]}</span>
          {(item.status === "NOTICE_GIVEN" || item.status === "GIVEN") && media.canEdit && <SmallDialog variant="ghost" trigger="Withdraw" title="Withdraw consent" description="The recordings and transcripts that relied on it are deleted." submitLabel="Withdraw"
            onSubmit={form => send(`/api/communications/consents/${item.id}/withdraw`, {note: String(form.get("note") ?? "").trim()}, "Consent withdrawn; its recordings and transcripts were deleted.")}>
            <LeadField id={`${prefix}-withdraw-${item.id}`} label="What the customer said"><textarea id={`${prefix}-withdraw-${item.id}`} name="note" required minLength={3} maxLength={500} className={textareaClassName} /></LeadField>
          </SmallDialog>}</div>
        <p className="mt-1 text-muted-foreground">{METHOD_LABELS[item.method] ?? item.method} · {formatLeadDate(item.capturedAt, true)} · {item.capturedBy.displayName} · Legal basis: {item.legalBasis}</p>
        {item.note && <p className="mt-1">{item.note}</p>}
        {item.withdrawnAt && <p className="mt-1 text-muted-foreground">Withdrawn {formatLeadDate(item.withdrawnAt, true)}{item.withdrawnBy ? ` by ${item.withdrawnBy.displayName}` : ""}: {item.withdrawalNote}</p>}
      </li>)}</ul> : <p className="text-xs text-muted-foreground">No notice or consent recorded for this call.</p>}
    </section>

    <section aria-label="Recordings" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">Recordings</h3>
        {media.canUpload && <SmallDialog trigger={<><Upload aria-hidden="true" />Add recording</>} title="Add a recording" description={`A WAV or MP3 file from your company's approved phone service, up to 30 MB. Kept for ${media.retentionDays} days.`} submitLabel="Upload"
          onSubmit={async form => {
            const file = form.get("file");
            if (!(file instanceof File) || !file.size) throw new Error("Choose a recording file.");
            await uploadRecordingFile(callId, organizationId, String(form.get("consent")), file);
            toast.success("Recording added."); void load();
          }}>
          <LeadField id={`${prefix}-rec-consent`} label="Relies on"><select id={`${prefix}-rec-consent`} name="consent" className={selectClassName}>{consentOptions}</select></LeadField>
          <LeadField id={`${prefix}-rec-file`} label="Recording file"><Input id={`${prefix}-rec-file`} name="file" type="file" accept="audio/wav,audio/x-wav,audio/mpeg,.wav,.mp3" required /></LeadField>
        </SmallDialog>}
      </div>
      {media.recordings.length ? <ul className="space-y-3">{media.recordings.map(item => <li key={item.id} className="space-y-2 rounded-lg border p-3">
        <audio controls preload="none" className="w-full" src={`/api/communications/recordings/${item.id}/content`} aria-label={`Recording, ${formatDuration(item.durationSeconds)}`} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{formatDuration(item.durationSeconds)} · added by {item.createdBy.displayName} {formatLeadDate(item.createdAt, true)} · deleted automatically {formatLeadDate(item.retentionUntil)}</span>
          {media.canDelete && <Button variant="ghost" size="sm" onClick={() => void send(`/api/communications/recordings/${item.id}/delete`, {}, "Recording deleted.").catch(problem => toast.error(errorMessage(problem, "The recording could not be deleted.")))}><Trash2 aria-hidden="true" />Delete</Button>}</div>
      </li>)}</ul> : <p className="text-xs text-muted-foreground">No recording.</p>}
    </section>

    <section aria-label="Transcripts" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">Transcripts</h3>
        {media.canUpload && <SmallDialog trigger={<><FileText aria-hidden="true" />Add transcript</>} title="Add a transcript" description="A WebVTT, SRT or text file from your approved transcription service, up to 1 MB." submitLabel="Upload"
          onSubmit={async form => {
            const file = form.get("file");
            if (!(file instanceof File) || !file.size) throw new Error("Choose a transcript file.");
            await send(`/api/communications/calls/${callId}/transcripts`, {consentEvidenceId: String(form.get("consent")), sourceName: String(form.get("sourceName") ?? "").trim(), content: await file.text()}, "Transcript added.");
          }}>
          <LeadField id={`${prefix}-tr-consent`} label="Relies on"><select id={`${prefix}-tr-consent`} name="consent" className={selectClassName}>{consentOptions}</select></LeadField>
          <LeadField id={`${prefix}-tr-source`} label="Produced by" hint="The service that made the transcript."><Input id={`${prefix}-tr-source`} name="sourceName" required minLength={2} maxLength={80} /></LeadField>
          <LeadField id={`${prefix}-tr-file`} label="Transcript file"><Input id={`${prefix}-tr-file`} name="file" type="file" accept=".vtt,.srt,.txt,text/vtt,text/plain" required /></LeadField>
        </SmallDialog>}
      </div>
      {media.transcripts.length ? <ul className="space-y-3">{media.transcripts.map(item => <li key={item.id} className="space-y-2 rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs"><Badge variant="outline">{LANGUAGE_LABELS[item.language] ?? item.language} (detected)</Badge><span className="text-muted-foreground">{item.segmentCount} lines · {item.sourceName ?? item.source.toLowerCase()} · {item.hasTimestamps ? "with timestamps" : "no timestamps"}</span></div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" aria-expanded={openTranscript === item.id} onClick={() => setOpenTranscript(openTranscript === item.id ? null : item.id)}>{openTranscript === item.id ? "Hide" : "Read"}</Button>
            {media.canDelete && <Button variant="ghost" size="sm" onClick={() => void send(`/api/communications/transcripts/${item.id}/delete`, {}, "Transcript deleted.").catch(problem => toast.error(errorMessage(problem, "The transcript could not be deleted.")))}><Trash2 aria-hidden="true" />Delete</Button>}
          </div>
        </div>
        {openTranscript === item.id && <TranscriptViewer id={item.id} />}
      </li>)}</ul> : <p className="text-xs text-muted-foreground">No transcript.</p>}
    </section>
  </CardContent></Card>;
}
