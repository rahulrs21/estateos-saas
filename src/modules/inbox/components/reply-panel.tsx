"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Check, CheckCircle2, ChevronDown, CircleAlert, FileText, Info, Loader2, Maximize2, PenLine, Send, ShieldAlert, Sparkles, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

type SendNowResult = {outcome: "SENT"} | {outcome: "PENDING_APPROVAL"} | {outcome: "NEEDS_CHANGES"; problems: {message: string; blocksApproval: boolean}[]} | {outcome: "FAILED" | "NOT_SENT"; reason: string};
type Act = (key: string, path: string, body: unknown, success: string, method?: "POST" | "PUT" | "DELETE") => Promise<boolean>;

/** Replies (draft, check, approve, send, delete) and the Claude assistant for one conversation, shared by the replies tray, the composer and the details panel. */
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
      const url = method === "POST" ? `${path}/replies/${replyId}/${suffix}` : `${path}/replies/${replyId}`;
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
  async function save(body: {content: string; fromInsightId?: string} | {template: ChosenTemplate}) {
    setBusy("new");
    try {
      await communicationsSend(`${path}/replies`, organizationId, "POST", body);
      toast.success(view?.approvalRequired ? "Draft saved. Check it, then request approval." : "Draft saved. Check it, then send.");
      return true;
    }
    catch (problem) { toast.error(errorMessage(problem, "The draft could not be saved.")); return false; }
    finally { setBusy(null); void load(); }
  }
  /**
   * The message box's Send: the server drafts, checks and, without required approval, approves and sends it in one step
   * (with approval required it goes for approval). Whatever is not sent waits in the replies list with the reason.
   * True when the reply was created (the box can be cleared).
   */
  async function sendNow(body: {content: string; fromInsightId?: string} | {template: ChosenTemplate}) {
    setBusy("send-now");
    try {
      const result = await communicationsSend<SendNowResult>(`${path}/replies/send-now`, organizationId, "POST", body);
      if (result.outcome === "SENT") toast.success(view?.sendMode === "WHATSAPP" ? "Sent on WhatsApp." : view?.sendMode === "EMAIL" ? "Email sent." : "Sent to the simulated conversation.");
      else if (result.outcome === "PENDING_APPROVAL") toast.success("Sent for approval. It goes out when an owner, administrator or manager approves it.");
      else if (result.outcome === "NEEDS_CHANGES") toast.warning(`Not sent: ${result.problems.find(problem => problem.blocksApproval)?.message ?? "the reply needs changes."} It is kept in Replies.`);
      else toast.error(`Not sent: ${result.reason} It is kept in Replies.`);
      onSent();
      return true;
    } catch (problem) { toast.error(errorMessage(problem, "The reply could not be sent.")); return false; }
    finally { setBusy(null); void load(); }
  }
  /** Claude's analysis. For the composer, the suggested reply comes back to be edited in the message box. */
  async function analyse(target: "panel" | "composer" = "panel"): Promise<{insightId: string; draft: string | null} | null> {
    setBusy(target === "composer" ? "compose" : "assistant");
    try {
      const result = await communicationsSend<{insightId: string; draft: string | null}>(`${path}/assistant`, organizationId, "POST", target === "composer" ? {target} : {});
      if (target === "panel") toast.success("Claude's analysis is ready. Check it before using it.");
      return result;
    }
    catch (problem) { toast.error(errorMessage(problem, "Claude could not analyse the conversation.")); return null; }
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
  return {view, error, busy, load, act, receipt, save, sendNow, analyse, apply};
}
export type RepliesState = ReturnType<typeof useReplies>;

function Stepper({stage}: {stage: string}) {
  const at = STEP_OF[stage];
  if (at === undefined) return null;
  return <ol className="flex items-center gap-1 text-[10px] text-muted-foreground" aria-label="Reply progress">{STEPS.map((step, index) => <li key={step} className="flex items-center gap-1">
    <span className={cn("flex size-4 items-center justify-center rounded-full border text-[9px]", index < at ? "border-primary bg-primary text-primary-foreground" : index === at ? "border-primary text-primary" : "border-border")}>
      {index < at ? <Check aria-hidden className="size-2.5" strokeWidth={3} /> : index + 1}</span>
    <span className={cn("hidden lg:inline", index === at && "font-medium text-foreground")}>{step}</span>
    {index < STEPS.length - 1 && <span aria-hidden className={cn("h-px w-2.5 lg:w-4", index < at ? "bg-primary" : "bg-border")} />}
  </li>)}</ol>;
}

/** One reply in full (in its pop-up): the text, the checks, and every step it can take next. */
function ReplyCard({reply, view, busy, act, receipt, onDeleted}: {reply: Reply; view: RepliesView; busy: string | null; act: Act; receipt: RepliesState["receipt"]; onDeleted: () => void}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(reply.content);
  const [note, setNote] = useState("");
  const base = `${reply.id}`;
  const working = busy?.startsWith(base) ?? false;
  const run = (action: string, body: Record<string, unknown>, success: string) => act(`${base}:${action}`, `${action}`, {expectedRevision: reply.revision, ...body}, success);
  const problems = reply.validation?.problems ?? [];
  const blocked = problems.some(problem => problem.blocksApproval);
  const Source = reply.source === "AGENT" ? PenLine : Bot;
  const remove = () => {
    if (window.confirm("Delete this reply? It was never sent, and it cannot be brought back.")) void act(`${base}:delete`, "", {expectedRevision: reply.revision}, "Reply deleted.", "DELETE").then(ok => ok && onDeleted());
  };
  return <div className="space-y-3" data-testid="inbox-reply-detail" data-stage={reply.stage}>
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
      <Badge variant={STAGE_VARIANT[reply.stage] ?? "outline"}>{reply.stageLabel}</Badge>
      <span className="flex items-center gap-1"><Source aria-hidden className="size-3.5" />{reply.template ? "Approved WhatsApp template" : SOURCE_LABEL[reply.source]}{reply.source !== "AGENT" && reply.edited ? ", edited" : ""}</span>
      <span>· {reply.lastEditedBy ?? reply.createdBy ?? "Team member"} · {formatLeadDate(reply.updatedAt, true)}</span>
      {reply.selfApproved && <Badge variant="outline">Self-approved (owner)</Badge>}
    </div>
    <Stepper stage={reply.stage} />
    {editing ? <div className="space-y-2">
      <label htmlFor={`reply-${reply.id}`} className="sr-only">Edit the reply</label>
      <textarea id={`reply-${reply.id}`} value={text} onChange={event => setText(event.target.value)} rows={8} maxLength={4000} className={textareaClassName} dir="auto" />
      <div className="flex gap-2"><Button size="sm" disabled={working || !text.trim()} onClick={() => void act(`${base}:edit`, "", {expectedRevision: reply.revision, content: text}, "Reply updated.", "PUT").then(ok => ok && setEditing(false))}>Save changes</Button>
        <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setText(reply.content); }}>Discard</Button></div>
    </div> : <p dir="auto" className="max-h-[40svh] overflow-y-auto whitespace-pre-wrap wrap-break-word rounded-lg border bg-muted/30 p-3 text-sm leading-6">{reply.content}</p>}
    {problems.length > 0 && <ul className={cn("space-y-1 rounded-md px-3 py-2 text-xs", blocked ? "bg-destructive/10" : "bg-muted/60")} aria-label="Checks">{problems.map(problem =>
      <li key={problem.code} className={cn("flex gap-1.5", problem.blocksApproval ? "text-destructive" : "text-muted-foreground")}>
        {problem.blocksApproval ? <XCircle aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
        <span>{problem.blocksApproval ? "Must fix: " : "Note: "}{problem.message}</span></li>)}</ul>}
    {reply.approvalNote && <p className="text-xs text-muted-foreground">{reply.stage === "DRAFT" ? "Returned by the approver: " : "Approver's note: "}{reply.approvalNote}</p>}
    {reply.approvedBy && ["APPROVED", "QUEUED", "SENT", "FAILED"].includes(reply.stage) && <p className="text-xs text-muted-foreground">Approved by {reply.approvedBy}{reply.approvedAt ? ` · ${formatLeadDate(reply.approvedAt, true)}` : ""}</p>}
    {reply.failureReason && <p className="text-xs text-destructive">Not delivered: {reply.failureReason}</p>}
    {reply.can.ownReply && <p className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldAlert aria-hidden className="size-3.5" />You wrote or edited this reply, so someone else must approve it.</p>}
    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
      {reply.can.send && <Button size="sm" disabled={working} onClick={() => void run("send", {}, view.sendMode === "WHATSAPP" ? "Accepted by WhatsApp." : view.sendMode === "EMAIL" ? "Email sent." : "Delivered to the simulated conversation.")}>
        {busy === `${base}:send` ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />}{view.sendMode === "WHATSAPP" ? "Send on WhatsApp" : view.sendMode === "EMAIL" ? "Send by email" : "Send (simulator)"}</Button>}
      {reply.can.check && <Button size="sm" disabled={working} onClick={() => void run("check", {}, "Reply checked.")}>Check reply</Button>}
      {reply.can.submit && <Button size="sm" disabled={working} onClick={() => void run("submit", {}, view.approvalRequired ? "Sent for approval." : "Approved (your company does not require approval).")}>
        {view.approvalRequired ? "Request approval" : "Approve"}</Button>}
      {reply.can.decide && <>
        <Button size="sm" disabled={working} onClick={() => void run("decide", {decision: "APPROVE", note: note || undefined}, "Reply approved.")}><CheckCircle2 aria-hidden />Approve</Button>
        <label htmlFor={`reply-note-${reply.id}`} className="sr-only">Reason to return the reply</label>
        <Input id={`reply-note-${reply.id}`} value={note} onChange={event => setNote(event.target.value)} maxLength={300} placeholder="Reason (needed to return it)" className="h-7 w-52 text-xs" />
        <Button size="sm" variant="outline" disabled={working || note.trim().length < 3} onClick={() => void run("decide", {decision: "REJECT", note}, "Returned to the author.")}><XCircle aria-hidden />Return</Button>
      </>}
      {reply.can.edit && !editing && <Button size="sm" variant="outline" disabled={working} onClick={() => setEditing(true)}><PenLine aria-hidden />Edit</Button>}
      {view.simulatorSend && reply.stage === "SENT" && reply.messageId && (["DELIVERED", "READ", "FAILED"] as const).map(status =>
        <Button key={status} size="sm" variant="ghost" disabled={working} data-testid={`simulate-${status.toLowerCase()}`} onClick={() => void receipt(reply.messageId!, status)}>Simulate {status.toLowerCase()}</Button>)}
      {reply.can.remove && <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground hover:text-destructive" disabled={working} onClick={remove}><Trash2 aria-hidden />Delete</Button>}
    </div>
  </div>;
}

/** One reply as a single row: its stage, its first line, and the next step as a button. The rest opens in a pop-up. */
function ReplyRow({reply, view, busy, act, onOpen}: {reply: Reply; view: RepliesView; busy: string | null; act: Act; onOpen: () => void}) {
  const base = `${reply.id}`;
  const working = busy?.startsWith(base) ?? false;
  const run = (action: string, success: string) => act(`${base}:${action}`, action, {expectedRevision: reply.revision}, success);
  const blocked = (reply.validation?.problems ?? []).some(problem => problem.blocksApproval);
  const remove = () => {
    if (window.confirm("Delete this reply? It was never sent, and it cannot be brought back.")) void act(`${base}:delete`, "", {expectedRevision: reply.revision}, "Reply deleted.", "DELETE");
  };
  return <li className={cn("flex min-w-0 items-center gap-2 rounded-lg border bg-card px-2 py-1.5", reply.stage === "DRAFT" && "border-dashed", reply.stage === "FAILED" && "border-destructive/50",
    reply.stage === "APPROVED" && "border-primary/50")} data-testid="inbox-reply" data-stage={reply.stage}>
    <Badge variant={STAGE_VARIANT[reply.stage] ?? "outline"} className="h-5 shrink-0 text-[10px]">{reply.stageLabel}</Badge>
    <button type="button" onClick={onOpen} className="min-w-0 flex-1 truncate text-left text-[13px] hover:underline" title="Open the reply" dir="auto">{reply.content}</button>
    {blocked && <XCircle aria-label="Needs changes before approval" className="size-4 shrink-0 text-destructive" />}
    {reply.failureReason && <CircleAlert aria-label={`Not delivered: ${reply.failureReason}`} className="size-4 shrink-0 text-destructive" />}
    <div className="flex shrink-0 items-center gap-1">
      {reply.can.send && <Button size="xs" disabled={working} onClick={() => void run("send", view.sendMode === "WHATSAPP" ? "Accepted by WhatsApp." : view.sendMode === "EMAIL" ? "Email sent." : "Delivered to the simulated conversation.")}>
        {busy === `${base}:send` ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />}{view.sendMode === "WHATSAPP" ? "Send on WhatsApp" : view.sendMode === "EMAIL" ? "Send by email" : "Send (simulator)"}</Button>}
      {reply.can.check && <Button size="xs" disabled={working} onClick={() => void run("check", "Reply checked.")}>{busy === `${base}:check` && <Loader2 aria-hidden className="animate-spin" />}Check reply</Button>}
      {reply.can.submit && <Button size="xs" disabled={working} onClick={() => void run("submit", view.approvalRequired ? "Sent for approval." : "Approved (your company does not require approval).")}>{view.approvalRequired ? "Request approval" : "Approve"}</Button>}
      {reply.can.decide && <Button size="xs" disabled={working} onClick={() => void act(`${base}:decide`, "decide", {expectedRevision: reply.revision, decision: "APPROVE"}, "Reply approved.")}><CheckCircle2 aria-hidden />Approve</Button>}
      <Button size="icon-xs" variant="ghost" onClick={onOpen} aria-label="Open the reply" title="Open (edit, return with a reason, details)"><Maximize2 aria-hidden /></Button>
      {reply.can.remove && <Button size="icon-xs" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={working} onClick={remove} aria-label="Delete reply" title="Delete this reply">
        {busy === `${base}:delete` ? <Loader2 aria-hidden className="animate-spin" /> : <Trash2 aria-hidden />}</Button>}
    </div>
  </li>;
}

/**
 * The replies strip, docked above the composer and kept small, so the conversation stays readable:
 * one row per reply in progress, sent and cancelled ones folded into a history line, and each reply
 * in full in a pop-up.
 */
export function ReplyTray({replies}: {replies: RepliesState}) {
  const {view, busy, act, receipt, error} = replies;
  const [openId, setOpenId] = useState<string | null>(null);
  if (error) return <p role="alert" className="shrink-0 border-t px-4 py-2 text-sm text-destructive">{error}</p>;
  if (!view || !view.replies.length) return null;
  const active = view.replies.filter(reply => !FINISHED.includes(reply.stage));
  const finished = view.replies.filter(reply => FINISHED.includes(reply.stage));
  const opened = view.replies.find(reply => reply.id === openId) ?? null;
  const row = (reply: Reply) => <ReplyRow key={`${reply.id}:${reply.revision}`} reply={reply} view={view} busy={busy} act={act} onOpen={() => setOpenId(reply.id)} />;
  return <section aria-label="Replies" className="shrink-0 space-y-1.5 border-t bg-muted/25 px-3 py-2 sm:px-4">
    {active.length > 0 && <>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Replies in progress ({active.length})</p>
      <ul className="max-h-28 space-y-1 overflow-y-auto">{active.map(row)}</ul>
    </>}
    {finished.length > 0 && <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">
        <ChevronDown aria-hidden className="size-3.5 -rotate-90 transition-transform group-open:rotate-0" />History · {finished.length} sent or cancelled</summary>
      <ul className="mt-1.5 max-h-28 space-y-1 overflow-y-auto">{finished.map(row)}</ul>
    </details>}
    <Dialog open={opened !== null} onOpenChange={value => { if (!value) setOpenId(null); }}>
      <DialogContent className="max-h-[90svh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Reply</DialogTitle>
          <DialogDescription>{view.approvalRequired ? "Check it, have it approved, then send it." : "Check it, then send it."} Nothing is sent until someone clicks Send.</DialogDescription></DialogHeader>
        {opened && <ReplyCard key={`${opened.id}:${opened.revision}`} reply={opened} view={view} busy={busy} act={act} receipt={receipt} onDeleted={() => setOpenId(null)} />}
      </DialogContent>
    </Dialog>
  </section>;
}

/**
 * The message box, docked under the thread like a chat or mail composer. Send goes straight to the customer when the
 * company does not require approval (otherwise it goes for approval); every server check still runs. Outside WhatsApp's
 * 24-hour window an approved template is chosen in a pop-up and waits in the box, ready to send.
 */
export function Composer({replies, conversationId, channel, recipient, notice, templates}: {replies: RepliesState; conversationId: string; channel: InboxChannel; recipient: string;
  /** Why this channel cannot send at all, when it cannot. */ notice: string | null;
  /** Phase 7B.2: approved WhatsApp templates (a real WhatsApp conversation), with quick fills for their blanks. */ templates: {source: string; quickFills: QuickFill[]} | null}) {
  const {view, busy, save, sendNow, analyse} = replies;
  const [draft, setDraft] = useState("");
  /** The analysis the text in the box came from (Draft with Claude), so it is saved as Claude's draft. */
  const [fromInsight, setFromInsight] = useState<string | null>(null);
  /** An approved template waiting in the box, with the exact text the customer will receive. */
  const [template, setTemplate] = useState<{choice: ChosenTemplate; text: string} | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  if (!view) return <div role="status" className="border-t px-4 py-4 text-sm text-muted-foreground">Loading replies…</div>;
  /** Send goes to the customer now; with approval required it goes for approval; with no way to send, only drafts. */
  const mode = view.approvalRequired ? "APPROVAL" : view.sendMode ? "DIRECT" : "DRAFT";
  const chat = channel !== "EMAIL";
  const working = busy !== null;
  const hasContent = template !== null || draft.trim().length > 0;
  const body = () => template ? {template: template.choice} : {content: draft, ...(fromInsight ? {fromInsightId: fromInsight} : {})};
  const clear = () => { setDraft(""); setFromInsight(null); setTemplate(null); };
  async function primary() {
    if (!hasContent || working) return;
    if (await (mode === "DRAFT" ? save(body()) : sendNow(body()))) clear();
  }
  async function saveDraft() {
    if (hasContent && !working && await save(body())) clear();
  }
  async function draftWithClaude() {
    if (draft.trim() && !window.confirm("Replace the text in the message box with Claude's draft?")) return;
    const result = await analyse("composer");
    if (!result) return;
    if (result.draft) { setTemplate(null); setDraft(result.draft); setFromInsight(result.insightId); toast.success("Claude's draft is in the message box. Read and edit it before sending."); }
    else toast.info("Claude had no reply to suggest for this conversation. Its analysis is in the details panel.");
  }
  const sendingNote = `${view.sendingNote} ${view.approvalRequired ? "Replies need an owner, administrator or manager to approve them." : ""}`;
  const primaryLabel = mode === "DIRECT" ? (view.sendMode === "WHATSAPP" ? "Send" : view.sendMode === "EMAIL" ? "Send email" : "Send") : mode === "APPROVAL" ? "Send for approval" : "Save draft";
  const keyHint = chat ? "Enter to send · Shift + Enter for a new line" : "Ctrl + Enter to send";
  return <div className="shrink-0 border-t bg-card/95 px-2.5 py-2 sm:px-3">
    <div title={`${notice ? `${notice} ` : ""}${sendingNote}`} className={cn("mb-1.5 flex items-start gap-1.5 text-[11px] leading-4", view.sendMode ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300")}>
      {view.sendMode ? <Send aria-hidden className="mt-px size-3 shrink-0" /> : <Info aria-hidden className="mt-px size-3 shrink-0" />}
      <p className="line-clamp-1">{notice && <span className="text-muted-foreground" data-testid="sending-disabled">{notice} </span>}
        <span data-testid="reply-sending-note">{sendingNote}</span></p></div>
    <form className="rounded-xl border bg-background shadow-xs transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30"
      onSubmit={event => { event.preventDefault(); void primary(); }}>
      {template ? <div className="px-3 pt-2.5" data-testid="composer-template">
        <div className="mb-1.5 flex items-center gap-2 text-xs">
          <FileText aria-hidden className="size-3.5 text-muted-foreground" />
          <span className="min-w-0 truncate font-medium">Template · {template.choice.name} <span className="font-normal text-muted-foreground">({template.choice.language})</span></span>
          <Button type="button" size="xs" variant="ghost" className="ml-auto" disabled={working} onClick={() => setTemplateOpen(true)}>Change</Button>
          <Button type="button" size="icon-xs" variant="ghost" aria-label="Remove the template" title="Remove the template" disabled={working} onClick={() => setTemplate(null)}><XCircle aria-hidden /></Button>
        </div>
        <p dir="auto" className="max-h-36 overflow-y-auto whitespace-pre-wrap wrap-break-word rounded-lg bg-muted/50 px-3 py-2 text-sm leading-6">{template.text}</p>
      </div>
      : view.templateOnly ? <div className="flex flex-wrap items-center gap-3 px-3 py-3" data-testid="template-composer">
        <p className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">The customer has not written in the last 24 hours, so WhatsApp allows only an approved template. Meta may charge for template messages.</p>
        {templates ? <Button type="button" size="sm" variant="outline" disabled={working} onClick={() => setTemplateOpen(true)}><FileText aria-hidden />Choose a template</Button>
          : <span className="text-xs text-muted-foreground">Templates are only for real WhatsApp conversations.</span>}
      </div>
      : <>
        <label htmlFor={`draft-${conversationId}`} className="sr-only">Write a reply</label>
        <textarea id={`draft-${conversationId}`} value={draft} onChange={event => { setDraft(event.target.value); if (!event.target.value.trim()) setFromInsight(null); }}
          rows={draft ? Math.min(8, Math.max(2, draft.split("\n").length + 1)) : 2} maxLength={4000} dir="auto" disabled={busy === "compose" || busy === "send-now"}
          onKeyDown={event => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            if (chat ? !event.shiftKey : event.ctrlKey || event.metaKey) { event.preventDefault(); void primary(); }
          }}
          className="block max-h-56 min-h-12 w-full resize-y rounded-t-xl bg-transparent px-3 pt-2 text-sm leading-6 outline-none placeholder:text-muted-foreground disabled:opacity-60"
          placeholder={busy === "compose" ? "Claude is drafting a reply…" : channel === "EMAIL" ? `Reply to ${recipient}` : channel === "WHATSAPP" ? "Type a message" : "Write a reply"} />
      </>}
      <div className="flex items-center gap-1 px-1.5 pb-1.5 pt-1">
        {view.aiEnabled && !view.templateOnly && <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" disabled={working} onClick={() => void draftWithClaude()}>
          {busy === "compose" ? <Loader2 aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}Draft with Claude</Button>}
        {templates && !view.templateOnly && <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" disabled={working} onClick={() => setTemplateOpen(true)}><FileText aria-hidden />Template</Button>}
        {fromInsight && !template && <span className="hidden truncate text-[11px] text-muted-foreground xl:inline">Claude&apos;s draft: check it before sending</span>}
        <span className="ml-auto hidden truncate text-[11px] text-muted-foreground 2xl:inline">{template || view.templateOnly ? "" : keyHint}</span>
        {mode !== "DRAFT" && <Button type="button" size="sm" variant="ghost" className="ml-auto text-muted-foreground 2xl:ml-0" disabled={working || !hasContent} title="Save it in Replies without sending" onClick={() => void saveDraft()}>
          {busy === "new" ? <Loader2 aria-hidden className="animate-spin" /> : <PenLine aria-hidden />}<span className="sr-only xl:not-sr-only">Save draft</span></Button>}
        <Button type="submit" size="sm" className={cn("shrink-0", mode === "DRAFT" && "ml-auto 2xl:ml-0")} disabled={working || !hasContent} data-testid="composer-send">
          {busy === "send-now" || (mode === "DRAFT" && busy === "new") ? <Loader2 aria-hidden className="animate-spin" /> : mode === "DRAFT" ? <PenLine aria-hidden /> : <Send aria-hidden />}{primaryLabel}</Button>
      </div>
    </form>
    {templates && <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
      <DialogContent className="max-h-[92svh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader><DialogTitle>Choose a WhatsApp template</DialogTitle>
          <DialogDescription>Approved templates from your WhatsApp account. Fill in the blanks and check the preview; it goes into the message box, ready to send. Meta may charge for template messages.</DialogDescription></DialogHeader>
        <TemplatePicker source={templates.source} quickFills={templates.quickFills} submitLabel="Use this template" busy={false}
          onCancel={() => setTemplateOpen(false)} onSubmit={(choice, text) => { setTemplate({choice, text}); setDraft(""); setFromInsight(null); setTemplateOpen(false); }} />
      </DialogContent>
    </Dialog>}
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
      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void analyse("panel").then(ok => ok && setChosen([]))}>{busy === "assistant" ? <Loader2 aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}{insight ? "Analyse again" : "Analyse with Claude"}</Button>
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
      {view.insight.draftJobId && <p className="text-xs text-muted-foreground">Claude&apos;s reply is a draft among the replies. Edit and check it before it is sent.</p>}
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
