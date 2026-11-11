"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { ArrowLeft, Link2, Loader2, Paperclip, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { communicationsGet, communicationsSend, errorMessage } from "@/modules/communications/client";
import { CALL_OUTCOME_LABELS, CALL_STATUS_LABELS, type CallOutcome, type CallStatus } from "@/modules/communications/model";
import { formatLeadDate, selectClassName, textareaClassName } from "@/modules/leads/components/lead-ui";
import { CHANNEL_LABELS, DELIVERY_LABELS, PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, type ConversationStatus, type DeliveryStatus, type InboxChannel, type Priority } from "../model";
import type { ConversationView, CustomerContextView, MessageListView } from "../server/conversations";
import { ReplyPanel } from "./reply-panel";
import { EmailMessage } from "./email-message";

type Message = MessageListView["messages"][number];
type Assignee = {id: string; name: string; role: string};

function MessageBubble({message, conversationId}: {message: Message; conversationId: string}) {
  const inbound = message.direction === "INBOUND";
  return <li className={inbound ? "flex justify-start" : "flex justify-end"} data-direction={message.direction}>
    <div className={`max-w-[85%] space-y-1 rounded-lg px-3 py-2 text-sm ${inbound ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
      {message.contentRedactedAt ? <p className="italic opacity-80">Removed under the company&apos;s retention period.</p>
        // Text only: messages are never rendered as HTML, so markup or scripts in them are inert.
        : <p dir="auto" className="whitespace-pre-wrap break-words">{message.content ?? `[${message.messageType.toLowerCase()} message]`}</p>}
      {message.attachments.length > 0 && <ul className="space-y-0.5 text-xs opacity-90" aria-label="Attachments">{message.attachments.map(item => <li key={item.id} className="flex flex-wrap items-center gap-1" data-testid="inbox-attachment">
        <Paperclip aria-hidden className="size-3" />
        {/* Downloaded through an authorized, audited route; never opened inline. */}
        {item.available ? <a className="underline underline-offset-2" href={`/api/inbox/conversations/${conversationId}/attachments/${item.id}`} download>{item.fileName}</a> : <span>{item.fileName}</span>}
        {item.sizeBytes > 0 && <span>({Math.max(1, Math.ceil(item.sizeBytes / 1024))} KB)</span>}
        {item.scanStatus === "BLOCKED" ? <span>· blocked by the file check</span> : !item.available ? <span>· not downloaded (needs a connected provider)</span> : item.scanStatus === "NOT_SCANNED" && <span>· not virus-scanned</span>}
      </li>)}</ul>}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] opacity-75">
        <span>{formatLeadDate(message.providerTimestamp ?? message.createdAt, true)}</span>
        {!inbound && <span>· {DELIVERY_LABELS[message.deliveryStatus as DeliveryStatus] ?? message.deliveryStatus}{message.author?.displayName ? ` · ${message.author.displayName}` : ""}</span>}
        {message.deliveryStatus === "UNKNOWN" && message.providerStatusRaw && <span>({message.providerStatusRaw})</span>}
        {message.simulated && <Badge variant="destructive" className="h-4 px-1 text-[10px]">SIMULATED</Badge>}
      </div>
    </div>
  </li>;
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
    <DialogTrigger render={<Button size="sm" variant="outline" />}><Link2 aria-hidden />{conversation.contactId ? "Change link" : "Link to customer"}</DialogTrigger>
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
  if (!customer) return <p role="status" className="text-sm text-muted-foreground">Loading the customer…</p>;
  const {lead, contact} = customer;
  return <div className="space-y-4 text-sm" aria-label="Customer">
    {!conversation.contactId && <p className="rounded-md border border-dashed p-3 text-muted-foreground">Not linked to a customer. Link it to the lead or contact once you have checked who this is.</p>}
    {contact && <div><p className="font-medium">{contact.fullName}</p><p className="text-xs text-muted-foreground">{[contact.phone, contact.email].filter(Boolean).join(" · ")}</p>
      <Link href={`/contacts/${contact.id}`} className="text-xs font-medium text-primary hover:underline">Open contact</Link></div>}
    {customer.leadHidden && <p className="text-xs text-muted-foreground">The linked lead is not one you can open.</p>}
    {lead && <div className="space-y-3">
      <div><Link href={`/leads/${lead.id}`} className="font-medium text-primary hover:underline">{lead.fullName}</Link>
        <p className="text-xs text-muted-foreground">{lead.status.replaceAll("_", " ").toLowerCase()} · {lead.assignedMembership?.userProfile?.displayName ?? "Unassigned"}{lead.archivedAt ? " · archived" : ""}</p>
        {(lead.propertyInterest || lead.preferredLocation || lead.bedroomPreference) && <p className="text-xs">{[lead.propertyType, lead.bedroomPreference, lead.preferredLocation, lead.propertyInterest].filter(Boolean).join(" · ")}</p>}</div>
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

/** One conversation: header controls, messages, notes and the customer panel. */
export function ConversationPane({conversationId, organizationId, refreshKey, onBack, onChanged}: {conversationId: string; organizationId: string; refreshKey: number; onBack: () => void; onChanged: () => void}) {
  const [conversation, setConversation] = useState<ConversationView | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [earlier, setEarlier] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerContextView | null>(null);
  const [assigneeOptions, setAssigneeOptions] = useState<Assignee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(() => Promise.all([
    communicationsGet<ConversationView>(`/api/inbox/conversations/${conversationId}`, "The conversation could not be loaded."),
    communicationsGet<MessageListView>(`/api/inbox/conversations/${conversationId}/messages`, "Messages could not be loaded."),
    communicationsGet<CustomerContextView>(`/api/inbox/conversations/${conversationId}/customer`, "The customer could not be loaded."),
  ]).then(([detail, list, context]) => { setConversation(detail); setMessages(list.messages); setEarlier(list.earlierCursor); setCustomer(context); setError(null); return detail; },
    problem => { setError(errorMessage(problem, "The conversation could not be loaded.")); return null; }), [conversationId]);

  useEffect(() => {
    void load().then(detail => {
      if (detail && detail.unreadCount > 0) void communicationsSend(`/api/inbox/conversations/${conversationId}/read`, organizationId, "POST", {}).then(onChanged, () => undefined);
    });
    // Mark read once per opened conversation; later refreshes only reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);
  useEffect(() => { if (refreshKey) void load(); }, [refreshKey, load]);
  useEffect(() => { void communicationsGet<Assignee[]>("/api/inbox/assignees").then(setAssigneeOptions, () => setAssigneeOptions([])); }, []);

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

  if (error) return <div className="space-y-2 rounded-xl border p-4"><p role="alert" className="text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={onBack}>Back to the inbox</Button></div>;
  if (!conversation || !messages) return <div role="status" className="animate-pulse rounded-xl border p-6 text-sm text-muted-foreground">Loading the conversation…</div>;
  const name = conversation.contact?.fullName ?? conversation.customerName ?? conversation.customerIdentity;
  const state = (status: ConversationStatus, priority: Priority) => act("state", `/api/inbox/conversations/${conversation.id}/state`, {expectedRevision: conversation.revision, status, priority}, "Conversation updated.");

  return <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_18rem]">
    <div className="min-w-0 space-y-4">
      <Card className="gap-3 py-4 shadow-xs ring-border"><CardContent className="space-y-3 px-4">
        <div className="flex flex-wrap items-start gap-2">
          <Button size="icon" variant="ghost" className="lg:hidden" aria-label="Back to the conversation list" onClick={onBack}><ArrowLeft aria-hidden /></Button>
          <div className="min-w-0 flex-1"><h2 className="truncate text-lg font-semibold">{name}</h2>
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><span>{CHANNEL_LABELS[conversation.channel as InboxChannel]}</span><span>· {conversation.customerIdentity}</span>
              {conversation.identityVerified && <Badge variant="secondary" className="gap-1"><ShieldCheck aria-hidden className="size-3" />Matches the customer record</Badge>}
              {conversation.simulated && <Badge variant="destructive">SIMULATED</Badge>}{conversation.optedOut && <Badge variant="destructive">Opted out</Badge>}</p>
            {conversation.subject && <p className="mt-1 text-sm" dir="auto">{conversation.subject}</p>}</div>
          <LinkDialog conversation={conversation} organizationId={organizationId} onDone={() => { void load(); onChanged(); }} />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs font-medium">Status<select className={selectClassName} value={conversation.status} disabled={busy !== null} aria-label="Status"
            onChange={event => void state(event.target.value as ConversationStatus, conversation.priority as Priority)}>
            <option value={conversation.status}>{STATUS_LABELS[conversation.status as ConversationStatus]}</option>
            {conversation.permissions.statuses.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label>
          <label className="space-y-1 text-xs font-medium">Priority<select className={selectClassName} value={conversation.priority} disabled={busy !== null} aria-label="Priority"
            onChange={event => void state(conversation.status as ConversationStatus, event.target.value as Priority)}>
            {PRIORITIES.map(priority => <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>)}</select></label>
          {conversation.permissions.assignOthers ? <label className="space-y-1 text-xs font-medium">Assigned to<select className={selectClassName} value={conversation.assignedMembershipId ?? ""} disabled={busy !== null} aria-label="Assigned to"
            onChange={event => void act("assign", `/api/inbox/conversations/${conversation.id}/assign`, {expectedRevision: conversation.revision, toMembershipId: event.target.value || null}, event.target.value ? "Conversation assigned." : "Conversation unassigned.")}>
            <option value="">Unassigned</option>{assigneeOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
            : <div className="space-y-1 text-xs"><span className="font-medium">Assigned to</span><p className="text-sm">{conversation.assignedMembership?.userProfile?.displayName ?? "Unassigned"}</p></div>}
          {conversation.permissions.takeForSelf && !conversation.permissions.assignOthers && <Button size="sm" variant="outline" disabled={busy !== null}
            onClick={() => void act("take", `/api/inbox/conversations/${conversation.id}/assign`, {expectedRevision: conversation.revision, toMembershipId: conversation.permissions.me}, "Assigned to you.")}><UserPlus aria-hidden />Assign to me</Button>}
        </div>
      </CardContent></Card>

      <Card className="gap-3 py-4 shadow-xs ring-border"><CardContent className="space-y-3 px-4">
        {earlier && <Button size="sm" variant="ghost" className="w-full" onClick={() => void loadEarlier()}>Load earlier messages</Button>}
        {messages.length ? <ol className={conversation.channel === "EMAIL" ? "space-y-3" : "space-y-2"} aria-label="Messages">{messages.map(message => conversation.channel === "EMAIL"
          ? <EmailMessage key={message.id} message={message} conversation={conversation} />
          : <MessageBubble key={message.id} message={message} conversationId={conversation.id} />)}</ol>
          : <p className="text-sm text-muted-foreground">No messages.</p>}
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground" data-testid="sending-disabled">
          {conversation.channelConnection?.sendingEnabled ? "Replies are prepared as drafts and need approval before they are sent." : `Sending is not connected for this channel. Replies cannot leave EstateOS until ${conversation.channel === "WEBSITE" ? "an email or WhatsApp channel is connected" : "the provider is connected and approved"}.`}
        </p>
      </CardContent></Card>

      <ReplyPanel key={conversation.id} conversationId={conversation.id} organizationId={organizationId} customer={customer} onSent={() => { void load(); onChanged(); }} />

      <Card className="gap-3 py-4 shadow-xs ring-border"><CardHeader className="px-4"><CardTitle role="heading" aria-level={3} className="text-sm">Internal notes</CardTitle></CardHeader>
        <CardContent className="space-y-3 px-4">
          <form className="space-y-2" onSubmit={event => { event.preventDefault(); if (note.trim()) void act("note", `/api/inbox/conversations/${conversation.id}/notes`, {body: note.trim()}, "Note added.").then(() => setNote("")); }}>
            <label htmlFor={`note-${conversation.id}`} className="sr-only">Add an internal note</label>
            <textarea id={`note-${conversation.id}`} value={note} onChange={event => setNote(event.target.value)} rows={2} maxLength={4000} className={textareaClassName} placeholder="Visible to your team only; never sent to the customer." />
            <Button type="submit" size="sm" variant="outline" disabled={busy !== null || !note.trim()}>{busy === "note" && <Loader2 aria-hidden className="animate-spin" />}Add note</Button>
          </form>
          {conversation.notes.length ? <ul className="space-y-2" aria-label="Notes">{conversation.notes.map(item => <li key={item.id} className="rounded-md bg-muted/60 p-2 text-sm">
            <p dir="auto" className="whitespace-pre-wrap">{item.body}</p><p className="text-[11px] text-muted-foreground">{item.author.displayName} · {formatLeadDate(item.createdAt, true)}</p></li>)}</ul>
            : <p className="text-sm text-muted-foreground">No notes yet.</p>}
        </CardContent></Card>
    </div>
    <aside className="space-y-3 rounded-xl border p-4"><h3 className="text-sm font-semibold">Customer</h3><CustomerPanel customer={customer} conversation={conversation} /></aside>
  </div>;
}
