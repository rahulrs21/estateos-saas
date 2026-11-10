"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Send, ShieldAlert, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { communicationsGet, communicationsSend, errorMessage } from "@/modules/communications/client";
import { formatLeadDate, textareaClassName } from "@/modules/leads/components/lead-ui";
import type { CheckedPoint, RequirementField } from "../assistant";
import type { CustomerContextView } from "../server/conversations";
import type { RepliesView } from "../server/outbound";

type Reply = RepliesView["replies"][number];
const STAGE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "outline", VALIDATED: "secondary", PENDING_APPROVAL: "secondary", APPROVED: "default", QUEUED: "secondary", SENT: "default", FAILED: "destructive", CANCELLED: "outline",
};
const SOURCE_LABEL = {AGENT: "Written by a person", CLAUDE: "Drafted by Claude", WORKFLOW: "Drafted by a workflow (Claude)"} as const;
const LEAD_KEY: Record<RequirementField, keyof NonNullable<CustomerContextView["lead"]>> = {
  PROPERTY_TYPE: "propertyType", LOCATION: "preferredLocation", BEDROOMS: "bedroomPreference", BUDGET_MIN: "budgetMin", BUDGET_MAX: "budgetMax", TRANSACTION: "transactionType",
};

function Points({title, points}: {title: string; points: CheckedPoint[]}) {
  if (!points.length) return null;
  return <div><h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
    <ul className="space-y-1.5 text-sm">{points.map((point, index) => <li key={index} className="space-y-0.5">
      <p dir="auto">{point.text} {!point.verified && <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">Unverified</Badge>}{point.downgraded && <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">Inferred</Badge>}</p>
      {point.evidence[0]?.quote && <p dir="auto" className="text-xs text-muted-foreground">“{point.evidence[0].quote}” <span className="opacity-70">({point.evidence[0].ref})</span></p>}
    </li>)}</ul></div>;
}

function ReplyCard({reply, view, busy, act, receipt}: {reply: Reply; view: RepliesView; busy: string | null; act: (key: string, path: string, body: unknown, success: string, method?: "POST" | "PUT") => Promise<boolean>;
  receipt: (messageId: string, status: "DELIVERED" | "READ" | "FAILED") => Promise<void>}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(reply.content);
  const [note, setNote] = useState("");
  const base = `${reply.id}`;
  const working = busy?.startsWith(base) ?? false;
  const run = (action: string, body: Record<string, unknown>, success: string) => act(`${base}:${action}`, `${action}`, {expectedRevision: reply.revision, ...body}, success);
  const problems = reply.validation?.problems ?? [];
  return <li className="space-y-2 rounded-lg border p-3" data-testid="inbox-reply" data-stage={reply.stage}>
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <Badge variant={STAGE_VARIANT[reply.stage] ?? "outline"}>{reply.stageLabel}</Badge>
      <span>{reply.template ? "Approved WhatsApp template" : SOURCE_LABEL[reply.source]}{reply.source !== "AGENT" && reply.edited ? ", edited" : ""}</span>
      <span>· {reply.lastEditedBy ?? reply.createdBy ?? "Team member"} · {formatLeadDate(reply.updatedAt, true)}</span>
      {reply.selfApproved && <Badge variant="outline">Self-approved (owner)</Badge>}
    </div>
    {editing ? <div className="space-y-2">
      <label htmlFor={`reply-${reply.id}`} className="sr-only">Edit the reply</label>
      <textarea id={`reply-${reply.id}`} value={text} onChange={event => setText(event.target.value)} rows={4} maxLength={4000} className={textareaClassName} dir="auto" />
      <div className="flex gap-2"><Button size="sm" disabled={working || !text.trim()} onClick={() => void act(`${base}:edit`, "", {expectedRevision: reply.revision, content: text}, "Reply updated.", "PUT").then(ok => ok && setEditing(false))}>Save changes</Button>
        <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setText(reply.content); }}>Discard</Button></div>
    </div> : <p dir="auto" className="whitespace-pre-wrap break-words text-sm">{reply.content}</p>}
    {problems.length > 0 && <ul className="space-y-0.5 text-xs" aria-label="Checks">{problems.map(problem => <li key={problem.code} className={problem.blocksApproval ? "text-destructive" : "text-muted-foreground"}>
      {problem.blocksApproval ? "Must fix: " : "Note: "}{problem.message}</li>)}</ul>}
    {reply.approvalNote && <p className="text-xs text-muted-foreground">{reply.stage === "DRAFT" ? "Returned by the approver: " : "Approver's note: "}{reply.approvalNote}</p>}
    {reply.approvedBy && ["APPROVED", "QUEUED", "SENT", "FAILED"].includes(reply.stage) && <p className="text-xs text-muted-foreground">Approved by {reply.approvedBy}{reply.approvedAt ? ` · ${formatLeadDate(reply.approvedAt, true)}` : ""}</p>}
    {reply.failureReason && <p className="text-xs text-destructive">Not delivered: {reply.failureReason}</p>}
    {reply.can.ownReply && <p className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldAlert aria-hidden className="size-3.5" />You wrote or edited this reply, so someone else must approve it.</p>}
    <div className="flex flex-wrap gap-2">
      {reply.can.edit && !editing && <Button size="sm" variant="outline" disabled={working} onClick={() => setEditing(true)}>Edit</Button>}
      {reply.can.check && <Button size="sm" variant="outline" disabled={working} onClick={() => void run("check", {}, "Reply checked.")}>{busy === `${base}:check` && <Loader2 aria-hidden className="animate-spin" />}Check reply</Button>}
      {reply.can.submit && <Button size="sm" disabled={working} onClick={() => void run("submit", {}, view.approvalRequired ? "Sent for approval." : "Approved (your company does not require approval).")}>
        {view.approvalRequired ? "Request approval" : "Approve"}</Button>}
      {reply.can.decide && <>
        <Button size="sm" disabled={working} onClick={() => void run("decide", {decision: "APPROVE", note: note || undefined}, "Reply approved.")}><CheckCircle2 aria-hidden />Approve</Button>
        <label htmlFor={`note-${reply.id}`} className="sr-only">Reason to return the reply</label>
        <Input id={`note-${reply.id}`} value={note} onChange={event => setNote(event.target.value)} maxLength={300} placeholder="Reason (needed to return it)" className="h-8 w-56" />
        <Button size="sm" variant="outline" disabled={working || note.trim().length < 3} onClick={() => void run("decide", {decision: "REJECT", note}, "Returned to the author.")}><XCircle aria-hidden />Return</Button>
      </>}
      {reply.can.send && <Button size="sm" disabled={working} onClick={() => void run("send", {}, view.sendMode === "WHATSAPP" ? "Accepted by WhatsApp." : view.sendMode === "EMAIL" ? "Sent by Gmail." : "Delivered to the simulated conversation.")}><Send aria-hidden />{view.sendMode === "WHATSAPP" ? "Send on WhatsApp" : view.sendMode === "EMAIL" ? "Send by email" : "Send (simulator)"}</Button>}
      {reply.can.cancel && <Button size="sm" variant="ghost" disabled={working} onClick={() => void run("cancel", {}, "Reply cancelled.")}>Cancel reply</Button>}
      {view.simulatorSend && reply.stage === "SENT" && reply.messageId && (["DELIVERED", "READ", "FAILED"] as const).map(status =>
        <Button key={status} size="sm" variant="ghost" disabled={working} data-testid={`simulate-${status.toLowerCase()}`} onClick={() => void receipt(reply.messageId!, status)}>Simulate {status.toLowerCase()}</Button>)}
    </div>
  </li>;
}

/** Replies (draft, check, approve, send) and the Claude assistant for one conversation. */
export function ReplyPanel({conversationId, organizationId, customer, onSent}: {conversationId: string; organizationId: string; customer: CustomerContextView | null; onSent: () => void}) {
  const [view, setView] = useState<RepliesView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [template, setTemplate] = useState({name: "hello_world", language: "en_US"});
  const [chosen, setChosen] = useState<RequirementField[]>([]);
  const path = `/api/inbox/conversations/${conversationId}`;
  const load = useCallback(() => communicationsGet<RepliesView>(`${path}/replies`, "Replies could not be loaded.").then(data => { setView(data); setError(null); }, problem => setError(errorMessage(problem, "Replies could not be loaded."))), [path]);
  useEffect(() => { void load(); }, [load]);

  async function act(key: string, suffix: string, body: unknown, success: string, method: "POST" | "PUT" = "POST") {
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
  }
  /** Developer simulator only: a delivery receipt through the normal event pipeline. */
  async function receipt(messageId: string, status: "DELIVERED" | "READ" | "FAILED") {
    try { await communicationsSend("/api/dev/communication-tests/inbox/receipt", organizationId, "POST", {messageId, status}); toast.success(`Simulated receipt: ${status.toLowerCase()}.`); onSent(); }
    catch (problem) { toast.error(errorMessage(problem, "The receipt could not be simulated.")); }
  }
  async function save(useTemplate = false) {
    setBusy("new");
    try {
      await communicationsSend(`${path}/replies`, organizationId, "POST", useTemplate ? {template} : {content: draft});
      if (!useTemplate) setDraft("");
      toast.success("Draft saved. Check it, then request approval.");
    }
    catch (problem) { toast.error(errorMessage(problem, "The draft could not be saved.")); }
    finally { setBusy(null); void load(); }
  }
  async function analyse() {
    setBusy("assistant");
    try { await communicationsSend(`${path}/assistant`, organizationId, "POST", {}); setChosen([]); toast.success("Claude's analysis is ready. Check it before using it."); }
    catch (problem) { toast.error(errorMessage(problem, "Claude could not analyse the conversation.")); }
    finally { setBusy(null); void load(); }
  }
  async function apply() {
    if (!view?.insight) return;
    setBusy("apply");
    try {
      const result = await communicationsSend<{applied: unknown[]}>(`${path}/assistant/apply`, organizationId, "POST", {insightId: view.insight.id, fields: chosen});
      toast.success(result.applied.length ? `Lead updated (${result.applied.length} field${result.applied.length === 1 ? "" : "s"}).` : "The lead already had these values.");
      setChosen([]); onSent();
    } catch (problem) { toast.error(errorMessage(problem, "The lead could not be updated.")); }
    finally { setBusy(null); }
  }

  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!view) return <p role="status" className="text-sm text-muted-foreground">Loading replies…</p>;
  const insight = view.insight?.insight ?? null;
  const lead = customer?.lead ?? null;
  return <div className="space-y-4">
    <Card className="gap-3 py-4 shadow-xs ring-border"><CardHeader className="px-4"><CardTitle role="heading" aria-level={3} className="text-sm">Reply</CardTitle></CardHeader>
      <CardContent className="space-y-3 px-4">
        <p className="text-xs text-muted-foreground" data-testid="reply-sending-note">{view.sendingNote} {view.approvalRequired ? "Replies need an owner, administrator or manager to approve them." : ""}</p>
        {view.templateOnly ? <form className="space-y-2 rounded-md border p-3" data-testid="template-composer" onSubmit={event => { event.preventDefault(); void save(true); }}>
          <p className="text-xs text-muted-foreground">The customer has not written in the last 24 hours, so WhatsApp allows only an approved template. Its text is the one approved in Meta&apos;s WhatsApp Manager. Meta may charge for template messages; check your WhatsApp billing first.</p>
          <div className="flex flex-wrap gap-2">
            <label className="space-y-1 text-xs font-medium">Template name<Input value={template.name} onChange={event => setTemplate(current => ({...current, name: event.target.value.trim()}))} maxLength={100} className="h-8 w-48" /></label>
            <label className="space-y-1 text-xs font-medium">Language<Input value={template.language} onChange={event => setTemplate(current => ({...current, language: event.target.value.trim()}))} maxLength={6} className="h-8 w-24" /></label>
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={busy !== null || !template.name || !template.language}>{busy === "new" && <Loader2 aria-hidden className="animate-spin" />}Save template reply</Button>
        </form>
        : <form className="space-y-2" onSubmit={event => { event.preventDefault(); if (draft.trim()) void save(); }}>
          <label htmlFor={`draft-${conversationId}`} className="sr-only">Write a reply</label>
          <textarea id={`draft-${conversationId}`} value={draft} onChange={event => setDraft(event.target.value)} rows={3} maxLength={4000} dir="auto" className={textareaClassName} placeholder="Write a reply. It is saved as a draft and checked before approval." />
          <Button type="submit" size="sm" variant="outline" disabled={busy !== null || !draft.trim()}>{busy === "new" && <Loader2 aria-hidden className="animate-spin" />}Save draft</Button>
        </form>}
        {view.replies.length ? <ul className="space-y-2" aria-label="Replies">{view.replies.map(reply => <ReplyCard key={`${reply.id}:${reply.revision}`} reply={reply} view={view} busy={busy} act={act} receipt={receipt} />)}</ul>
          : <p className="text-sm text-muted-foreground">No replies yet.</p>}
      </CardContent></Card>

    <Card className="gap-3 py-4 shadow-xs ring-border"><CardHeader className="px-4"><CardTitle role="heading" aria-level={3} className="flex items-center gap-1.5 text-sm"><Sparkles aria-hidden className="size-4" />Claude assistant</CardTitle></CardHeader>
      <CardContent className="space-y-3 px-4" data-testid="inbox-assistant">
        {!view.aiEnabled ? <p className="text-sm text-muted-foreground">Claude is off for the inbox. An owner or administrator can turn it on in Inbox settings.</p> : <>
          <p className="text-xs text-muted-foreground">Claude reads the latest messages (phone numbers and emails removed), the linked lead&apos;s requirements and matching listings. Its analysis is advice: quotes are checked, and nothing is sent or saved to the lead without you.</p>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void analyse()}>{busy === "assistant" ? <Loader2 aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}{insight ? "Analyse again" : "Analyse with Claude"}</Button>
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
          {view.insight.draftJobId && <p className="text-xs text-muted-foreground">Claude&apos;s reply was saved as a draft above. Edit and check it before approval.</p>}
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
              <Button size="sm" variant="outline" disabled={busy !== null || !chosen.length} onClick={() => void apply()}>{busy === "apply" && <Loader2 aria-hidden className="animate-spin" />}Apply selected to the lead</Button>
            </>}
          </div>}
          {insight.limitations && <p className="text-xs text-muted-foreground">Limitations: {insight.limitations}</p>}
        </div>}
      </CardContent></Card>
  </div>;
}
