"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { aiContentHref } from "@/modules/ai/content/components/ai-content-link";
import { formatLeadDate, fromDubaiDateTimeInput, LeadField, LeadFormMessage, toDubaiDateTimeInput } from "@/modules/leads/components/lead-ui";
import { communicationsGet, communicationsSend, errorMessage } from "../client";
import { SUGGESTION_LABELS, type CheckedItem, type SuggestionKind } from "../intelligence";
import { timestamp } from "../media";
import type { CallSummariesView } from "../server/intelligence";

type Summary = CallSummariesView["summaries"][number];
type Suggestion = Summary["suggestions"][number];
const FOLLOW_UP_KINDS = ["FOLLOW_UP", "CLARIFY_BUDGET", "SHARE_PAYMENT_PLAN", "ALTERNATIVE_PROPERTY"];
const CONFIDENCE = {HIGH: "High confidence", MEDIUM: "Medium confidence", LOW: "Low confidence"} as const;

function Point({item}: {item: CheckedItem}) {
  return <li className="space-y-1">
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-sm">{item.text}</span>
      <Badge variant={item.basis === "STATED" ? "secondary" : "outline"}>{item.basis === "STATED" ? "Said on the call" : "Claude's inference"}</Badge>
      {item.confidence === "LOW" && <Badge variant="outline">Low confidence</Badge>}
      {!item.verified && <Badge variant="destructive">Not found in the source</Badge>}
    </div>
    {item.evidence.filter(entry => entry.verified).slice(0, 2).map((entry, index) => <p key={index} dir="auto" className="border-l-2 pl-2 text-xs text-muted-foreground">
      {entry.at !== null && <span className="mr-1 font-mono">{timestamp(entry.at)}</span>}&ldquo;{entry.quote}&rdquo; <span className="text-[10px]">({entry.ref})</span></p>)}
  </li>;
}

function Section({title, items}: {title: string; items: Array<CheckedItem | null>}) {
  const present = items.filter((item): item is CheckedItem => item !== null);
  if (!present.length) return null;
  return <div><h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4><ul className="space-y-2">{present.map((item, index) => <Point key={index} item={item} />)}</ul></div>;
}

function AcceptFollowUp({suggestion, organizationId, onDone}: {suggestion: Suggestion; organizationId: string; onDone: () => void}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  /** Tomorrow at this time, set when the dialog opens (not during render). */
  const [defaultAt, setDefaultAt] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await communicationsSend(`/api/communications/suggestions/${suggestion.id}/decide`, organizationId, "POST", {action: "ACCEPT", followUpAt: fromDubaiDateTimeInput(String(form.get("followUpAt") ?? "")), title: String(form.get("title") ?? "").trim() || undefined});
      setOpen(false); toast.success("Follow-up scheduled on the lead."); onDone();
    } catch (problem) { setError(errorMessage(problem, "The follow-up could not be scheduled.")); }
    finally { setPending(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!pending) { setOpen(value); setError(""); if (value) setDefaultAt(toDubaiDateTimeInput(new Date(Date.now() + 86_400_000).toISOString())); } }}>
    <DialogTrigger render={<Button size="sm" variant="outline" />}>Schedule follow-up</DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Schedule a follow-up</DialogTitle><DialogDescription>A follow-up on the lead, assigned like any other. Nothing is sent to the customer.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4">
        <LeadField id={`${prefix}-title`} label="Title"><Input id={`${prefix}-title`} name="title" maxLength={500} defaultValue={suggestion.title} /></LeadField>
        <LeadField id={`${prefix}-at`} label="When (Dubai time)"><Input id={`${prefix}-at`} name="followUpAt" type="datetime-local" required defaultValue={defaultAt} key={defaultAt} /></LeadField>
        <Button type="submit">{pending ? "Scheduling…" : "Schedule"}</Button>
      </fieldset><LeadFormMessage message={error} /></form>
    </DialogContent>
  </Dialog>;
}

/** Claude summaries of a call: drafts with checked evidence, and suggestions a person decides. */
export function CallSummaryPanel({callId, organizationId}: {callId: string; organizationId: string}) {
  const [view, setView] = useState<CallSummariesView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => communicationsGet<CallSummariesView>(`/api/communications/calls/${callId}/summaries`, "Summaries could not be loaded.")
    .then(result => { setView(result); setError(null); }, problem => setError(errorMessage(problem, "Summaries could not be loaded."))), [callId]);
  useEffect(() => { void load(); }, [load]);

  async function act(key: string, path: string, body: unknown, success: string) {
    setBusy(key);
    try { await communicationsSend(path, organizationId, "POST", body); toast.success(success); }
    catch (problem) { toast.error(errorMessage(problem, "The request could not be completed.")); }
    finally { setBusy(null); void load(); }
  }

  const header = <CardHeader className="px-5"><div className="flex items-center gap-2"><Sparkles className="size-4 text-muted-foreground" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>Claude summary</CardTitle></div>
    <CardDescription>A draft for you to check. Points quote the call; anything not found in it is marked. Claude never updates the customer&apos;s record or sends messages.</CardDescription></CardHeader>;
  if (error) return <Card className="gap-3 py-5 shadow-xs ring-border">{header}<CardContent className="space-y-2 px-5"><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw aria-hidden="true" />Try again</Button></CardContent></Card>;
  if (!view) return <div role="status" className="animate-pulse rounded-xl border p-6 text-sm text-muted-foreground">Loading summaries...</div>;
  if (!view.aiAnalysisEnabled) return <Card className="gap-3 py-5 shadow-xs ring-border">{header}<CardContent className="px-5 text-sm text-muted-foreground">Claude call summaries are off for your company. An owner or administrator can enable them in Calling settings.</CardContent></Card>;

  return <Card className="gap-4 py-5 shadow-xs ring-border">{header}<CardContent className="space-y-5 px-5">
    {view.canGenerate && <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={!view.transcripts.length || busy !== null} onClick={() => void act("generate", `/api/communications/calls/${callId}/summaries`, {source: "TRANSCRIPT"}, "Summary ready to review.")}>
        {busy === "generate" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}Summarise the transcript</Button>
      <Button size="sm" variant="outline" disabled={!view.hasNotes || busy !== null} onClick={() => void act("generate", `/api/communications/calls/${callId}/summaries`, {source: "NOTES"}, "Summary ready to review.")}>Summarise my notes</Button>
      {!view.transcripts.length && !view.hasNotes && <p className="text-xs text-muted-foreground">Add notes or a transcript to summarise this call.</p>}
    </div>}
    {!view.summaries.length ? <p className="text-sm text-muted-foreground">No summary yet.</p> : view.summaries.map(summary => <article key={summary.id} className="space-y-4 rounded-lg border p-4" aria-label="Call summary">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Badge variant={summary.status === "REVIEWED" ? "secondary" : "outline"}>{summary.status === "DRAFT" ? "Draft, not reviewed" : summary.status === "REVIEWED" ? "Reviewed" : "Dismissed"}</Badge>
          <Badge variant="outline">{CONFIDENCE[summary.summary.overallConfidence]}</Badge>
          {summary.unverifiedCount > 0 && <Badge variant="destructive">{summary.unverifiedCount} unsupported {summary.unverifiedCount === 1 ? "point" : "points"}</Badge>}
          <span className="text-muted-foreground">From {summary.sourceKind === "TRANSCRIPT" ? "the transcript" : "the agent's notes"} · {summary.createdBy.displayName} · {formatLeadDate(summary.createdAt, true)}</span>
        </div>
        {summary.status === "DRAFT" && view.canEdit && <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void act(summary.id, `/api/communications/summaries/${summary.id}/review`, {status: "REVIEWED"}, "Marked as reviewed.")}>Mark reviewed</Button>
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void act(summary.id, `/api/communications/summaries/${summary.id}/review`, {status: "DISMISSED"}, "Summary dismissed.")}>Dismiss</Button>
        </div>}
      </div>
      <Section title="Reason for the call" items={[summary.summary.reasonForCall]} />
      <Section title="Requirements" items={summary.summary.requirements} />
      <Section title="Locations and projects" items={summary.summary.locations} />
      <Section title="Budget (only if stated)" items={[summary.summary.budget]} />
      <Section title="Preferences" items={summary.summary.preferences} />
      <Section title="Questions" items={summary.summary.questions} />
      <Section title="Agreed" items={summary.summary.agreements} />
      <Section title="Next steps" items={summary.summary.nextSteps} />
      {summary.summary.limitations && <p className="text-xs text-muted-foreground">Limitations: {summary.summary.limitations}</p>}
      {summary.suggestions.length > 0 && <div className="space-y-2 border-t pt-3"><h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suggested actions</h4>
        <ul className="space-y-2">{summary.suggestions.map(suggestion => <li key={suggestion.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
          <div className="min-w-0"><p className="text-sm font-medium">{suggestion.title}</p><p className="text-xs text-muted-foreground">{SUGGESTION_LABELS[suggestion.kind as SuggestionKind] ?? suggestion.kind} · {suggestion.detail}{!suggestion.verified && " · not found in the source"}</p></div>
          {suggestion.status !== "PENDING" ? <Badge variant="outline">{suggestion.status === "ACCEPTED" ? "Accepted" : "Dismissed"}</Badge>
            : view.canEdit && <div className="flex flex-wrap gap-1">
              {FOLLOW_UP_KINDS.includes(suggestion.kind) && view.leadId && <AcceptFollowUp suggestion={suggestion} organizationId={organizationId} onDone={() => void load()} />}
              {suggestion.kind === "PROPOSAL_DRAFT" && view.leadId && <Link className={buttonVariants({variant: "outline", size: "sm"})} href={aiContentHref("CLIENT_PROPOSAL", undefined, [{kind: "leadId", id: view.leadId}])}
                onClick={() => void communicationsSend(`/api/communications/suggestions/${suggestion.id}/decide`, organizationId, "POST", {action: "ACCEPT"}).catch(() => undefined)}>Draft in Content Studio</Link>}
              {suggestion.kind === "SCHEDULE_VIEWING" && view.leadId && <Link className={buttonVariants({variant: "outline", size: "sm"})} href={`/leads/${view.leadId}#lead-viewings`}
                onClick={() => void communicationsSend(`/api/communications/suggestions/${suggestion.id}/decide`, organizationId, "POST", {action: "ACCEPT"}).catch(() => undefined)}>Open viewings</Link>}
              <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void act(suggestion.id, `/api/communications/suggestions/${suggestion.id}/decide`, {action: "DISMISS"}, "Suggestion dismissed.")}>Dismiss</Button>
            </div>}
        </li>)}</ul></div>}
      {view.leadId && <Link href={`/leads/${view.leadId}#ai-sales`} className="inline-block text-xs font-medium text-primary hover:underline">Open the lead&apos;s AI sales review</Link>}
    </article>)}
  </CardContent></Card>;
}
