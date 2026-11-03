"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Bot, Loader2, PhoneOff, Play, RefreshCw, ShieldAlert, Square } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatLeadDate, LeadField, LeadFormMessage, selectClassName, textareaClassName } from "@/modules/leads/components/lead-ui";
import { communicationsGet, communicationsSend, errorMessage } from "../client";
import { DEFAULT_VOICE_CONFIG, HANDOFF_REASON_LABELS, SESSION_STATUS_LABELS, VOICE_CHECKS, VOICE_LIMITS, type VoiceCheck, type VoiceSessionStatus, type VoiceTurn } from "../voice";
import type { VoiceAssistantView, VoiceTestSessionView } from "../server/voice";

const TURN_LABELS: Partial<Record<VoiceTurn["kind"], string>> = {
  DISCLOSURE: "AI disclosure", HANDOFF: "Handed to a person", FALLBACK: "Fallback: Claude unavailable", VIEWING_REQUEST: "Viewing request (not booked)", LIMIT: "Limit reached", OPT_OUT: "Opt-out", CLOSE: "Closing",
};

function TestModeNotice() {
  return <div role="note" className="flex gap-3 rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
    <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
    <p><strong>Test mode only.</strong> You type the caller&apos;s words; no phone call is placed or answered and nothing is booked or sent. Live AI calls are not available: they need a verified provider, legal review and your explicit approval (see the voice assistant architecture notes).</p>
  </div>;
}

function ConfigForm({view, organizationId, onSaved}: {view: VoiceAssistantView; organizationId: string; onSaved: () => void}) {
  const prefix = useId();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const config = view.config ?? {...DEFAULT_VOICE_CONFIG, revision: 0};
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const form = new FormData(event.currentTarget);
    const number = (name: string) => Number(form.get(name));
    try {
      await communicationsSend("/api/communications/voice-assistant", organizationId, "PUT", {
        expectedRevision: config.revision, status: String(form.get("status")), assistantName: String(form.get("assistantName") ?? "").trim(), disclosureText: String(form.get("disclosureText") ?? "").trim(),
        greeting: String(form.get("greeting") ?? "").trim(), handoffMessage: String(form.get("handoffMessage") ?? "").trim(),
        questions: String(form.get("questions") ?? "").split("\n").map(line => line.trim()).filter(Boolean),
        projectIds: form.getAll("projectIds").map(String), listingIds: form.getAll("listingIds").map(String),
        maxTurns: number("maxTurns"), maxSessionMinutes: number("maxSessionMinutes"), maxReplyTokens: number("maxReplyTokens"),
      }, "The voice assistant could not be saved.");
      toast.success("Voice assistant saved."); onSaved();
    } catch (problem) { setError(errorMessage(problem, "The voice assistant could not be saved.")); }
    finally { setPending(false); }
  }
  const checkbox = "size-4 rounded border-input accent-primary";
  return <form onSubmit={submit} className="space-y-5" key={config.revision}><fieldset disabled={pending} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <LeadField id={`${prefix}-name`} label="Assistant name"><Input id={`${prefix}-name`} name="assistantName" required minLength={2} maxLength={60} defaultValue={config.assistantName} /></LeadField>
      <LeadField id={`${prefix}-status`} label="Status"><select id={`${prefix}-status`} name="status" className={selectClassName} defaultValue={config.status}>
        <option value="DRAFT">Draft</option><option value="TEST_ONLY">Ready for test calls</option>
      </select></LeadField>
    </div>
    <LeadField id={`${prefix}-disclosure`} label="AI disclosure (said first, required)"><textarea id={`${prefix}-disclosure`} name="disclosureText" className={textareaClassName} required minLength={20} maxLength={400} defaultValue={config.disclosureText} /></LeadField>
    <p className="-mt-3 text-xs text-muted-foreground">It must tell the caller they are speaking with an AI (for example &ldquo;AI assistant&rdquo; or &ldquo;virtual assistant&rdquo;).</p>
    <LeadField id={`${prefix}-greeting`} label="Greeting"><textarea id={`${prefix}-greeting`} name="greeting" className={textareaClassName} required minLength={5} maxLength={400} defaultValue={config.greeting} /></LeadField>
    <LeadField id={`${prefix}-questions`} label={`Qualification questions (one per line, up to ${VOICE_LIMITS.questions})`}><textarea id={`${prefix}-questions`} name="questions" className={textareaClassName} rows={4} defaultValue={config.questions.join("\n")} /></LeadField>
    <LeadField id={`${prefix}-handoff`} label="Handoff message"><textarea id={`${prefix}-handoff`} name="handoffMessage" className={textareaClassName} required minLength={10} maxLength={400} defaultValue={config.handoffMessage} /></LeadField>
    <div className="grid gap-4 md:grid-cols-2">
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Projects it may talk about (active, up to {VOICE_LIMITS.projects})</legend>
        {view.options.projects.length ? <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border p-2">{view.options.projects.map(option => <li key={option.id}><label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="projectIds" value={option.id} defaultChecked={config.projectIds.includes(option.id)} className={checkbox} />
          <span>{option.label}{option.detail && <span className="text-muted-foreground"> · {option.detail}</span>}</span></label></li>)}</ul>
          : <p className="text-sm text-muted-foreground">No active projects.</p>}
      </fieldset>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Listings it may talk about (active, up to {VOICE_LIMITS.listings})</legend>
        {view.options.listings.length ? <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border p-2">{view.options.listings.map(option => <li key={option.id}><label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="listingIds" value={option.id} defaultChecked={config.listingIds.includes(option.id)} className={checkbox} />
          <span>{option.label}{option.detail && <span className="text-muted-foreground"> · {option.detail}</span>}</span></label></li>)}</ul>
          : <p className="text-sm text-muted-foreground">No active listings.</p>}
      </fieldset>
    </div>
    <p className="text-xs text-muted-foreground">The assistant never sees leads, contacts or notes. Without projects or listings it can only qualify the caller and hand over.</p>
    <div className="grid gap-4 sm:grid-cols-3">
      <LeadField id={`${prefix}-turns`} label="Caller turns per call"><Input id={`${prefix}-turns`} name="maxTurns" type="number" min={2} max={30} required defaultValue={config.maxTurns} /></LeadField>
      <LeadField id={`${prefix}-minutes`} label="Minutes per call"><Input id={`${prefix}-minutes`} name="maxSessionMinutes" type="number" min={1} max={30} required defaultValue={config.maxSessionMinutes} /></LeadField>
      <LeadField id={`${prefix}-tokens`} label="Output tokens per reply"><Input id={`${prefix}-tokens`} name="maxReplyTokens" type="number" min={1000} max={4000} step={100} required defaultValue={config.maxReplyTokens} /></LeadField>
    </div>
    <Button type="submit">{pending ? "Saving…" : "Save"}</Button>
  </fieldset><LeadFormMessage message={error} /></form>;
}

function Turn({turn, facts}: {turn: VoiceTurn; facts: Map<string, string>}) {
  if (turn.role === "SYSTEM") return <li className="text-center text-xs text-muted-foreground" data-turn-kind={turn.kind}>{turn.text}</li>;
  const caller = turn.role === "CALLER";
  return <li className={caller ? "flex justify-end" : "flex justify-start"} data-turn-kind={turn.kind}>
    <div className={`max-w-[85%] space-y-1 rounded-lg px-3 py-2 text-sm ${caller ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
      <div className="flex flex-wrap items-center gap-1.5 text-xs opacity-80"><span className="font-medium">{caller ? "Caller (test)" : "Assistant"}</span>{TURN_LABELS[turn.kind] && <Badge variant="outline">{TURN_LABELS[turn.kind]}</Badge>}</div>
      <p dir="auto" className="whitespace-pre-wrap">{turn.text}</p>
      {!!turn.checks?.length && <ul className="space-y-0.5 text-xs text-destructive">{turn.checks.map(code => <li key={code}>Replaced: {VOICE_CHECKS[code as VoiceCheck] ?? code}</li>)}</ul>}
      {!!turn.factKeys?.length && <p className="text-xs text-muted-foreground">Facts used: {turn.factKeys.map(key => facts.get(key) ?? key).join(", ")}</p>}
      {!!turn.answers?.length && <p className="text-xs text-muted-foreground">Answers noted: {turn.answers.map(answer => `Q${answer.question}: ${answer.answer}`).join("; ")}</p>}
    </div>
  </li>;
}

function Simulator({sessionId, organizationId, onChanged}: {sessionId: string; organizationId: string; onChanged: () => void}) {
  const [session, setSession] = useState<VoiceTestSessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState<string | null>(null);
  const inFlight = useRef<{turnId: string; controller: AbortController} | null>(null);
  const load = useCallback(() => communicationsGet<VoiceTestSessionView>(`/api/communications/voice-assistant/sessions/${sessionId}`, "The test call could not be loaded.")
    .then(result => { setSession(result); setError(null); }, problem => setError(errorMessage(problem, "The test call could not be loaded."))), [sessionId]);
  useEffect(() => { void load(); }, [load]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const utterance = draft.trim();
    if (!session || !utterance || inFlight.current) return;
    const turnId = crypto.randomUUID();
    const controller = new AbortController();
    inFlight.current = {turnId, controller}; setWaiting(utterance); setDraft(""); setError(null);
    try {
      const result = await communicationsSend<{outcome: string; error?: string | null}>(`/api/communications/voice-assistant/sessions/${sessionId}/turns`, organizationId, "POST",
        {utterance, turnId, expectedRevision: session.revision}, "The assistant could not reply.", controller.signal);
      if (result.error) toast.warning(`Claude could not answer, so the call was handed to a person: ${result.error}`);
    } catch (problem) { if (!controller.signal.aborted) setError(errorMessage(problem, "The assistant could not reply.")); }
    finally { inFlight.current = null; setWaiting(null); await load(); onChanged(); }
  }

  async function interrupt() {
    const current = inFlight.current;
    if (!current) return;
    current.controller.abort();
    // The server also stops when the request is aborted; whichever records it first wins.
    await communicationsSend(`/api/communications/voice-assistant/sessions/${sessionId}/interrupt`, organizationId, "POST", {turnId: current.turnId}).catch(() => undefined);
    toast.info("Reply interrupted; it was discarded.");
  }

  async function end() {
    try { await communicationsSend(`/api/communications/voice-assistant/sessions/${sessionId}/end`, organizationId, "POST", {}); await load(); onChanged(); }
    catch (problem) { setError(errorMessage(problem, "The test call could not be ended.")); }
  }

  if (!session) return error ? <LeadFormMessage message={error} /> : <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 aria-hidden className="size-4 animate-spin" />Loading the test call…</p>;
  const facts = new Map(session.facts.map(fact => [fact.key, fact.label]));
  return <div className="space-y-4" data-testid="voice-simulator">
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Badge variant="secondary">TEST</Badge>
      <Badge variant={session.status === "ACTIVE" ? "outline" : "secondary"} data-testid="voice-session-status">{SESSION_STATUS_LABELS[session.status as VoiceSessionStatus]}</Badge>
      {session.handoffReason && <span className="text-muted-foreground">{HANDOFF_REASON_LABELS[session.handoffReason] ?? session.handoffReason}</span>}
      <span className="ml-auto text-xs text-muted-foreground">Caller turns {session.callerTurns}/{session.maxTurns} · {session.maxSessionMinutes} min limit · {session.inputTokens + session.outputTokens} tokens</span>
    </div>
    {!!session.omitted.length && <p className="text-xs text-muted-foreground">Left out of this test: {session.omitted.join("; ")}.</p>}
    <p className="text-xs text-muted-foreground">Facts available: {session.facts.length ? session.facts.map(fact => `${fact.key} ${fact.label}`).join(", ") : "none (qualification and handoff only)"}.</p>
    <ol className="space-y-2 rounded-lg border p-3" aria-label="Test call transcript">
      {session.turns.map(turn => <Turn key={turn.id} turn={turn} facts={facts} />)}
      {waiting && <li className="flex justify-end"><div className="max-w-[85%] rounded-lg bg-primary/70 px-3 py-2 text-sm text-primary-foreground">{waiting}</div></li>}
      {waiting && <li className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="voice-replying"><Loader2 aria-hidden className="size-4 animate-spin" />The assistant is replying…</li>}
    </ol>
    {session.viewingRequest && <div className="rounded-md border p-3 text-sm" data-testid="voice-viewing-request"><p className="font-medium">Viewing requested, not booked</p><p className="text-muted-foreground">{session.viewingRequest.subject}{session.viewingRequest.preferredTime ? ` · preferred: ${session.viewingRequest.preferredTime}` : ""}. A team member would arrange it.</p></div>}
    {session.canContinue ? <form onSubmit={send} className="flex flex-wrap gap-2">
      <label htmlFor={`caller-${sessionId}`} className="sr-only">What the caller says</label>
      <Input id={`caller-${sessionId}`} value={draft} onChange={event => setDraft(event.target.value)} maxLength={VOICE_LIMITS.utterance} placeholder="Type what the caller says…" className="min-w-0 flex-1" disabled={Boolean(waiting)} />
      {waiting ? <Button type="button" variant="outline" onClick={interrupt}><Square aria-hidden />Interrupt</Button> : <Button type="submit" disabled={!draft.trim()}>Say</Button>}
      <Button type="button" variant="ghost" onClick={end} disabled={Boolean(waiting)}><PhoneOff aria-hidden />End test call</Button>
    </form> : <p className="text-sm text-muted-foreground">{session.status === "ACTIVE" ? "Only the person who started this test call can continue it." : "This test call has ended."}</p>}
    <LeadFormMessage message={error ?? ""} />
  </div>;
}

/** Voice assistant configuration and the test-call simulator (owners and administrators). */
export function VoiceAssistantPanel({organizationId}: {organizationId: string}) {
  const [view, setView] = useState<VoiceAssistantView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const load = useCallback(() => communicationsGet<VoiceAssistantView>("/api/communications/voice-assistant", "The voice assistant could not be loaded.")
    .then(result => { setView(result); setError(null); }, problem => setError(errorMessage(problem, "The voice assistant could not be loaded."))), []);
  useEffect(() => { void load(); }, [load]);

  async function start() {
    setStarting(true);
    try {
      const {id} = await communicationsSend<{id: string}>("/api/communications/voice-assistant/sessions", organizationId, "POST", {}, "The test call could not be started.");
      setSelected(id); await load();
    } catch (problem) { toast.error(errorMessage(problem, "The test call could not be started.")); }
    finally { setStarting(false); }
  }

  if (!view) return error ? <div className="space-y-3"><LeadFormMessage message={error} /><Button variant="outline" onClick={() => void load()}><RefreshCw aria-hidden />Try again</Button></div>
    : <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 aria-hidden className="size-4 animate-spin" />Loading the voice assistant…</p>;
  const ready = view.config?.status === "TEST_ONLY";
  return <div className="space-y-5">
    <TestModeNotice />
    <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><CardTitle role="heading" aria-level={2}>Assistant</CardTitle>
      <CardDescription>{view.config ? `Revision ${view.config.revision}, last saved ${formatLeadDate(view.config.updatedAt)} by ${view.config.updatedBy?.displayName ?? "a member"}.` : "Not set up yet. These defaults are a starting point."}</CardDescription></CardHeader>
      <CardContent className="px-5"><ConfigForm view={view} organizationId={organizationId} onSaved={() => void load()} /></CardContent></Card>
    <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1"><CardTitle role="heading" aria-level={2}>Test calls</CardTitle>
      <CardDescription>{ready ? "Simulated conversations, stored and labelled TEST." : "Save the assistant as “Ready for test calls” to start one."}</CardDescription></div>
      <Button onClick={start} disabled={!ready || starting}>{starting ? <Loader2 aria-hidden className="animate-spin" /> : <Play aria-hidden />}Start test call</Button></div></CardHeader>
      <CardContent className="space-y-4 px-5">
        {view.sessions.length ? <ul className="divide-y rounded-md border">{view.sessions.map(item => <li key={item.id}><button type="button" onClick={() => setSelected(item.id)} aria-current={selected === item.id ? "true" : undefined}
          className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 aria-[current=true]:bg-muted">
          <Bot aria-hidden className="size-4 text-muted-foreground" /><Badge variant="secondary">TEST</Badge><span>{formatLeadDate(item.createdAt)}</span>
          <span className="text-muted-foreground">{item.createdBy.displayName} · {item.callerTurns} caller turns</span>
          <Badge variant="outline" className="ml-auto">{SESSION_STATUS_LABELS[item.status as VoiceSessionStatus]}</Badge></button></li>)}</ul>
          : <p className="text-sm text-muted-foreground">No test calls yet.</p>}
        {selected && <Simulator key={selected} sessionId={selected} organizationId={organizationId} onChanged={() => void load()} />}
      </CardContent></Card>
  </div>;
}
