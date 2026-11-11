"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Check, CheckCheck, CircleAlert, Clock3, Link2, Loader2, PanelRight, Paperclip, ShieldCheck, Sparkles, StickyNote, UserPlus, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { communicationsGet, communicationsSend, errorMessage } from "@/modules/communications/client";
import { CALL_OUTCOME_LABELS, CALL_STATUS_LABELS, type CallOutcome, type CallStatus } from "@/modules/communications/model";
import { formatLeadDate, textareaClassName } from "@/modules/leads/components/lead-ui";
import { CHANNEL_LABELS, DELIVERY_LABELS, PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, type ConversationStatus, type DeliveryStatus, type InboxChannel, type Priority } from "../model";
import type { ConversationView, CustomerContextView, MessageListView } from "../server/conversations";
import { AssistantPanel, Composer, ReplyList, useReplies } from "./reply-panel";
import { EmailMessage } from "./email-message";
import { CHANNEL_TEXT_TONES, ContactAvatar, clockTime, dayLabel, messageDay } from "./inbox-ui";

type Message = MessageListView["messages"][number];
type Assignee = {id: string; name: string; role: string};

const TOOLBAR_SELECT = "h-8 min-w-0 max-w-44 rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60";

function DeliveryMark({status, inverted}: {status: string; inverted: boolean}) {
  const label = DELIVERY_LABELS[status as DeliveryStatus] ?? status;
  const tone = inverted ? "text-primary-foreground/75" : "text-muted-foreground";
  const mark = status === "READ" ? <CheckCheck aria-hidden className={cn("size-3.5", inverted ? "text-sky-200" : "text-sky-500")} />
    : status === "DELIVERED" ? <CheckCheck aria-hidden className={cn("size-3.5", tone)} />
    : status === "SENT" ? <Check aria-hidden className={cn("size-3.5", tone)} />
    : status === "FAILED" ? <CircleAlert aria-hidden className="size-3.5 text-red-300" />
    : status === "QUEUED" || status === "DRAFT" ? <Clock3 aria-hidden className={cn("size-3", tone)} /> : null;
  return <span className="inline-flex items-center gap-0.5" title={label}>{mark}<span className={mark ? "sr-only" : undefined}>{label}</span></span>;
}

/** A chat message (WhatsApp, website, simulator) as a bubble. Text only: messages are never rendered as HTML, so markup or scripts in them are inert. */
function MessageBubble({message, conversationId}: {message: Message; conversationId: string}) {
  const inbound = message.direction === "INBOUND";
  return <li className={cn("flex", inbound ? "justify-start" : "justify-end")} data-direction={message.direction}>
    <div className={cn("relative max-w-[min(85%,36rem)] space-y-1 px-3 py-2 text-sm shadow-xs",
      inbound ? "rounded-2xl rounded-tl-sm border bg-card text-card-foreground" : "rounded-2xl rounded-tr-sm bg-primary text-primary-foreground")}>
      {!inbound && message.author?.displayName && <p className="text-[11px] font-medium opacity-80">{message.author.displayName}</p>}
      {message.contentRedactedAt ? <p className="italic opacity-80">Removed under the company&apos;s retention period.</p>
        : <p dir="auto" className="whitespace-pre-wrap wrap-break-word leading-relaxed">{message.content ?? `[${message.messageType.toLowerCase()} message]`}</p>}
      {message.attachments.length > 0 && <ul className={cn("space-y-1 text-xs", inbound ? "text-foreground" : "opacity-95")} aria-label="Attachments">{message.attachments.map(item =>
        <li key={item.id} className={cn("flex flex-wrap items-center gap-1 rounded-lg px-2 py-1.5", inbound ? "bg-muted" : "bg-black/10")} data-testid="inbox-attachment">
          <Paperclip aria-hidden className="size-3" />
          {/* Downloaded through an authorized, audited route; never opened inline. */}
          {item.available ? <a className="font-medium underline underline-offset-2" href={`/api/inbox/conversations/${conversationId}/attachments/${item.id}`} download>{item.fileName}</a> : <span className="font-medium">{item.fileName}</span>}
          {item.sizeBytes > 0 && <span className="opacity-75">({Math.max(1, Math.ceil(item.sizeBytes / 1024))} KB)</span>}
          {item.scanStatus === "BLOCKED" ? <span>· blocked by the file check</span> : !item.available ? <span className="opacity-75">· not downloaded (needs a connected provider)</span> : item.scanStatus === "NOT_SCANNED" && <span className="opacity-75">· not virus-scanned</span>}
        </li>)}</ul>}
      <div className={cn("flex flex-wrap items-center justify-end gap-1.5 text-[10px] tabular-nums", inbound ? "text-muted-foreground" : "text-primary-foreground/75")}>
        {message.simulated && <Badge variant="destructive" className="h-4 px-1 text-[9px]">SIMULATED</Badge>}
        {message.deliveryStatus === "UNKNOWN" && message.providerStatusRaw && <span>({message.providerStatusRaw})</span>}
        <time dateTime={message.providerTimestamp ?? message.createdAt} title={formatLeadDate(message.providerTimestamp ?? message.createdAt, true)}>{clockTime(message.providerTimestamp ?? message.createdAt)}</time>
        {!inbound && <DeliveryMark status={message.deliveryStatus} inverted />}
      </div>
    </div>
  </li>;
}

function DaySeparator({value}: {value: string}) {
  return <li aria-hidden className="flex justify-center py-1"><span className="rounded-full border bg-card px-3 py-0.5 text-[11px] font-medium text-muted-foreground shadow-xs">{dayLabel(value)}</span></li>;
}

function LinkDialog({conversation, organizationId, onDone}: {conversation: ConversationView; organizationId: string; onDone: () => void}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<{leads: Array<{id: string; fullName: string; email?: string | null; phone?: string | null}>; contacts: Array<{id: string; fullName: string; email?: string | null; phone?: string | null}>} | null>(null);
  const [busy, setBusy] = useState(false);
  async function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = encodeURIComponent(term.trim());
    try {
      const [leads, contacts] = await Promise.all([
        communicationsGet<{leads: Array<{id: string; fullName: string; email?: string | null; phone?: string | null}>}>(`/api/leads?search=${search}&limit=10`, "Leads could not be searched."),
        communicationsGet<{contacts: Array<{id: string; fullName: string; email?: string | null; phone?: string | null}>}>(`/api/contacts?search=${search}&limit=10`, "Contacts could not be searched."),
      ]);
      setResults({leads: leads.leads, contacts: contacts.contacts});
    } catch (problem) { toast.error(errorMessage(problem, "The search failed.")); }
  }
  async function link(body: {leadId?: string; contactId?: string}) {
    setBusy(true);
    try {
      const result = await communicationsSend<{identityMatches: boolean}>(`/api/inbox/conversations/${conversation.id}/link`, organizationId, "POST", {expectedRevision: conversation.revision, ...body});
      toast.success(body.leadId || body.contactId ? (result.identityMatches ? "Linked; the sender's number or email matches this customer." : "Linked. The sender's number or email is not on this customer's record; check it is the same person.") : "Unlinked.");
      setOpen(false); onDone();
    } catch (problem) { toast.error(errorMessage(problem, "The conversation could not be linked.")); }
    finally { setBusy(false); }
  }
  const row = (kind: "leadId" | "contactId", item: {id: string; fullName: string; email?: string | null; phone?: string | null}) => <li key={`${kind}${item.id}`} className="flex items-center justify-between gap-2 py-1.5 text-sm">
    <span className="min-w-0"><span className="font-medium">{item.fullName}</span><span className="block truncate text-xs text-muted-foreground">{[item.phone, item.email].filter(Boolean).join(" · ") || "No phone or email"}</span></span>
    <Button size="sm" variant="outline" disabled={busy} onClick={() => void link({[kind]: item.id})}>Link</Button></li>;
  return <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
    <DialogTrigger render={<Button size="sm" variant={conversation.contactId ? "ghost" : "outline"} />}><Link2 aria-hidden /><span className="hidden sm:inline">{conversation.contactId ? "Change link" : "Link to customer"}</span></DialogTrigger>
    <DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Link this conversation</DialogTitle>
      <DialogDescription>Choose the lead or contact this sender is. EstateOS never links by name alone; check the number or email ({conversation.customerIdentity}).</DialogDescription></DialogHeader>
      <form onSubmit={find} className="flex gap-2"><label htmlFor={`${prefix}-q`} className="sr-only">Search leads and contacts</label>
        <Input id={`${prefix}-q`} value={term} onChange={event => setTerm(event.target.value)} placeholder="Name, phone or email" maxLength={120} /><Button type="submit" variant="outline">Search</Button></form>
      {results && <div className="space-y-3">
        <div><h3 className="text-xs font-medium uppercase text-muted-foreground">Leads</h3>{results.leads.length ? <ul className="divide-y">{results.leads.map(item => row("leadId", item))}</ul> : <p className="text-sm text-muted-foreground">No leads you can access.</p>}</div>
        <div><h3 className="text-xs font-medium uppercase text-muted-foreground">Contacts</h3>{results.contacts.length ? <ul className="divide-y">{results.contacts.map(item => row("contactId", item))}</ul> : <p className="text-sm text-muted-foreground">No contacts you can access.</p>}</div>
      </div>}
      {conversation.contactId && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void link({})}>Unlink</Button>}
    </DialogContent>
  </Dialog>;
}

function CustomerPanel({customer, conversation}: {customer: CustomerContextView | null; conversation: ConversationView}) {
  if (!customer) return <div role="status" aria-label="Loading the customer" className="space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-16 w-full" /></div>;
  const {lead, contact} = customer;
  return <div className="space-y-4 text-sm" aria-label="Customer">
    {!conversation.contactId && <p className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-xs text-muted-foreground">Not linked to a customer. Link it to the lead or contact once you have checked who this is.</p>}
    {contact && <div className="flex items-start gap-3"><ContactAvatar name={contact.fullName} size="sm" />
      <div className="min-w-0"><p className="font-medium">{contact.fullName}</p><p className="break-all text-xs text-muted-foreground">{[contact.phone, contact.email].filter(Boolean).join(" · ")}</p>
        <Link href={`/contacts/${contact.id}`} className="text-xs font-medium text-primary hover:underline">Open contact</Link></div></div>}
    {customer.leadHidden && <p className="text-xs text-muted-foreground">The linked lead is not one you can open.</p>}
    {lead && <div className="space-y-3">
      <div className="rounded-lg border bg-muted/30 p-3"><Link href={`/leads/${lead.id}`} className="font-medium text-primary hover:underline">{lead.fullName}</Link>
        <p className="text-xs text-muted-foreground">{lead.status.replaceAll("_", " ").toLowerCase()} · {lead.assignedMembership?.userProfile?.displayName ?? "Unassigned"}{lead.archivedAt ? " · archived" : ""}</p>
        {(lead.propertyInterest || lead.preferredLocation || lead.bedroomPreference) && <p className="mt-1 text-xs">{[lead.propertyType, lead.bedroomPreference, lead.preferredLocation, lead.propertyInterest].filter(Boolean).join(" · ")}</p>}</div>
      <Section title="Open follow-ups" empty="None" items={lead.followUps.map(item => `${item.title} · ${formatLeadDate(item.dueAt, true)}`)} />
      <Section title="Viewings" empty="None" items={lead.viewings.map(item => `${item.property?.propertyReference ?? "Property"} · ${item.status.toLowerCase()} · ${formatLeadDate(item.scheduledAt, true)}`)} />
      <Section title="Property interests" empty="None" items={lead.interests.map(item => `${item.property?.propertyReference ?? "Property"} · ${item.status.toLowerCase()}`)} />
      <Section title="Calls" empty="None" items={lead.calls.map(item => `${item.direction === "INBOUND" ? "Incoming" : "Outgoing"} · ${CALL_STATUS_LABELS[item.callStatus as CallStatus]}${item.outcome ? ` · ${CALL_OUTCOME_LABELS[item.outcome as CallOutcome]}` : ""} · ${formatLeadDate(item.startedAt, true)}${item.source === "SIMULATED" ? " · simulated" : ""}`)} />
      <Section title="Recent activity" empty="None" items={lead.activities.map(item => `${item.kind.replaceAll("_", " ").toLowerCase()} · ${formatLeadDate(item.createdAt, true)}`)} />
    </div>}
    {customer.others.length > 0 && <div><h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Other conversations</h4>
      <ul className="space-y-1">{customer.others.map(item => <li key={item.id}><Link href={`/inbox/${item.id}`} className="text-primary hover:underline">{CHANNEL_LABELS[item.channel as InboxChannel]}</Link>
        <span className="text-xs text-muted-foreground"> · {formatLeadDate(item.lastMessageAt, true)} · {item.lastMessagePreview}</span></li>)}</ul></div>}
  </div>;
}

function Section({title, items, empty}: {title: string; items: string[]; empty: string}) {
  return <div><h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
    {items.length ? <ul className="space-y-0.5 text-xs">{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="text-xs text-muted-foreground">{empty}</p>}</div>;
}

function PanelBlock({icon, title, children}: {icon: ReactNode; title: string; children: ReactNode}) {
  return <section className="space-y-3 border-b px-4 py-4 last:border-b-0">
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{icon}{title}</h3>{children}</section>;
}

/** One conversation: the contact and controls on top, the thread, the composer, and a details panel (customer, Claude, internal notes). */
export function ConversationPane({conversationId, organizationId, refreshKey, onBack, onChanged}: {conversationId: string; organizationId: string; refreshKey: number; onBack: () => void; onChanged: () => void}) {
  const [conversation, setConversation] = useState<ConversationView | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [earlier, setEarlier] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerContextView | null>(null);
  const [assigneeOptions, setAssigneeOptions] = useState<Assignee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  /** The details panel: null follows the screen (open on wide screens), otherwise the member's choice. */
  const [details, setDetails] = useState<boolean | null>(null);
  const [wide, setWide] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  const load = useCallback(() => Promise.all([
    communicationsGet<ConversationView>(`/api/inbox/conversations/${conversationId}`, "The conversation could not be loaded."),
    communicationsGet<MessageListView>(`/api/inbox/conversations/${conversationId}/messages`, "Messages could not be loaded."),
    communicationsGet<CustomerContextView>(`/api/inbox/conversations/${conversationId}/customer`, "The customer could not be loaded."),
  ]).then(([detail, list, context]) => { setConversation(detail); setMessages(list.messages); setEarlier(list.earlierCursor); setCustomer(context); setError(null); return detail; },
    problem => { setError(errorMessage(problem, "The conversation could not be loaded.")); return null; }), [conversationId]);
  const replies = useReplies({conversationId, organizationId, onSent: () => { void load(); onChanged(); }});

  useEffect(() => {
    void load().then(detail => {
      if (detail && detail.unreadCount > 0) void communicationsSend(`/api/inbox/conversations/${conversationId}/read`, organizationId, "POST", {}).then(onChanged, () => undefined);
    });
    // Mark read once per opened conversation; later refreshes only reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);
  useEffect(() => { if (refreshKey) void load(); }, [refreshKey, load]);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 96rem)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => { void communicationsGet<Assignee[]>("/api/inbox/assignees").then(setAssigneeOptions, () => setAssigneeOptions([])); }, []);
  // Open on the newest message, like a chat or mail client (once; refreshes keep the member's place).
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node || !messages?.length || scrolled.current) return;
    scrolled.current = true;
    const items = node.querySelectorAll<HTMLElement>("[data-direction]");
    const last = items[items.length - 1];
    if (conversation?.channel === "EMAIL" && last) node.scrollTop = Math.max(0, last.offsetTop - node.offsetTop - 16);
    else node.scrollTop = node.scrollHeight;
  }, [messages, conversation?.channel]);

  async function act(key: string, path: string, body: unknown, success: string) {
    setBusy(key);
    try { await communicationsSend(path, organizationId, "POST", body); toast.success(success); onChanged(); }
    catch (problem) { toast.error(errorMessage(problem, "The change could not be saved.")); }
    finally { setBusy(null); void load(); }
  }
  async function loadEarlier() {
    if (!earlier) return;
    try {
      const more = await communicationsGet<MessageListView>(`/api/inbox/conversations/${conversationId}/messages?cursor=${encodeURIComponent(earlier)}`, "Earlier messages could not be loaded.");
      setMessages(current => [...more.messages, ...(current ?? [])]);
      setEarlier(more.earlierCursor);
    } catch (problem) { toast.error(errorMessage(problem, "Earlier messages could not be loaded.")); }
  }

  if (error) return <div className="m-4 space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4"><p role="alert" className="text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={onBack}>Back to the inbox</Button></div>;
  if (!conversation || !messages) return <div role="status" aria-label="Loading the conversation" className="flex flex-1 flex-col">
    <div className="flex items-center gap-3 border-b px-4 py-3"><Skeleton className="size-10 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-64" /></div></div>
    <div className="flex-1 space-y-4 p-6"><Skeleton className="h-16 w-2/3" /><Skeleton className="ml-auto h-12 w-1/2" /><Skeleton className="h-24 w-3/4" /></div></div>;

  const name = conversation.contact?.fullName ?? conversation.customerName ?? conversation.customerIdentity;
  const channel = conversation.channel as InboxChannel;
  const email = channel === "EMAIL";
  const state = (status: ConversationStatus, priority: Priority) => act("state", `/api/inbox/conversations/${conversation.id}/state`, {expectedRevision: conversation.revision, status, priority}, "Conversation updated.");
  const detailsOpen = details ?? wide;
  const lastEmail = email ? messages[messages.length - 1]?.id : null;

  return <div className="flex min-h-0 flex-1 flex-col">
    {/* The contact and the conversation's controls */}
    <header className="border-b">
      <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
        <Button size="icon-sm" variant="ghost" className="lg:hidden" aria-label="Back to the conversation list" onClick={onBack}><ArrowLeft aria-hidden /></Button>
        <ContactAvatar name={name} channel={channel} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold leading-tight">{name}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            <span className={cn("font-medium", CHANNEL_TEXT_TONES[channel])}>{CHANNEL_LABELS[channel]}</span><span className="min-w-0 truncate">· {conversation.customerIdentity}</span>
            {email && conversation.channelConnection?.externalAccountReference && <span className="hidden min-w-0 truncate 2xl:inline">· via {conversation.channelConnection.externalAccountReference}</span>}
            {conversation.identityVerified && <Badge variant="secondary" className="h-5 gap-1 text-[10px]"><ShieldCheck aria-hidden className="size-3" />Matches the customer record</Badge>}
            {conversation.simulated && <Badge variant="destructive" className="h-5 text-[10px]">SIMULATED</Badge>}{conversation.optedOut && <Badge variant="destructive" className="h-5 text-[10px]">Opted out</Badge>}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <LinkDialog conversation={conversation} organizationId={organizationId} onDone={() => { void load(); onChanged(); }} />
          <Button size="icon-sm" variant={detailsOpen ? "secondary" : "ghost"} aria-label={detailsOpen ? "Hide customer details" : "Show customer details"} aria-pressed={detailsOpen}
            onClick={() => setDetails(!detailsOpen)}><PanelRight aria-hidden /></Button>
        </div>
      </div>
      <div className="flex items-center gap-x-3 gap-y-2 overflow-x-auto border-t bg-muted/25 px-3 py-2 text-xs sm:flex-wrap sm:px-4 [&>*]:shrink-0">
        <label className="flex items-center gap-1.5 font-medium text-muted-foreground">Status<select className={TOOLBAR_SELECT} value={conversation.status} disabled={busy !== null} aria-label="Status"
          onChange={event => void state(event.target.value as ConversationStatus, conversation.priority as Priority)}>
          <option value={conversation.status}>{STATUS_LABELS[conversation.status as ConversationStatus]}</option>
          {conversation.permissions.statuses.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label>
        <label className="flex items-center gap-1.5 font-medium text-muted-foreground">Priority<select className={TOOLBAR_SELECT} value={conversation.priority} disabled={busy !== null} aria-label="Priority"
          onChange={event => void state(conversation.status as ConversationStatus, event.target.value as Priority)}>
          {PRIORITIES.map(priority => <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>)}</select></label>
        {conversation.permissions.assignOthers ? <label className="flex items-center gap-1.5 font-medium text-muted-foreground">Assigned to<select className={TOOLBAR_SELECT} value={conversation.assignedMembershipId ?? ""} disabled={busy !== null} aria-label="Assigned to"
          onChange={event => void act("assign", `/api/inbox/conversations/${conversation.id}/assign`, {expectedRevision: conversation.revision, toMembershipId: event.target.value || null}, event.target.value ? "Conversation assigned." : "Conversation unassigned.")}>
          <option value="">Unassigned</option>{assigneeOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
          : <span className="flex items-center gap-1.5 text-muted-foreground"><span className="font-medium">Assigned to</span><span className="text-foreground">{conversation.assignedMembership?.userProfile?.displayName ?? "Unassigned"}</span></span>}
        {conversation.permissions.takeForSelf && !conversation.permissions.assignOthers && <Button size="sm" variant="outline" disabled={busy !== null}
          onClick={() => void act("take", `/api/inbox/conversations/${conversation.id}/assign`, {expectedRevision: conversation.revision, toMembershipId: conversation.permissions.me}, "Assigned to you.")}><UserPlus aria-hidden />Assign to me</Button>}
        {busy && <Loader2 aria-label="Saving" className="size-3.5 animate-spin text-muted-foreground" />}
      </div>
    </header>

    <div className="relative flex min-h-0 flex-1">
      {/* The thread and the composer */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={scroller} className={cn("min-h-0 flex-1 overflow-y-auto", email ? "bg-muted/20" : "bg-muted/30 bg-[radial-gradient(circle_at_1px_1px,var(--color-border)_1px,transparent_0)] bg-size-[20px_20px]")}>
          <div className={cn("mx-auto w-full space-y-4 px-3 py-4 sm:px-5", email ? "max-w-4xl" : "max-w-3xl")}>
            {email && conversation.subject && <h3 dir="auto" className="px-1 text-lg font-normal leading-snug sm:text-xl">{conversation.subject}</h3>}
            {earlier && <div className="flex justify-center"><Button size="sm" variant="outline" className="rounded-full bg-card" onClick={() => void loadEarlier()}>Load earlier messages</Button></div>}
            {messages.length ? <ol className={email ? "space-y-3" : "space-y-1.5"} aria-label="Messages">{messages.map((message, index) => {
              const at = message.providerTimestamp ?? message.createdAt;
              const newDay = !email && (index === 0 || messageDay(at) !== messageDay(messages[index - 1].providerTimestamp ?? messages[index - 1].createdAt));
              return <Fragment key={message.id}>
                {newDay && <DaySeparator value={at} />}
                {email ? <EmailMessage message={message} conversation={conversation} defaultOpen={message.id === lastEmail} />
                  : <MessageBubble message={message} conversationId={conversation.id} />}
              </Fragment>;
            })}</ol>
              : <p className="py-10 text-center text-sm text-muted-foreground">No messages.</p>}
            <ReplyList replies={replies} />
          </div>
        </div>
        <Composer replies={replies} conversationId={conversation.id} channel={channel} recipient={conversation.customerIdentity}
          notice={conversation.channelConnection?.sendingEnabled ? null : `Sending is not connected for this channel. Replies cannot leave EstateOS until ${channel === "WEBSITE" ? "an email or WhatsApp channel is connected" : "the provider is connected and approved"}.`} onAssistant={() => setDetails(true)} />
      </div>

      {/* Details: the customer, Claude and internal notes */}
      <aside aria-label="Conversation details" className={cn("absolute inset-y-0 right-0 z-10 w-full max-w-sm flex-col overflow-y-auto border-l bg-card shadow-xl sm:w-80 2xl:static 2xl:z-auto 2xl:w-80 2xl:shadow-none", detailsOpen ? "flex" : "hidden")}>
        <div className="flex items-center justify-between border-b px-4 py-2.5 2xl:hidden"><p className="text-sm font-semibold">Details</p>
          <Button size="icon-sm" variant="ghost" aria-label="Close details" onClick={() => setDetails(false)}><X aria-hidden /></Button></div>
        <PanelBlock icon={<UserRound aria-hidden className="size-3.5" />} title="Customer"><CustomerPanel customer={customer} conversation={conversation} /></PanelBlock>
        <PanelBlock icon={<Sparkles aria-hidden className="size-3.5" />} title="Claude assistant"><AssistantPanel replies={replies} customer={customer} /></PanelBlock>
        <PanelBlock icon={<StickyNote aria-hidden className="size-3.5" />} title="Internal notes">
          <form className="space-y-2" onSubmit={event => { event.preventDefault(); if (note.trim()) void act("note", `/api/inbox/conversations/${conversation.id}/notes`, {body: note.trim()}, "Note added.").then(() => setNote("")); }}>
            <label htmlFor={`note-${conversation.id}`} className="sr-only">Add an internal note</label>
            <textarea id={`note-${conversation.id}`} value={note} onChange={event => setNote(event.target.value)} rows={2} maxLength={4000} className={cn(textareaClassName, "min-h-16 bg-amber-500/5")} placeholder="Visible to your team only; never sent to the customer." />
            <Button type="submit" size="sm" variant="outline" disabled={busy !== null || !note.trim()}>{busy === "note" && <Loader2 aria-hidden className="animate-spin" />}Add note</Button>
          </form>
          {conversation.notes.length ? <ul className="space-y-2" aria-label="Notes">{conversation.notes.map(item => <li key={item.id} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-sm">
            <p dir="auto" className="whitespace-pre-wrap">{item.body}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.author.displayName} · {formatLeadDate(item.createdAt, true)}</p></li>)}</ul>
            : <p className="text-xs text-muted-foreground">No notes yet.</p>}
        </PanelBlock>
      </aside>
    </div>
  </div>;
}
