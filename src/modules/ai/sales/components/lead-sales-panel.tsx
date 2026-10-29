"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bot, CalendarCheck2, ClipboardCopy, Gauge, History, ListChecks, Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/modules/leads/components/lead-ui";
import { aiContentHref } from "../../content/components/ai-content-link";
import type { LeadAnalysisOutput, ViewingBriefOutput } from "../analysis";
import { errorMessage, salesGet, salesSend, type LeadIntelligenceView } from "../client";
import type { FollowUpSuggestion, SuggestionAction } from "../follow-ups";
import { LEAD_READINESS, LEAD_TIMELINES, type AiLeadPriority } from "../scoring";

const dubai = (iso: string | null | undefined) => iso ? new Intl.DateTimeFormat("en-GB", {timeZone: "Asia/Dubai", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"}).format(new Date(iso)) : "";
const priorityTone: Record<AiLeadPriority, string> = {
  HIGH: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  MEDIUM: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  LOW: "border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  INSUFFICIENT_DATA: "border-border bg-muted text-muted-foreground",
};
const severityTone = {HIGH: "destructive", MEDIUM: "secondary", LOW: "outline"} as const;
const sectionAnchor: Record<string, string> = {"follow-up": "#follow-up-history", viewings: "#lead-viewings", requirements: "#lead-requirements", qualification: "#lead-qualification"};

type Factor = {key: string; label: string; status: string; points: number | null; maxPoints: number; evidence: string};
type StoredAnalysis = {analysis: LeadAnalysisOutput; removedReferences: string[]; factsReadAt: string};
type StoredBrief = {brief: ViewingBriefOutput; warnings: Array<{message: string; text: string}>; factsReadAt: string; propertyReference: string};

function ActionButtons({actions, leadId}: {actions: SuggestionAction[]; leadId: string}) {
  return <div className="flex flex-wrap gap-2">{actions.map((action, index) => action.kind === "OPEN_SECTION"
    ? <a key={index} href={sectionAnchor[action.section]} className={buttonVariants({variant: "ghost", size: "sm"})}>Open {action.section.replace("-", " ")}</a>
    : <Link key={index} href={aiContentHref(action.kind === "WHATSAPP_DRAFT" ? "WHATSAPP_MESSAGE" : "EMAIL", action.purpose, [{kind: "leadId", id: leadId}, ...(action.propertyId ? [{kind: "propertyId" as const, id: action.propertyId}] : [])])}
      className={buttonVariants({variant: "outline", size: "sm"})}><Wand2 aria-hidden="true" />{action.kind === "WHATSAPP_DRAFT" ? "Draft WhatsApp" : "Draft email"}</Link>)}</div>;
}

export function LeadSalesPanel({leadId, organizationId}: {leadId: string; organizationId: string}) {
  const [view, setView] = useState<LeadIntelligenceView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "evaluate" | "analyze" | "qualification" | "review" | string>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const fetchView = useCallback(() => salesGet<LeadIntelligenceView>(`/api/ai/sales/leads/${leadId}`)
    .then(result => { setView(result); setLoadError(null); }, error => setLoadError(errorMessage(error, "Sales intelligence could not be loaded."))), [leadId]);
  useEffect(() => { void fetchView(); }, [fetchView]);
  const load = () => { setLoadError(null); void fetchView(); };

  const run = async (key: string, work: () => Promise<LeadIntelligenceView>) => {
    setBusy(key); setActionError(null);
    try { setView(await work()); return true; }
    catch (error) { setActionError(errorMessage(error, "The request could not be completed.")); return false; }
    finally { setBusy(null); }
  };

  if (loadError) return <Card id="ai-sales" className="scroll-mt-24 shadow-xs ring-border"><CardHeader><CardTitle>AI sales assistant</CardTitle></CardHeader><CardContent className="space-y-3"><p role="alert" className="text-sm text-destructive">{loadError}</p><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw aria-hidden="true" />Try again</Button></CardContent></Card>;
  if (!view) return <div id="ai-sales" role="status" className="animate-pulse rounded-xl border p-6 text-sm text-muted-foreground">Loading AI sales assistant...</div>;

  const assessment = view.latestAssessment;
  const priority = (view.review?.reviewedPriority ?? assessment?.priority ?? null) as AiLeadPriority | null;
  const analysis = view.latestAnalysis?.content as StoredAnalysis | undefined;
  const brief = view.latestViewingBrief?.content as StoredBrief | undefined;
  const outdated = assessment && (assessment.score !== view.currentEstimate.score || assessment.priority !== view.currentEstimate.priority);
  const matchById = new Map(view.matches.items.map(item => [item.propertyId, item]));

  return <Card id="ai-sales" className="scroll-mt-24 gap-5 py-5 shadow-xs ring-border">
    <CardHeader className="px-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><Sparkles className="size-4 text-primary" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>AI sales assistant</CardTitle></div>
          <CardDescription className="mt-1">Rule-based qualification, matching inventory and suggested next steps from this lead&apos;s recorded CRM data. Suggestions never send messages or change the lead.</CardDescription></div>
        {view.canEdit && <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void run("evaluate", () => salesSend(`/api/ai/sales/leads/${leadId}/evaluate`, organizationId, "POST"))}>{busy === "evaluate" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Gauge aria-hidden="true" />}Evaluate score</Button>
          <Button size="sm" disabled={busy !== null || !view.aiAvailable} title={view.aiUnavailableReason ?? undefined} onClick={() => void run("analyze", () => salesSend(`/api/ai/sales/leads/${leadId}/analyze`, organizationId, "POST", {}, "Claude could not analyse this lead."))}>{busy === "analyze" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Bot aria-hidden="true" />}{busy === "analyze" ? "Analysing..." : "Analyze with Claude"}</Button>
        </div>}
      </div>
      {!view.aiAvailable && <p className="mt-2 text-xs text-muted-foreground">{view.aiUnavailableReason} Rule-based scoring and suggestions still work.</p>}
      {actionError && <p role="alert" className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{actionError}</p>}
      {busy === "analyze" && <p role="status" className="mt-2 text-xs text-muted-foreground">Claude is reading the verified facts for this lead. This usually takes under a minute.</p>}
    </CardHeader>

    <CardContent className="space-y-6 px-5 sm:px-6">
      <section aria-labelledby="lead-score-title" className="rounded-xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h3 id="lead-score-title" className="text-sm font-semibold">Lead qualification</h3>
            {assessment ? <div className="mt-2 flex flex-wrap items-baseline gap-3">
              {assessment.score != null ? <p className="text-3xl font-semibold tabular-nums">{assessment.score}<span className="text-base font-normal text-muted-foreground">/100</span></p>
                : <p className="text-base font-semibold">{assessment.state === "CLOSED" ? "Not scored (closed lead)" : "Insufficient data"}</p>}
              {priority && <Badge variant="outline" className={priorityTone[priority]}>{view.labels.priority[priority]}{view.review ? " (reviewed)" : ""}</Badge>}
            </div> : <p className="mt-2 text-sm text-muted-foreground">Not evaluated yet. Click Evaluate score; no AI allowance is used.</p>}
          </div>
          {assessment && view.canEdit && assessment.priority !== "INSUFFICIENT_DATA" && <Button variant="ghost" size="sm" onClick={() => setReviewOpen(open => !open)}>Review priority</Button>}
        </div>
        {assessment && <p className="mt-2 text-[11px] text-muted-foreground">Evaluated {dubai(assessment.evaluatedAt)} by {assessment.evaluatedBy} · rules {assessment.ruleVersion} (settings {assessment.configHash}){outdated ? ` · Current data would give ${view.currentEstimate.score ?? "insufficient data"}; re-evaluate to update.` : ""}</p>}
        {view.review && <p className="mt-2 text-xs text-muted-foreground">Suggested {view.labels.priority[view.review.suggestedPriority as AiLeadPriority].toLowerCase()}, reviewed as {view.labels.priority[view.review.reviewedPriority as AiLeadPriority].toLowerCase()} by {view.review.createdBy}: &ldquo;{view.review.reason}&rdquo;</p>}
        {reviewOpen && assessment && <ReviewForm assessmentId={assessment.id} busy={busy === "review"} onCancel={() => setReviewOpen(false)} onSubmit={async (reviewedPriority, reason) => {
          if (await run("review", () => salesSend(`/api/ai/sales/leads/${leadId}/review`, organizationId, "POST", {assessmentId: assessment.id, reviewedPriority, reason}))) setReviewOpen(false);
        }} />}
        {assessment && (assessment.factors as Factor[]).length > 0 && <table className="mt-4 w-full text-left text-xs"><caption className="sr-only">Score factors</caption>
          <thead><tr className="border-b text-muted-foreground"><th className="py-2 pr-3 font-medium">Factor</th><th className="py-2 pr-3 font-medium">Points</th><th className="py-2 font-medium">Evidence</th></tr></thead>
          <tbody>{(assessment.factors as Factor[]).map(factor => <tr key={factor.key} className="border-b last:border-0 align-top">
            <td className="py-2 pr-3 font-medium">{factor.label}</td>
            <td className="py-2 pr-3 tabular-nums">{factor.status === "EVALUATED" ? `${factor.points} / ${factor.maxPoints}` : factor.status === "MISSING" ? "Missing" : "Not available"}</td>
            <td className="py-2 text-muted-foreground">{factor.evidence}</td></tr>)}</tbody></table>}
        {assessment && (assessment.missing as Array<{label: string}>).length > 0 && <p className="mt-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">Missing information:</span> {(assessment.missing as Array<{label: string}>).map(item => item.label).join(", ")}.</p>}
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">The score uses only recorded sales signals (requirements, inventory fit, customer-stated timeline and readiness, interactions, viewings and engagement). It never uses nationality, language or other personal characteristics, is advisory only, and must never be used to refuse or limit service.</p>
      </section>

      <QualificationForm view={view} busy={busy === "qualification"} onSave={(timeline, readiness) => run("qualification", () => salesSend(`/api/ai/sales/leads/${leadId}/qualification`, organizationId, "PUT", {expectedRevision: view.qualification.revision, timeline, readiness}))} />

      <section aria-labelledby="lead-suggestions-title">
        <div className="flex items-center gap-2"><ListChecks className="size-4 text-muted-foreground" aria-hidden="true" /><h3 id="lead-suggestions-title" className="text-sm font-semibold">Suggested next actions</h3></div>
        <p className="mt-1 text-xs text-muted-foreground">From recorded follow-ups, viewings, shortlist and activity. Nothing is sent or scheduled automatically.</p>
        {view.suggestions.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{view.archived || ["WON", "LOST", "CONVERTED"].includes(view.status) ? "This lead is closed; no follow-up is suggested." : "Nothing needs attention right now."}</p>
          : <ul className="mt-3 space-y-3">{view.suggestions.map((item: FollowUpSuggestion, index) => <li key={`${item.code}-${index}`} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2"><Badge variant={severityTone[item.severity]}>{item.severity.toLowerCase()}</Badge><p className="text-sm font-medium">{item.title}</p></div>
            <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
            {view.canEdit && <div className="mt-2"><ActionButtons actions={item.actions} leadId={leadId} /></div>}
          </li>)}</ul>}
      </section>

      {analysis && <section aria-labelledby="lead-analysis-title" className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Bot className="size-4 text-primary" aria-hidden="true" /><h3 id="lead-analysis-title" className="text-sm font-semibold">Claude analysis</h3><Badge variant="outline">AI-generated</Badge></div>
          <p className="text-[11px] text-muted-foreground">{dubai(view.latestAnalysis!.createdAt)} · {view.latestAnalysis!.createdBy} · facts read {dubai(analysis.factsReadAt)}</p></div>
        <p className="mt-3 text-sm leading-6">{analysis.analysis.summary}</p>
        {analysis.analysis.nextActions.length > 0 && <><h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended next actions</h4>
          <ol className="mt-2 space-y-2">{analysis.analysis.nextActions.map((action, index) => <li key={index} className="text-sm"><span className="font-medium">{index + 1}. {action.title}</span> <Badge variant="outline" className="ml-1 text-[10px]">{action.urgency.toLowerCase()}</Badge><p className="text-xs text-muted-foreground">{action.reason}</p></li>)}</ol></>}
        {analysis.analysis.propertyRecommendations.length > 0 && <><h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Property recommendations</h4>
          <ul className="mt-2 space-y-2">{analysis.analysis.propertyRecommendations.map(item => {
            const match = matchById.get(item.propertyId);
            return <li key={item.propertyId} className="rounded-lg border bg-background p-3 text-sm">
              <p className="font-medium">{match ? <Link href={match.link} className="text-primary hover:underline">{match.reference}</Link> : "Property no longer in your matches"}{match?.listing.price ? <span className="ml-2 font-normal text-muted-foreground">{match.listing.price}</span> : null}</p>
              <p className="mt-1 text-xs">{item.whyItFits}</p>{item.considerations && <p className="mt-1 text-xs text-muted-foreground">To check: {item.considerations}</p>}
            </li>;
          })}</ul>{analysis.analysis.comparisonNote && <p className="mt-2 text-xs text-muted-foreground">{analysis.analysis.comparisonNote}</p>}</>}
        {analysis.analysis.questionsToAsk.length > 0 && <><h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Questions to ask</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{analysis.analysis.questionsToAsk.map((question, index) => <li key={index}>{question}</li>)}</ul></>}
        {analysis.analysis.followUpRecommendation && <p className="mt-4 text-sm"><span className="font-medium">Follow-up: </span>{analysis.analysis.followUpRecommendation}</p>}
        {view.canEdit && <div className="mt-3 flex flex-wrap gap-2">
          <Link href={aiContentHref("WHATSAPP_MESSAGE", "ENQUIRY_FOLLOW_UP", [{kind: "leadId", id: leadId}])} className={buttonVariants({variant: "outline", size: "sm"})}><Wand2 aria-hidden="true" />Prepare WhatsApp follow-up</Link>
          <Link href={aiContentHref("EMAIL", "FOLLOW_UP", [{kind: "leadId", id: leadId}])} className={buttonVariants({variant: "outline", size: "sm"})}><Wand2 aria-hidden="true" />Prepare email follow-up</Link>
        </div>}
        {(analysis.analysis.caveats.length > 0 || analysis.removedReferences.length > 0) && <div className="mt-3 text-[11px] text-muted-foreground">
          {analysis.analysis.caveats.map((caveat, index) => <p key={index}>{caveat}</p>)}
          {analysis.removedReferences.length > 0 && <p className="flex items-center gap-1"><AlertTriangle className="size-3" aria-hidden="true" />{analysis.removedReferences.length} property reference(s) Claude gave were not among your verified matches and were removed.</p>}
        </div>}
        <p className="mt-3 text-[11px] text-muted-foreground">AI-generated from CRM records you are permitted to see. The score above is calculated by EstateOS rules, not by Claude. Review before acting.</p>
      </section>}

      <section aria-labelledby="lead-matches-title">
        <h3 id="lead-matches-title" className="text-sm font-semibold">Matching properties</h3>
        {!view.inventoryAccess ? <p className="mt-2 text-sm text-muted-foreground">{view.archived ? "Archived leads are not matched." : "Your role has no inventory access, so properties are not matched."}</p>
          : view.matches.items.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No available property with an active listing matches the recorded requirements.</p>
          : <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs"><caption className="sr-only">Available properties matching this lead</caption>
            <thead><tr className="border-b text-muted-foreground"><th className="py-2 pr-3 font-medium">Property</th><th className="py-2 pr-3 font-medium">Price</th><th className="py-2 pr-3 font-medium">Location</th><th className="py-2 pr-3 font-medium">Specifications</th><th className="py-2 font-medium">Why it matches</th></tr></thead>
            <tbody>{view.matches.items.map(item => <tr key={item.propertyId} className="border-b align-top last:border-0">
              <td className="py-2 pr-3"><Link href={item.link} className="font-medium text-primary hover:underline">{item.reference}</Link>{item.project && <p className="text-muted-foreground">{item.project}</p>}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{item.listing.price ?? "Not recorded"}<p className="text-muted-foreground">{item.listing.purpose === "RENT" ? "Rent" : "Sale"}</p></td>
              <td className="py-2 pr-3">{[item.location.community, item.location.area !== item.location.community ? item.location.area : null, item.location.emirate?.replaceAll("_", " ").toLowerCase()].filter(Boolean).join(", ") || "Not recorded"}</td>
              <td className="py-2 pr-3">{[item.propertyType.replaceAll("_", " ").toLowerCase(), item.bedrooms != null ? (item.bedrooms === 0 ? "studio" : `${item.bedrooms} bed`) : null, item.bathrooms != null ? `${item.bathrooms} bath` : null, item.size].filter(Boolean).join(" · ")}</td>
              <td className="py-2 text-muted-foreground">{item.matchReasons.slice(1).join("; ")}</td></tr>)}</tbody></table></div>}
        {view.inventoryAccess && <details className="mt-2 text-[11px] text-muted-foreground"><summary className="cursor-pointer">Matching criteria and coverage</summary>
          <ul className="mt-1 list-disc pl-5">{view.matches.criteriaGaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul>
          {view.matches.coverage && <p className="mt-1">{view.matches.total} match(es) among {view.matches.coverage.reviewed} of {view.matches.coverage.inScope} available properties with active listings you can access.</p>}</details>}
      </section>

      {view.inventoryAccess && <section aria-labelledby="viewing-prep-title">
        <div className="flex items-center gap-2"><CalendarCheck2 className="size-4 text-muted-foreground" aria-hidden="true" /><h3 id="viewing-prep-title" className="text-sm font-semibold">Viewing preparation</h3></div>
        {view.viewings.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No viewings recorded. Schedule one in Viewing appointments.</p>
          : <ul className="mt-2 space-y-2">{view.viewings.slice(0, 6).map(viewing => <li key={viewing.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
            <span><span className="font-medium">{viewing.propertyReference}</span> <span className="text-muted-foreground">· {dubai(viewing.scheduledAt)} · {viewing.status.toLowerCase()} · confirmation {viewing.customerConfirmation.toLowerCase()}</span></span>
            {view.canEdit && <Button variant="outline" size="sm" disabled={busy !== null || !view.aiAvailable} onClick={() => void run(`brief:${viewing.id}`, () => salesSend(`/api/ai/sales/viewings/${viewing.id}/brief`, organizationId, "POST", {leadId}, "The viewing summary could not be prepared."))}>{busy === `brief:${viewing.id}` ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}Prepare viewing summary</Button>}
          </li>)}</ul>}
        {brief && <ViewingBrief brief={brief} createdAt={view.latestViewingBrief!.createdAt} leadId={leadId} propertyId={view.viewings.find(item => item.id === view.latestViewingBrief!.viewingId)?.propertyId} />}
        <p className="mt-2 text-[11px] text-muted-foreground">Viewing outcomes are recorded only by you in Viewing appointments.</p>
      </section>}

      {view.history.length > 0 && <details className="rounded-xl border p-4 text-xs"><summary className="flex cursor-pointer items-center gap-2 font-medium"><History className="size-3.5" aria-hidden="true" />Assessment history ({view.history.length})</summary>
        <ul className="mt-3 space-y-1">{view.history.map(item => <li key={item.id} className="text-muted-foreground">{dubai(item.evaluatedAt)} · {item.score ?? "—"} · {view.labels.priority[item.priority]} · rules {item.ruleVersion} · {item.evaluatedBy}</li>)}</ul>
        {view.reviews.length > 0 && <><p className="mt-3 font-medium">Priority reviews</p><ul className="mt-1 space-y-1">{view.reviews.map(review => <li key={review.id} className="text-muted-foreground">{dubai(review.createdAt)} · {review.createdBy}: {view.labels.priority[review.suggestedPriority as AiLeadPriority]} → {view.labels.priority[review.reviewedPriority as AiLeadPriority]} — {review.reason}</li>)}</ul></>}
      </details>}
    </CardContent>
  </Card>;
}

function ReviewForm({assessmentId, busy, onCancel, onSubmit}: {assessmentId: string; busy: boolean; onCancel: () => void; onSubmit: (priority: "HIGH" | "MEDIUM" | "LOW", reason: string) => void}) {
  const [priority, setPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [reason, setReason] = useState("");
  return <form className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-3" onSubmit={event => { event.preventDefault(); onSubmit(priority, reason); }} aria-label="Review the suggested priority">
    <input type="hidden" value={assessmentId} readOnly />
    <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
      <div className="space-y-1.5"><Label htmlFor="review-priority">Reviewed priority</Label><select id="review-priority" value={priority} onChange={event => setPriority(event.target.value as typeof priority)} className={selectClassName}><option value="HIGH">High priority</option><option value="MEDIUM">Medium priority</option><option value="LOW">Low priority</option></select></div>
      <div className="space-y-1.5"><Label htmlFor="review-reason">Reason (required)</Label><textarea id="review-reason" value={reason} onChange={event => setReason(event.target.value)} minLength={10} maxLength={500} required rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="For example: customer confirmed by phone they are ready to make an offer this week." /></div>
    </div>
    <p className="text-[11px] text-muted-foreground">Your review is recorded with your name and audited. It does not change the lead record or the calculated score.</p>
    <div className="flex gap-2"><Button type="submit" size="sm" disabled={busy || reason.trim().length < 10}>{busy && <Loader2 className="animate-spin" aria-hidden="true" />}Save review</Button><Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button></div>
  </form>;
}

function QualificationForm({view, busy, onSave}: {view: LeadIntelligenceView; busy: boolean; onSave: (timeline: string | null, readiness: string | null) => Promise<boolean>}) {
  const [timeline, setTimeline] = useState(view.qualification.timeline ?? "");
  const [readiness, setReadiness] = useState(view.qualification.readiness ?? "");
  const changed = timeline !== (view.qualification.timeline ?? "") || readiness !== (view.qualification.readiness ?? "");
  return <section id="lead-qualification" aria-labelledby="qualification-title" className="scroll-mt-24 rounded-xl border p-4">
    <h3 id="qualification-title" className="text-sm font-semibold">Customer-stated qualification</h3>
    <p className="mt-1 text-xs text-muted-foreground">Record only what the customer told you. These details are used in the score and appear in the lead activity.</p>
    <form className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={event => { event.preventDefault(); void onSave(timeline || null, readiness || null); }}>
      <div className="space-y-1.5"><Label htmlFor="qualification-timeline">Purchase or rental timeline</Label><select id="qualification-timeline" value={timeline} disabled={!view.canEdit || busy} onChange={event => setTimeline(event.target.value)} className={selectClassName}><option value="">Not recorded</option>{LEAD_TIMELINES.map(value => <option key={value} value={value}>{view.labels.timeline[value]}</option>)}</select></div>
      <div className="space-y-1.5"><Label htmlFor="qualification-readiness">Readiness to proceed</Label><select id="qualification-readiness" value={readiness} disabled={!view.canEdit || busy} onChange={event => setReadiness(event.target.value)} className={selectClassName}><option value="">Not recorded</option>{LEAD_READINESS.map(value => <option key={value} value={value}>{view.labels.readiness[value]}</option>)}</select></div>
      {view.canEdit && <Button type="submit" variant="outline" disabled={busy || !changed}>{busy && <Loader2 className="animate-spin" aria-hidden="true" />}Save</Button>}
    </form>
    {view.qualification.updatedAt && <p className="mt-2 text-[11px] text-muted-foreground">Last updated {dubai(view.qualification.updatedAt)} by {view.qualification.updatedBy}. Re-evaluate the score to include changes.</p>}
  </section>;
}

function ViewingBrief({brief, createdAt, leadId, propertyId}: {brief: StoredBrief; createdAt: string; leadId: string; propertyId?: string}) {
  const [message, setMessage] = useState(brief.brief.postViewingMessage);
  const [copied, setCopied] = useState(false);
  const list = (title: string, items: string[]) => items.length ? <div><h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{items.map((item, index) => <li key={index}>{item}</li>)}</ul></div> : null;
  return <div className="mt-3 space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">Viewing summary: {brief.propertyReference} <Badge variant="outline" className="ml-1">AI-generated</Badge></p><p className="text-[11px] text-muted-foreground">{new Date(createdAt).toLocaleString("en-GB", {timeZone: "Asia/Dubai"})} · facts read {new Date(brief.factsReadAt).toLocaleString("en-GB", {timeZone: "Asia/Dubai"})}</p></div>
    <p className="text-sm leading-6">{brief.brief.summary}</p>
    <div className="grid gap-3 md:grid-cols-2">{list("Client requirements", brief.brief.clientRequirements)}{list("Property highlights", brief.brief.propertyHighlights)}{list("Questions to clarify", brief.brief.questionsToClarify)}{list("Comparison notes", brief.brief.comparisonNotes)}{list("Watch-outs", brief.brief.watchOuts)}</div>
    <div className="space-y-1.5"><Label htmlFor="post-viewing-message">Post-viewing WhatsApp draft (editable, not sent)</Label>
      <textarea id="post-viewing-message" value={message} onChange={event => { setMessage(event.target.value); setCopied(false); }} rows={5} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
      {brief.warnings.length > 0 && <ul className="space-y-1 text-[11px] text-amber-700 dark:text-amber-300">{brief.warnings.map((warning, index) => <li key={index} className="flex gap-1"><AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />{warning.text ? `"${warning.text}": ` : ""}{warning.message}</li>)}</ul>}
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => { void navigator.clipboard?.writeText(message).then(() => setCopied(true)); }}><ClipboardCopy aria-hidden="true" />{copied ? "Copied" : "Copy text"}</Button>
        <Link href={aiContentHref("WHATSAPP_MESSAGE", "POST_VIEWING_FOLLOW_UP", [{kind: "leadId", id: leadId}, ...(propertyId ? [{kind: "propertyId" as const, id: propertyId}] : [])])} className={buttonVariants({variant: "outline", size: "sm"})}><Wand2 aria-hidden="true" />Open in Content Studio</Link></div>
    </div>
  </div>;
}
