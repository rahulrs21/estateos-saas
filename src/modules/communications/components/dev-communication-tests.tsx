"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FlaskConical, Loader2, Plus, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatLeadDate, LeadField, selectClassName } from "@/modules/leads/components/lead-ui";
import { communicationsGet, communicationsSend, errorMessage } from "../client";
import { CALL_OUTCOMES, CALL_OUTCOME_LABELS, CALL_STATUS_LABELS, type CallStatus } from "../model";
import type { SimulatorView } from "../server/simulator";
import { InboxSimulator } from "@/modules/inbox/components/inbox-simulator";

const STATUS_STYLE: Record<string, "secondary" | "destructive" | "outline"> = {PASSED: "secondary", FAILED: "destructive", BLOCKED: "outline", NOT_RUN: "outline", NOT_REQUIRED: "outline"};
const STATUS_TEXT: Record<string, string> = {PASSED: "Passed", FAILED: "Failed", BLOCKED: "Blocked", NOT_RUN: "Not run", NOT_REQUIRED: "Not required"};

function Status({status}: {status: string}) {
  return <Badge variant={STATUS_STYLE[status] ?? "outline"} data-status={status}>{STATUS_TEXT[status] ?? status}</Badge>;
}

type Layer = SimulatorView["criteria"][number]["simulated"];
function Evidence({layer}: {layer: Layer}) {
  if (!layer.evidence.length) return <span className="text-xs text-muted-foreground">No tests in this layer</span>;
  return <details className="text-xs"><summary className="cursor-pointer"><Status status={layer.status} /></summary>
    <ul className="mt-1 space-y-1">{layer.evidence.map((item, index) => <li key={index}><span className="font-mono">{item.ref.suite}</span>{item.ref.test && <> · &ldquo;{item.ref.test}&rdquo;</>} — {STATUS_TEXT[item.status]}
      {item.matched.length > 0 && <span className="block text-muted-foreground">{item.matched.slice(0, 3).join("; ")}{item.matched.length > 3 ? ` (+${item.matched.length - 3})` : ""}</span>}</li>)}</ul>
  </details>;
}

/** Developer-only: fictional leads, simulated calls and the Phase 6F verification results. */
export function DevCommunicationTests({organizationId}: {organizationId: string}) {
  const [view, setView] = useState<SimulatorView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [scenario, setScenario] = useState("ANSWERED");
  const [log, setLog] = useState<Array<{status: string; result: string; trigger?: string | null}> | null>(null);
  const load = useCallback(() => communicationsGet<SimulatorView>("/api/dev/communication-tests", "The simulator could not be loaded.")
    .then(result => { setView(result); setError(null); }, problem => setError(errorMessage(problem, "The simulator could not be loaded."))), []);
  useEffect(() => { void load(); }, [load]);

  async function run<T>(key: string, path: string, body: unknown, success: string): Promise<T | null> {
    setBusy(key);
    try { const result = await communicationsSend<T>(path, organizationId, "POST", body); toast.success(success); return result; }
    catch (problem) { toast.error(errorMessage(problem, "The simulator request failed.")); return null; }
    finally { setBusy(null); void load(); }
  }

  async function simulate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const answered = view?.scenarios.find(item => item.key === scenario)?.answered;
    const result = await run<{callId: string; log: typeof log}>("simulate", "/api/dev/communication-tests/calls", {
      leadId: String(form.get("leadId")), direction: String(form.get("direction")), callType: String(form.get("callType")), scenario,
      durationSeconds: Number(form.get("durationSeconds") ?? 0), outcome: answered ? String(form.get("outcome") ?? "") || null : null,
    }, "Simulated call recorded.");
    if (result) setLog(result.log);
  }

  if (error) return <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw aria-hidden />Try again</Button></div>;
  if (!view) return <div role="status" className="animate-pulse rounded-xl border p-6 text-sm text-muted-foreground">Loading the simulator…</div>;
  const selected = view.scenarios.find(item => item.key === scenario);

  return <div className="space-y-5">
    <div role="note" className="flex gap-3 rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
      <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p><strong>Developer simulation only.</strong> Records here are synthetic and labelled SIMULATED, on fictional leads (reserved +44 7700 900xxx drama numbers). No call is placed, no provider is used or pretended, and the real Call button stays disabled. Simulated calls are left out of dashboards and reports unless you include them there explicitly.</p>
    </div>

    <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1">
      <CardTitle role="heading" aria-level={2}>Fictional leads</CardTitle><CardDescription>Created through the normal lead service and registered as simulator-owned. Simulated calls are refused on any other lead.</CardDescription></div>
      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("lead", "/api/dev/communication-tests/leads", {}, "Fictional lead created.")}>{busy === "lead" ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}Create fictional lead</Button></div></CardHeader>
      <CardContent className="px-5">{view.leads.length ? <ul className="divide-y rounded-md border" aria-label="Fictional leads">{view.leads.map(lead => <li key={lead.leadId} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
        <Link href={`/leads/${lead.leadId}`} className="font-medium text-primary hover:underline">{lead.name}</Link><span className="text-muted-foreground">{lead.phone}</span><Badge variant="outline" className="ml-auto">SIMULATOR</Badge></li>)}</ul>
        : <p className="text-sm text-muted-foreground">No fictional leads yet.</p>}</CardContent></Card>

    <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><CardTitle role="heading" aria-level={2}>Simulate a call</CardTitle>
      <CardDescription>Plays the provider events of a scenario through the same state machine and compare-and-set rules as signed webhooks, and writes the same workflow events (origin SIMULATOR).</CardDescription></CardHeader>
      <CardContent className="space-y-4 px-5">
        {view.leads.length ? <form onSubmit={simulate} className="grid gap-4 sm:grid-cols-3" aria-label="Simulate a call">
          <LeadField id="sim-lead" label="Fictional lead"><select id="sim-lead" name="leadId" className={selectClassName}>{view.leads.map(lead => <option key={lead.leadId} value={lead.leadId}>{lead.name}</option>)}</select></LeadField>
          <LeadField id="sim-direction" label="Direction"><select id="sim-direction" name="direction" className={selectClassName}><option value="OUTBOUND">Outgoing</option><option value="INBOUND">Incoming</option></select></LeadField>
          <LeadField id="sim-type" label="Purpose"><select id="sim-type" name="callType" className={selectClassName}><option value="FOLLOW_UP">Follow-up</option><option value="SERVICE">Service</option><option value="INBOUND_ENQUIRY">Incoming enquiry</option></select></LeadField>
          <LeadField id="sim-scenario" label="Scenario"><select id="sim-scenario" name="scenario" className={selectClassName} value={scenario} onChange={event => setScenario(event.target.value)}>
            {view.scenarios.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></LeadField>
          <LeadField id="sim-duration" label="Talk time (seconds)"><Input id="sim-duration" name="durationSeconds" type="number" min={0} max={14400} defaultValue={120} disabled={!selected?.answered} /></LeadField>
          <LeadField id="sim-outcome" label="Outcome"><select id="sim-outcome" name="outcome" className={selectClassName} disabled={!selected?.answered}><option value="">None</option>
            {CALL_OUTCOMES.map(outcome => <option key={outcome} value={outcome}>{CALL_OUTCOME_LABELS[outcome]}</option>)}</select></LeadField>
          <p className="text-xs text-muted-foreground sm:col-span-2">Events: INITIATED → {selected?.steps.join(" → ")}</p>
          <Button type="submit" disabled={busy !== null}>{busy === "simulate" ? <Loader2 className="animate-spin" aria-hidden /> : null}Run scenario</Button>
        </form> : <p className="text-sm text-muted-foreground">Create a fictional lead first.</p>}
        {log && <ol className="space-y-1 rounded-md border p-3 text-sm" aria-label="Event log">{log.map((entry, index) => <li key={index} className="flex flex-wrap gap-2"><span className="font-mono">{entry.status}</span>
          <Badge variant={entry.result === "APPLIED" || entry.result === "CREATED" ? "secondary" : "outline"}>{entry.result}</Badge>{entry.trigger && <span className="text-xs text-muted-foreground">workflow event {entry.trigger}</span>}</li>)}</ol>}
      </CardContent></Card>

    <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1">
      <CardTitle role="heading" aria-level={2}>Simulated calls</CardTitle><CardDescription>Replay an event to check duplicates are ignored, or send an earlier status to check late events are refused.</CardDescription></div>
      <Button size="sm" variant="outline" disabled={busy !== null || (!view.calls.length && !view.leads.length)} onClick={() => { if (window.confirm("Delete all simulated calls and meetings on fictional leads, and archive the fictional leads? Real records are not touched.")) void run("reset", "/api/dev/communication-tests/reset", {}, "Simulator data cleaned up."); }}>
        <RotateCcw aria-hidden />Reset simulator data</Button></div></CardHeader>
      <CardContent className="px-5">{view.calls.length ? <ul className="divide-y rounded-md border" aria-label="Simulated calls">{view.calls.map(call => <li key={call.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
        <Badge variant="destructive">SIMULATED</Badge><Link href={`/communications/calls/${call.id}`} className="font-medium text-primary hover:underline">{call.lead?.fullName ?? "Call"}</Link>
        <span className="text-muted-foreground">{call.direction === "INBOUND" ? "Incoming" : "Outgoing"} · {CALL_STATUS_LABELS[call.callStatus as CallStatus]} · {formatLeadDate(call.startedAt, true)}</span>
        <span className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`r${call.id}`, `/api/dev/communication-tests/calls/${call.id}/events`, {status: call.callStatus}, "Event replayed.").then(result => result && setLog([result as {status: string; result: string}]))}>Replay last event</Button>
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`o${call.id}`, `/api/dev/communication-tests/calls/${call.id}/events`, {status: "RINGING"}, "Event sent.").then(result => result && setLog([result as {status: string; result: string}]))}>Send late &ldquo;ringing&rdquo;</Button>
        </span></li>)}</ul> : <p className="text-sm text-muted-foreground">No simulated calls.</p>}</CardContent></Card>

    <InboxSimulator organizationId={organizationId} leads={view.leads} onChanged={() => void load()} />

    <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><CardTitle role="heading" aria-level={2}>Phase 6F verification</CardTitle>
      <CardDescription>From the last <code>npm run test:communications:verify</code> run{view.results ? ` (${formatLeadDate(view.results.runAt, true)})` : ""}. Simulated and integration results never make a feature production-ready on their own; real-provider verification stays blocked until a provider is connected and approved.</CardDescription></CardHeader>
      <CardContent className="space-y-4 px-5">
        {!view.results && <p className="text-sm text-muted-foreground">No results yet. Run <code>npm run test:communications:verify</code> in a terminal, then reload.</p>}
        <div className="overflow-x-auto"><Table aria-label="Acceptance criteria"><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Criterion</TableHead><TableHead>1. Local simulated</TableHead><TableHead>2. Automated integration</TableHead><TableHead>3. Real provider</TableHead><TableHead>Provider needed</TableHead></TableRow></TableHeader>
          <TableBody>{view.criteria.map(criterion => <TableRow key={criterion.id} data-criterion={criterion.id}>
            <TableCell>{criterion.id}</TableCell><TableCell className="max-w-72 whitespace-normal font-medium">{criterion.title}</TableCell>
            <TableCell><Evidence layer={criterion.simulated} /></TableCell><TableCell><Evidence layer={criterion.integration} /></TableCell>
            <TableCell className="max-w-72 whitespace-normal">{criterion.realProvider.status === "BLOCKED" ? <><Status status="BLOCKED" /><span className="block text-xs text-muted-foreground">{criterion.realProvider.reason}</span></> : <Status status="NOT_REQUIRED" />}</TableCell>
            <TableCell>{criterion.providerRequired ? "Yes" : "No"}</TableCell>
          </TableRow>)}</TableBody></Table></div>
        {view.results && <div className="overflow-x-auto"><Table aria-label="Test suites"><TableHeader><TableRow><TableHead>Suite</TableHead><TableHead>Command</TableHead><TableHead>Result</TableHead><TableHead className="text-right">Passed</TableHead><TableHead className="text-right">Failed</TableHead><TableHead>Run at</TableHead></TableRow></TableHeader>
          <TableBody>{view.results.suites.map(suite => <TableRow key={suite.id}><TableCell className="font-medium">{suite.label}{suite.live && <Badge variant="outline" className="ml-2">live Claude</Badge>}</TableCell>
            <TableCell className="font-mono text-xs">{suite.command}</TableCell><TableCell><Status status={suite.status} /></TableCell><TableCell className="text-right tabular-nums">{suite.passed}</TableCell>
            <TableCell className="text-right tabular-nums">{suite.failed}</TableCell><TableCell>{formatLeadDate(suite.startedAt, true)}</TableCell></TableRow>)}</TableBody></Table></div>}
      </CardContent></Card>
  </div>;
}
