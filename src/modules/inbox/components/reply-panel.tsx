"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Check, CheckCircle2, ChevronDown, FileText, Info, Loader2, PenLine, Send, ShieldAlert, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { communicationsGet, communicationsSend, errorMessage } from "@/modules/communications/client";
import { formatLeadDate, textareaClassName } from "@/modules/leads/components/lead-ui";
import type { CheckedPoint, RequirementField } from "../assistant";
import type { InboxChannel } from "../model";
import type { CustomerContextView } from "../server/conversations";
import type { RepliesView } from "../server/outbound";
import { TemplatePicker, type ChosenTemplate, type QuickFill } from "./template-picker";

type Reply = RepliesView["replies"][number];
const STAGE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "outline", VALIDATED: "secondary", PENDING_APPROVAL: "secondary", APPROVED: "default", QUEUED: "secondary", SENT: "default", FAILED: "destructive", CANCELLED: "outline",
};
const SOURCE_LABEL = {AGENT: "Written by a person", CLAUDE: "Drafted by Claude", WORKFLOW: "Drafted by a workflow (Claude)"} as const;
const LEAD_KEY: Record<RequirementField, keyof NonNullable<CustomerContextView["lead"]>> = {
  PROPERTY_TYPE: "propertyType", LOCATION: "preferredLocation", BEDROOMS: "bedroomPreference", BUDGET_MIN: "budgetMin", BUDGET_MAX: "budgetMax", TRANSACTION: "transactionType",
};
/** The way a reply travels: written, checked, approved, then sent. */
const STEPS = ["Draft", "Checked", "Approval", "Approved", "Sent"] as const;
const STEP_OF: Record<string, number> = {DRAFT: 0, VALIDATED: 1, PENDING_APPROVAL: 2, APPROVED: 3, QUEUED: 3, SENT: 4};
const FINISHED = ["SENT", "CANCELLED"];

type Act = (key: string, path: string, body: unknown, success: string, method?: "POST" | "PUT") => Promise<boolean>;

/** Replies (draft, check, approve, send) and the Claude assistant for one conversation, shared by the thread, the composer and the details panel. */
export function useReplies({conversationId, organizationId, onSent}: {conversationId: string; organizationId: string; onSent: () => void}) {
  const [view, setView] = useState<RepliesView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const path = `/api/inbox/conversations/${conversationId}`;
  const load = useCallback(() => communicationsGet<RepliesView>(`${path}/replies`, "Replies could not be loaded.").then(data => { setView(data); setError(null); }, problem => setError(errorMessage(problem, "Replies could not be loaded."))), [path]);
  useEffect(() => { void load(); }, [load]);

  const act: Act = async (key, suffix, body, success, method = "POST") => {
    setBusy(key);
    const [replyId] = key.split(":");
    try {
      const url = method === "PUT" ? `${path}/replies/${replyId}` : `${path}/replies/${replyId}/${suffix}`;
      const result = await communicationsSend<{stage?: string; valid?: boolean}>(url, organizationId, method, body);
      if (result?.valid === false) toast.warning("The reply needs changes before it can be approved."); else toast.success(result?.stage === "FAILED" ? "The simulator refused the reply." : success);
      if (suffix === "send") onSent();
      return true;
    } catch (problem) { toast.error(errorMessage(problem, "The reply could not be changed.")); return false; }
    finally { setBusy(null); void load(); }
  };
  /** Developer simulator only: a delivery receipt through the normal event pipeline. */
  async function receipt(messageId: string, status: "DELIVERED" | "READ" | "FAILED") {
    try { await communicationsSend("/api/dev/communication-tests/inbox/receipt", organizationId, "POST", {messageId, status}); toast.success(`Simulated receipt: ${status.toLowerCase()}.`); onSent(); }
    catch (problem) { toast.error(errorMessage(problem, "The receipt could not be simulated.")); }
  }
  async function save(body: {content: string} | {template: ChosenTemplate}) {
    setBusy("new");
    try {
      await communicationsSend(`${path}/replies`, organizationId, "POST", body);
      toast.success("Draft saved. Check it, then request approval.");
      return true;
    }
    catch (problem) { toast.error(errorMessage(problem, "The draft could not be saved.")); return false; }
    finally { setBusy(null); void load(); }
  }
  async function analyse() {
    setBusy("assistant");
    try { await communicationsSend(`${path}/assistant`, organizationId, "POST", {}); toast.success("Claude's analysis is ready. Check it before using it."); return true; }
    catch (problem) { toast.error(errorMessage(problem, "Claude could not analyse the conversation.")); return false; }
    finally { setBusy(null); void load(); }
  }
  async function apply(fields: RequirementField[]) {
    if (!view?.insight) return false;
    setBusy("apply");
    try {
      const result = await communicationsSend<{applied: unknown[]}>(`${path}/assistant/apply`, organizationId, "POST", {insightId: view.insight.id, fields});
      toast.success(result.applied.length ? `Lead updated (${result.applied.length} field${result.applied.length === 1 ? "" : "s"}).` : "The lead already had these values.");
      onSent();
      return true;
    } catch (problem) { toast.error(errorMessage(problem, "The lead could not be updated.")); return false; }
    finally { setBusy(null); }
  }
  return {view, error, busy, load, act, receipt, save, analyse, apply};
}
export type RepliesState = ReturnType<typeof useReplies>;

function Stepper({stage}: {stage: string}) {
  const at = STEP_OF[stage];
  if (at === undefined) return null;
  return <ol className="flex items-center gap-1 text-[10px] text-muted-foreground" aria-label="Reply progress">{STEPS.map((step, index) => <li key={step} className="flex items-center gap-1">
    <span className={cn("flex size-4 items-center justify-center rounded-full border text-[9px]", index < at ? "border-primary bg-primary text-primary-foreground" : index === at ? "border-primary text-primary" : "border-border")}>
      {index < at ? <Check aria-hidden className="size-2.5" strokeWidth={3} /> : index + 1}</span>
    <span className={cn("hidden sm:inline", index === at && "font-medium text-foreground")}>{step}</span>
    {index < STEPS.length - 1 && <span aria-hidden className={cn("h-px w-3 sm:w-5", index < at ? "bg-primary" : "bg-border")} />}
  </li>)}</ol>;
}

function ReplyCard({reply, view, busy, act, receipt}: {reply: Reply; view: RepliesView; busy: string | null; act: Act; receipt: RepliesState["receipt"]}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(reply.content);
  const [note, setNote] = useState("");
  const base = `${reply.id}`;
  const working = busy?.startsWith(base) ?? false;
  const run = (action: string, body: Record<string, unknown>, success: string) => act(`${base}:${action}`, `${action}`, {expectedRevision: reply.revision, ...body}, success);
  const problems = reply.validation?.problems ?? [];
  const blocked = problems.some(problem => problem.blocksApproval);
  const Source = reply.source === "AGENT" ? PenLine : Bot;
  return <li className={cn("space-y-2 rounded-lg border bg-card p-3 shadow-xs", reply.stage === "DRAFT" && "border-dashed", reply.stage === "FAILED" && "border-destructive/50",
    reply.stage === "APPROVED" && "border-primary/50", FINISHED.includes(reply.stage) && "bg-muted/30 shadow-none")} data-testid="inbox-reply" data-stage={reply.stage}>
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
      <Badge variant={STAGE_VARIANT[reply.stage] ?? "outline"}>{reply.stageLabel}</Badge>
      <span className="flex items-center gap-1"><Source aria-hidden className="size-3.5" />{reply.template ? "Approved WhatsApp template" : SOURCE_LABEL[reply.source]}{reply.source !== "AGENT" && reply.edited ? ", edited" : ""}</span>
      <span>· {reply.lastEditedBy ?? reply.createdBy ?? "Team member"} · {formatLeadDate(reply.updatedAt, true)}</span>
      {reply.selfApproved && <Badge variant="outline">Self-approved (owner)</Badge>}
      <span className="ml-auto"><Stepper stage={reply.stage} /></span>
    </div>
    {editing ? <div className="space-y-2">
      <label htmlFor={`reply-${reply.id}`} className="sr-only">Edit the reply</label>
      <textarea id={`reply-${reply.id}`} value={text} onChange={event => setText(event.target.value)} rows={4} maxLength={4000} className={textareaClassName} dir="auto" />
      <div className="flex gap-2"><Button size="sm" disabled={working || !text.trim()} onClick={() => void act(`${base}:edit`, "", {expectedRevision: reply.revision, content: text}, "Reply updated.", "PUT").then(ok => ok && setEditing(false))}>Save changes</Button>
        <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setText(reply.content); }}>Discard</Button></div>
    </div> : <p dir="auto" className="whitespace-pre-wrap wrap-break-word text-sm leading-6">{reply.content}</p>}
    {problems.length > 0 && <ul className={cn("space-y-1 rounded-lg px-3 py-2 text-xs", blocked ? "bg-destructive/10" : "bg-muted/60")} aria-label="Checks">{problems.map(problem =>
      <li key={problem.code} className={cn("flex gap-1.5", problem.blocksApproval ? "text-destructive" : "text-muted-foreground")}>
        {problem.blocksApproval ? <XCircle aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
        <span>{problem.blocksApproval ? "Must fix: " : "Note: "}{problem.message}</span></li>)}</ul>}
    {reply.approvalNote && <p className="text-xs text-muted-foreground">{reply.stage === "DRAFT" ? "Returned by the approver: " : "Approver's note: "}{reply.approvalNote}</p>}
    {reply.approvedBy && ["APPROVED", "QUEUED", "SENT", "FAILED"].includes(reply.stage) && <p className="text-xs text-muted-foreground">Approved by {reply.approvedBy}{reply.approvedAt ? ` · ${formatLeadDate(reply.approvedAt, true)}` : ""}</p>}
    {reply.failureReason && <p className="text-xs text-destructive">Not delivered: {reply.failureReason}</p>}
    {reply.can.ownReply && <p className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldAlert aria-hidden className="size-3.5" />You wrote or edited this reply, so someone else must approve it.</p>}
    <div className="flex flex-wrap items-center gap-2">
      {reply.can.send && <Button size="sm" disabled={working} onClick={() => void run("send", {}, view.sendMode === "WHATSAPP" ? "Accepted by WhatsApp." : view.sendMode === "EMAIL" ? "Email sent." : "Delivered to the simulated conversation.")}>
        {busy === `${base}:send` ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />}{view.sendMode === "WHATSAPP" ? "Send on WhatsApp" : view.sendMode === "EMAIL" ? "Send by email" : "Send (simulator)"}</Button>}
      {reply.can.check && <Button size="sm" disabled={working} onClick={() => void run("check", {}, "Reply checked.")}>{busy === `${base}:check` && <Loader2 aria-hidden className="animate-spin" />}Check reply</Button>}
      {reply.can.submit && <Button size="sm" disabled={working} onClick={() => void run("submit", {}, view.approvalRequired ? "Sent for approval." : "Approved (your company does not require approval).")}>
        {view.approvalRequired ? "Request approval" : "Approve"}</Button>}
      {reply.can.decide && <>
        <Button size="sm" disabled={working} onClick={() => void run("decide", {decision: "APPROVE", note: note || undefined}, "Reply approved.")}><CheckCircle2 aria-hidden />Approve</Button>
        <label htmlFor={`reply-note-${reply.id}`} className="sr-only">Reason to return the reply</label>
        <Input id={`reply-note-${reply.id}`} value={note} onChange={event => setNote(event.target.value)} maxLength={300} placeholder="Reason (needed to return it)" className="h-7 w-52 text-xs" />
        <Button size="sm" variant="outline" disabled={working || note.trim().length < 3} onClick={() => void run("decide", {decision: "REJECT", note}, "Returned to the author.")}><XCircle aria-hidden />Return</Button>
      </>}
      {reply.can.edit && !editing && <Button size="sm" variant="outline" disabled={working} onClick={() => setEditing(true)}>Edit</Button>}
      {reply.can.cancel && <Button size="sm" variant="ghost" disabled={working} onClick={() => void run("cancel", {}, "Reply cancelled.")}>Cancel reply</Button>}
      {view.simulatorSend && reply.stage === "SENT" && reply.messageId && (["DELIVERED", "READ", "FAILED"] as const).map(status =>
        <Button key={status} size="sm" variant="ghost" disabled={working} data-testid={`simulate-${status.toLowerCase()}`} onClick={() => void receipt(reply.messageId!, status)}>Simulate {status.toLowerCase()}</Button>)}
    </div>
  </li>;
}

/** Replies on their way (in the thread, under the messages), then the finished ones folded away. */
export function ReplyList({replies}: {replies: RepliesState}) {
  const {view, busy, act, receipt, error} = replies;
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!view || !view.replies.length) return null;
  const active = view.replies.filter(reply => !FINISHED.includes(reply.stage));
  const finished = view.replies.filter(reply => FINISHED.includes(reply.stage));
  const card = (reply: Reply) => <ReplyCard key={`${reply.id}:${reply.revision}`} reply={reply} view={view} busy={busy} act={act} receipt={receipt} />;
  return <section aria-label="Replies" className="space-y-3">
    {active.length > 0 && <>
      <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"><span className="h-px flex-1 bg-border" />Replies in progress ({active.length})<span className="h-px flex-1 bg-border" /></h3>
      <ul className="space-y-3">{active.map(card)}</ul>
    </>}
    {finished.length > 0 && <details className="group rounded-xl border bg-muted/20 px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-muted-foreground">
        <ChevronDown aria-hidden className="size-3.5 transition-transform group-open:rotate-180" />Sent and cancelled replies ({finished.length})</summary>
      <ul className="mt-3 space-y-3">{finished.map(card)}</ul>
    </details>}
  </section>;
}

/** The reply box, docked under the thread like a mail or chat composer. Everything written is saved as a draft and approved before it is sent. */
export function Composer({replies, conversationId, channel, recipient, notice, templates, onAssistant}: {replies: RepliesState; conversationId: string; channel: InboxChannel; recipient: string;
  /** Why this channel cannot send at all, when it cannot. */ notice: string | null;
  /** Phase 7B.2: approved WhatsApp templates (a real WhatsApp conversation), with quick fills for their blanks. */ templates: {source: string; quickFills: QuickFill[]} | null;
  onAssistant: () => void}) {
  const {view, busy, save, analyse} = replies;
  const [draft, setDraft] = useState("");
  const [usingTemplate, setUsingTemplate] = useState(false);
  if (!view) return <div role="status" className="border-t px-4 py-4 text-sm text-muted-foreground">Loading replies…</div>;
  const ready = view.sendMode !== null;
  async function submit() {
    if (draft.trim() && await save({content: draft})) setDraft("");
  }
  const sendingNote = `${view.sendingNote} ${view.approvalRequired ? "Replies need an owner, administrator or manager to approve them." : ""}`;
  return <div className="shrink-0 border-t bg-card/95 px-2.5 py-2 sm:px-3">
    <div title={`${notice ? `${notice} ` : ""}${sendingNote}`} className={cn("mb-1.5 flex items-start gap-1.5 text-[11px] leading-4", ready ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300")}>
      {ready ? <Send aria-hidden className="mt-px size-3 shrink-0" /> : <Info aria-hidden className="mt-px size-3 shrink-0" />}
      <p className="line-clamp-2">{notice && <span className="text-muted-foreground" data-testid="sending-disabled">{notice} </span>}
        <span data-testid="reply-sending-note">{sendingNote}</span></p></div>
    {view.templateOnly || usingTemplate ? <div className="space-y-2" data-testid="template-composer">
      <p className="text-xs text-muted-foreground">{view.templateOnly
        ? "The customer has not written in the last 24 hours, so WhatsApp allows only an approved template. Meta may charge for template messages."
        : "An approved template from your WhatsApp account. Meta may charge for template messages."}</p>
      {templates ? <TemplatePicker source={templates.source} quickFills={templates.quickFills} submitLabel="Save template reply" busy={busy === "new"}
        onCancel={view.templateOnly ? undefined : () => setUsingTemplate(false)}
        onSubmit={async template => { if (await save({template})) setUsingTemplate(false); }} />
        : <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Templates are only for real WhatsApp conversations.</p>}
    </div>
    : <form className="rounded-xl border bg-background shadow-xs transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30"
        onSubmit={event => { event.preventDefault(); void submit(); }}>
      <label htmlFor={`draft-${conversationId}`} className="sr-only">Write a reply</label>
      <textarea id={`draft-${conversationId}`} value={draft} onChange={event => setDraft(event.target.value)} rows={draft ? 4 : 2} maxLength={4000} dir="auto"
        onKeyDown={event => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void submit(); } }}
        className="block max-h-56 min-h-12 w-full resize-y rounded-t-xl bg-transparent px-3 pt-2 text-sm outline-none placeholder:text-muted-foreground"
        placeholder={`${channel === "EMAIL" ? `Reply to ${recipient}` : channel === "WHATSAPP" ? "Type a WhatsApp reply" : "Write a reply"}. It is saved as a draft and checked before approval.`} />
      <div className="flex flex-wrap items-center gap-2 px-1.5 pb-1.5">
        {view.aiEnabled && <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" disabled={busy !== null} onClick={() => void analyse().then(ok => ok && onAssistant())}>
          {busy === "assistant" ? <Loader2 aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}Draft with Claude</Button>}
        {templates && <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" disabled={busy !== null} onClick={() => setUsingTemplate(true)}><FileText aria-hidden />Template</Button>}
        <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">Ctrl + Enter to save</span>
        <Button type="submit" size="sm" disabled={busy !== null || !draft.trim()}>{busy === "new" ? <Loader2 aria-hidden className="animate-spin" /> : <PenLine aria-hidden />}Save draft</Button>
      </div>
    </form>}
  </div>;
}

function Points({title, points}: {title: string; points: CheckedPoint[]}) {
  if (!points.length) return null;
  return <div><h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
    <ul className="space-y-1.5 text-sm">{points.map((point, index) => <li key={index} className="space-y-0.5">
      <p dir="auto">{point.text} {!point.verified && <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">Unverified</Badge>}{point.downgraded && <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">Inferred</Badge>}</p>
      {point.evidence[0]?.quote && <p dir="auto" className="text-xs text-muted-foreground">“{point.evidence[0].quote}” <span className="opacity-70">({point.evidence[0].ref})</span></p>}
    </li>)}</ul></div>;
}

/** Claude's analysis of the conversation (details panel): advice only, with quotes checked and nothing applied without the member. */
export function AssistantPanel({replies, customer}: {replies: RepliesState; customer: CustomerContextView | null}) {
  const {view, busy, analyse, apply} = replies;
  const [chosen, setChosen] = useState<RequirementField[]>([]);
  if (!view) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>;
  const insight = view.insight?.insight ?? null;
  const lead = customer?.lead ?? null;
  return <div className="space-y-3" data-testid="inbox-assistant">
    {!view.aiEnabled ? <p className="text-sm text-muted-foreground">Claude is off for the inbox. An owner or administrator can turn it on in Inbox settings.</p> : <>
      <p className="text-xs text-muted-foreground">Claude reads the latest messages (phone numbers and emails removed), the linked lead&apos;s requirements and matching listings. Its analysis is advice: quotes are checked, and nothing is sent or saved to the lead without you.</p>
      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void analyse().then(ok => ok && setChosen([]))}>{busy === "assistant" ? <Loader2 aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}{insight ? "Analyse again" : "Analyse with Claude"}</Button>
    </>}
    {insight && view.insight && <div className="space-y-3 border-t pt-3">
      <p className="text-[11px] text-muted-foreground">{view.insight.source === "WORKFLOW" ? "From a workflow" : `Asked by ${view.insight.createdBy ?? "a team member"}`} · {formatLeadDate(view.insight.createdAt, true)}
        {view.insight.unverifiedCount > 0 && ` · ${view.insight.unverifiedCount} point${view.insight.unverifiedCount === 1 ? "" : "s"} not found in the messages`}</p>
      <p dir="auto" className="text-sm">{insight.summary}</p>
      <Points title="Unanswered questions" points={insight.questions} />
      <Points title="Requirements" points={insight.requirements} />
      <Points title="Next steps" points={insight.nextSteps} />
      {insight.listings.length > 0 && <div><h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Matching listings</h4>
        <ul className="space-y-0.5 text-sm">{insight.listings.map(item => <li key={item.listingId}>{item.title} · {item.reference} · {item.location} · {item.price}</li>)}</ul></div>}
      {insight.replyWarnings.length > 0 && <ul className="space-y-0.5 text-xs text-amber-900 dark:text-amber-200">{insight.replyWarnings.map(item => <li key={item}>{item}</li>)}</ul>}
      {view.insight.draftJobId && <p className="text-xs text-muted-foreground">Claude&apos;s reply was saved as a draft in the conversation. Edit and check it before approval.</p>}
      {insight.proposedChanges.length > 0 && <div className="space-y-2 rounded-md border p-2" data-testid="proposed-changes">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Review before saving to the lead</h4>
        {!lead ? <p className="text-xs text-muted-foreground">Link the conversation to a lead you can open to apply these.</p> : <>
          <ul className="space-y-1 text-sm">{insight.proposedChanges.map(change => {
            const before = lead[LEAD_KEY[change.field]];
            return <li key={change.field}><label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={chosen.includes(change.field)}
              onChange={event => setChosen(current => event.target.checked ? [...current, change.field] : current.filter(item => item !== change.field))} />
              <span><span className="font-medium">{change.label}</span>: {before === null || before === undefined || before === "" ? <span className="text-muted-foreground">not recorded</span> : String(before)} → <span className="font-medium">{change.display}</span>
                <span className="block text-xs text-muted-foreground">“{change.quote}” ({change.ref})</span></span></label></li>;
          })}</ul>
          <Button size="sm" variant="outline" disabled={busy !== null || !chosen.length} onClick={() => void apply(chosen).then(ok => ok && setChosen([]))}>{busy === "apply" && <Loader2 aria-hidden className="animate-spin" />}Apply selected to the lead</Button>
        </>}
      </div>}
      {insight.limitations && <p className="text-xs text-muted-foreground">Limitations: {insight.limitations}</p>}
    </div>}
  </div>;
}
