"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  AlertCircle, ArrowDown, Bot, Check, Copy, History, Loader2, MessageSquarePlus, RotateCcw, Search, Send, Sparkles, Square, Trash2, Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CopilotRequestError, deleteCopilotConversation, getCopilotConversation, getCopilotStatus, listCopilotConversations, streamCopilotChat,
  type ConversationSummary, type CopilotStatus,
} from "../client";
import type { ChatStreamEvent } from "../protocol";
import { MarkdownView } from "./markdown-view";

const SUGGESTIONS = [
  "Find available apartments in Dubai Marina.",
  "Summarize today's lead follow-ups.",
  "Find properties matching a customer's requirements.",
  "Show available projects in Business Bay.",
  "Compare three selected property listings.",
  "Summarize my sales activities.",
];

interface ToolProgress { id: string; label: string; state: "running" | "done" | "failed" }
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  state: "complete" | "streaming" | "error" | "stopped";
  tools?: ToolProgress[];
  error?: {code: string; message: string; retryable: boolean};
  /** For assistant replies: the question that produced it, used by Retry. */
  question?: string;
}

const localId = () => `local-${Math.random().toString(36).slice(2)}`;

function relativeDate(value: string) {
  const date = new Date(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days < 1) return date.toLocaleTimeString("en-AE", {hour: "2-digit", minute: "2-digit"});
  if (days < 7) return date.toLocaleDateString("en-AE", {weekday: "short"});
  return date.toLocaleDateString("en-AE", {day: "numeric", month: "short"});
}

export function CopilotWorkspace({organizationId, companyName, initialPrompt}: {organizationId: string; companyName: string; initialPrompt?: string}) {
  const [status, setStatus] = useState<CopilotStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [input, setInput] = useState(initialPrompt ?? "");
  const [pending, setPending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const maxChars = status?.enabled ? status.maxInputChars : 4000;
  const available = status?.enabled === true && status.model.available;

  const loadStatus = useCallback(() => getCopilotStatus()
    .then(next => { setStatus(next); setStatusError(null); })
    .catch((error: unknown) => setStatusError(error instanceof Error ? error.message : "The AI Copilot status could not be loaded.")), []);
  const refreshStatus = useCallback(() => { setStatusError(null); void loadStatus(); }, [loadStatus]);

  const refreshConversations = useCallback((query: string) => {
    setListError(null);
    return listCopilotConversations(query)
      .then(data => setConversations(data.conversations))
      .catch((error: unknown) => setListError(error instanceof Error ? error.message : "Conversations could not be loaded."));
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);
  useEffect(() => {
    const timer = setTimeout(() => { void refreshConversations(search); }, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [search, refreshConversations]);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Keep the newest text in view unless the user has scrolled up to read.
  useEffect(() => {
    const element = scrollRef.current;
    if (element && atBottom) element.scrollTop = element.scrollHeight;
  }, [messages, atBottom]);

  const onScroll = () => {
    const element = scrollRef.current;
    if (element) setAtBottom(element.scrollHeight - element.scrollTop - element.clientHeight < 80);
  };
  const scrollToBottom = () => {
    const element = scrollRef.current;
    if (element) element.scrollTo({top: element.scrollHeight, behavior: "smooth"});
    setAtBottom(true);
  };

  const resizeInput = () => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  };
  useEffect(resizeInput, [input]);

  const newChat = () => {
    if (pending) return;
    setActiveId(null); setMessages([]); setConversationError(null); setHistoryOpen(false);
    inputRef.current?.focus();
  };

  const openConversation = async (id: string) => {
    if (pending || id === activeId) { setHistoryOpen(false); return; }
    setActiveId(id); setMessages([]); setConversationError(null); setLoadingConversation(true); setHistoryOpen(false);
    try {
      const data = await getCopilotConversation(id);
      setMessages(data.messages.map(message => ({id: message.id, role: message.role === "USER" ? "user" : "assistant", content: message.content, state: "complete"})));
      setAtBottom(true);
    } catch (error) {
      setConversationError(error instanceof Error ? error.message : "This conversation could not be loaded.");
    } finally {
      setLoadingConversation(false);
    }
  };

  const updateAssistant = (id: string, update: (message: ChatMessage) => ChatMessage) =>
    setMessages(current => current.map(message => message.id === id ? update(message) : message));

  const send = async (text: string, replaceFrom?: string) => {
    const question = text.trim();
    if (!question || pending || !available) return;
    if (question.length > maxChars) { toast.error(`Keep questions under ${maxChars.toLocaleString("en-US")} characters.`); return; }
    const userId = localId();
    const assistantId = localId();
    setMessages(current => {
      const base = replaceFrom ? current.slice(0, current.findIndex(message => message.id === replaceFrom)) : current;
      return [...base, {id: userId, role: "user", content: question, state: "complete"},
        {id: assistantId, role: "assistant", content: "", state: "streaming", tools: [], question}];
    });
    setInput(""); setPending(true); setAtBottom(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const onEvent = (event: ChatStreamEvent) => {
      switch (event.type) {
        case "text": updateAssistant(assistantId, message => ({...message, content: message.content + event.text})); break;
        case "tool": updateAssistant(assistantId, message => {
          const tools = message.tools ?? [];
          const existing = tools.some(tool => tool.id === event.id);
          return {...message, tools: existing ? tools.map(tool => tool.id === event.id ? {...tool, state: event.state} : tool) : [...tools, {id: event.id, label: event.label, state: event.state}]};
        }); break;
        case "done": {
          updateAssistant(assistantId, message => ({...message, state: "complete"}));
          setActiveId(event.conversationId);
          const now = new Date().toISOString();
          // Show the conversation and the new allowance count at once; the refreshes confirm them.
          if (event.title) setConversations(current => [{id: event.conversationId, title: event.title!, messageCount: 2, createdAt: now, updatedAt: now, lastMessageAt: now},
            ...(current ?? []).filter(item => item.id !== event.conversationId)]);
          void refreshConversations(search);
          void loadStatus();
          break;
        }
        case "error":
          updateAssistant(assistantId, message => ({...message, state: event.code === "AI_CANCELLED" ? "stopped" : "error",
            error: {code: event.code, message: event.message, retryable: event.retryable}}));
          break;
      }
    };
    try {
      await streamCopilotChat({message: question, conversationId: activeId, organizationId, signal: controller.signal, onEvent});
    } catch (error) {
      if (controller.signal.aborted) {
        updateAssistant(assistantId, message => ({...message, state: "stopped", error: {code: "AI_CANCELLED", message: "Stopped. This reply was not saved.", retryable: true}}));
      } else {
        const code = error instanceof CopilotRequestError ? error.code : "REQUEST_FAILED";
        const messageText = error instanceof Error ? error.message : "The AI Copilot could not answer. Try again.";
        updateAssistant(assistantId, message => ({...message, state: "error", error: {code, message: messageText, retryable: !["AI_QUOTA_EXCEEDED", "AI_DISABLED", "AI_NOT_CONFIGURED", "VALIDATION_ERROR", "NOT_FOUND"].includes(code)}}));
        if (code === "NOT_FOUND") setActiveId(null);
        if (code === "AI_QUOTA_EXCEEDED") refreshStatus();
      }
    } finally {
      abortRef.current = null;
      setPending(false);
    }
  };

  const stop = () => abortRef.current?.abort();

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(input);
    } else if (event.key === "Escape" && pending) {
      event.preventDefault();
      stop();
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCopilotConversation(deleteTarget.id, organizationId);
      setConversations(current => current?.filter(item => item.id !== deleteTarget.id) ?? null);
      if (deleteTarget.id === activeId) { setActiveId(null); setMessages([]); }
      toast.success("Conversation deleted.");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The conversation could not be deleted.");
    } finally {
      setDeleting(false);
    }
  };

  const history = (
    <ConversationList
      conversations={conversations} error={listError} search={search} onSearch={setSearch} activeId={activeId} disabled={pending}
      onNew={newChat} onOpen={id => void openConversation(id)} onDelete={setDeleteTarget} onRetry={() => void refreshConversations(search)}
    />
  );

  return (
    <div className="flex h-[calc(100dvh-13.5rem)] min-h-[34rem] overflow-hidden rounded-xl border bg-card shadow-xs">
      <aside className="hidden w-72 shrink-0 flex-col border-r lg:flex" aria-label="Conversation history">{history}</aside>
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="w-[min(88vw,20rem)] gap-0 p-0">
          <SheetHeader className="border-b"><SheetTitle>Conversations</SheetTitle></SheetHeader>
          {history}
        </SheetContent>
      </Sheet>

      <section className="flex min-w-0 flex-1 flex-col" aria-label="AI Copilot chat">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setHistoryOpen(true)} aria-label="Show conversations"><History aria-hidden="true" /></Button>
            <Bot className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{activeId ? conversations?.find(item => item.id === activeId)?.title ?? "Conversation" : "New conversation"}</h2>
              <p className="truncate text-xs text-muted-foreground">Read-only answers from {companyName}&apos;s CRM, limited to what your role can see.</p>
            </div>
          </div>
          <StatusBadge status={status} error={statusError} />
        </header>

        <div className="relative min-h-0 flex-1">
          <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto px-4 py-5 sm:px-6" role="log" aria-live="polite" aria-relevant="additions text" aria-busy={pending}>
            {loadingConversation ? <ConversationSkeleton />
              : conversationError ? <InlineError message={conversationError} onRetry={activeId ? () => { const id = activeId; setActiveId(null); void openConversation(id); } : undefined} />
              : messages.length === 0 ? <Welcome status={status} statusError={statusError} disabled={!available || pending} onPick={text => { setInput(text); inputRef.current?.focus(); }} onRetryStatus={refreshStatus} />
              : <ol className="mx-auto flex max-w-3xl flex-col gap-5">
                {messages.map(message => <MessageItem key={message.id} message={message} pending={pending}
                  onRetry={message.question ? () => void send(message.question!, messages[messages.findIndex(item => item.id === message.id) - 1]?.id) : undefined} />)}
              </ol>}
          </div>
          {!atBottom && messages.length > 0 && (
            <Button variant="outline" size="sm" className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-sm" onClick={scrollToBottom}><ArrowDown aria-hidden="true" />Latest</Button>
          )}
        </div>

        <form className="border-t p-3 sm:p-4" onSubmit={event => { event.preventDefault(); void send(input); }}>
          <div className="mx-auto max-w-3xl">
            <div className={cn("flex items-end gap-2 rounded-xl border bg-background p-2 focus-within:ring-3 focus-within:ring-ring/50", !available && "opacity-70")}>
              <label htmlFor="copilot-input" className="sr-only">Ask the AI Copilot</label>
              <textarea
                id="copilot-input" ref={inputRef} rows={1} value={input} maxLength={maxChars + 500}
                onChange={event => setInput(event.target.value)} onKeyDown={onKeyDown}
                disabled={!available} placeholder={available ? "Ask about your leads, properties, projects or follow-ups…" : "The AI Copilot is unavailable."}
                className="max-h-[220px] min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                aria-describedby="copilot-input-help"
              />
              {pending
                ? <Button type="button" variant="outline" size="icon" onClick={stop} aria-label="Stop generating"><Square aria-hidden="true" /></Button>
                : <Button type="submit" size="icon" disabled={!available || !input.trim() || input.trim().length > maxChars} aria-label="Send"><Send aria-hidden="true" /></Button>}
            </div>
            <div id="copilot-input-help" className="mt-1.5 flex justify-between gap-3 px-1 text-[11px] text-muted-foreground">
              <span>Enter to send · Shift+Enter for a new line{pending ? " · Esc to stop" : ""}. Claude can make mistakes; check important details in the record.</span>
              <span className={cn("shrink-0 tabular-nums", input.length > maxChars && "font-medium text-destructive")} aria-live="polite">
                {input.length > maxChars * 0.8 ? `${input.length.toLocaleString("en-US")} / ${maxChars.toLocaleString("en-US")}` : ""}
              </span>
            </div>
          </div>
        </form>
      </section>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open && !deleting) setDeleteTarget(null); }}>
        <DialogContent showCloseButton={!deleting} className="max-w-[calc(100%-1rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
            <DialogDescription>“{deleteTarget?.title}” and all of its messages will be permanently removed from EstateOS. CRM records are not affected.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>{deleting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({status, error}: {status: CopilotStatus | null; error: string | null}) {
  if (error) return <Badge variant="destructive">Unavailable</Badge>;
  if (!status) return <Skeleton className="h-5 w-24" />;
  if (!status.enabled) return <Badge variant="outline">Not configured</Badge>;
  if (!status.model.available) return <Badge variant="destructive">Model unavailable</Badge>;
  const used = status.usage.user;
  return <div className="hidden shrink-0 items-center gap-2 sm:flex">
    <span className="text-[11px] text-muted-foreground tabular-nums" title="Your requests this month">{used.used.toLocaleString("en-US")} / {used.limit.toLocaleString("en-US")} this month</span>
    <Badge variant="secondary" title="Anthropic model">{status.model.displayName ?? status.model.model}</Badge>
  </div>;
}

function ConversationList(props: {
  conversations: ConversationSummary[] | null; error: string | null; search: string; onSearch: (value: string) => void; activeId: string | null; disabled: boolean;
  onNew: () => void; onOpen: (id: string) => void; onDelete: (conversation: ConversationSummary) => void; onRetry: () => void;
}) {
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="space-y-2 border-b p-3">
      <Button className="w-full justify-start" onClick={props.onNew} disabled={props.disabled}><MessageSquarePlus aria-hidden="true" />New chat</Button>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={props.search} onChange={event => props.onSearch(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" className="pl-8" maxLength={120} />
      </div>
    </div>
    <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Conversations">
      {props.error ? <div className="p-3 text-xs text-muted-foreground"><p role="alert">{props.error}</p><Button variant="link" size="sm" className="px-0" onClick={props.onRetry}>Try again</Button></div>
        : props.conversations === null ? <div className="space-y-2 p-1">{[0, 1, 2, 3].map(item => <Skeleton key={item} className="h-9 w-full" />)}</div>
        : props.conversations.length === 0 ? <p className="p-3 text-xs leading-5 text-muted-foreground">{props.search ? "No conversations match this search." : "No saved conversations yet. Your questions and Claude's answers appear here after the first reply."}</p>
        : <ul className="space-y-0.5">{props.conversations.map(item => (
          <li key={item.id} className={cn("group flex items-center gap-1 rounded-lg pr-1", item.id === props.activeId ? "bg-muted" : "hover:bg-muted/60")}>
            <button type="button" onClick={() => props.onOpen(item.id)} disabled={props.disabled} aria-current={item.id === props.activeId ? "page" : undefined}
              className="flex min-w-0 flex-1 flex-col items-start rounded-lg px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed">
              <span className="w-full truncate text-sm">{item.title}</span>
              <span className="text-[11px] text-muted-foreground">{relativeDate(item.lastMessageAt)}</span>
            </button>
            <Button variant="ghost" size="icon-xs" className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100" onClick={() => props.onDelete(item)} disabled={props.disabled} aria-label={`Delete conversation ${item.title}`}><Trash2 aria-hidden="true" /></Button>
          </li>
        ))}</ul>}
    </nav>
  </div>;
}

function Welcome({status, statusError, disabled, onPick, onRetryStatus}: {status: CopilotStatus | null; statusError: string | null; disabled: boolean; onPick: (text: string) => void; onRetryStatus: () => void}) {
  const unavailable = statusError ?? (status && !status.enabled ? status.message : status?.enabled && !status.model.available ? status.model.message : null);
  return <div className="mx-auto flex max-w-2xl flex-col items-center py-6 text-center">
    <span className="mb-4 flex size-12 items-center justify-center rounded-xl border bg-background text-primary"><Sparkles className="size-5" aria-hidden="true" /></span>
    <h3 className="text-lg font-semibold">Ask about your agency&apos;s CRM</h3>
    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">EstateOS Copilot answers from your company&apos;s real leads, properties, projects and follow-ups, within your permissions. It can&apos;t change records yet.</p>
    {unavailable && <div role="alert" className="mt-5 flex max-w-md items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left text-sm">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <div><p>{unavailable}</p>{statusError && <Button variant="link" size="sm" className="h-auto px-0" onClick={onRetryStatus}>Try again</Button>}</div>
    </div>}
    <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
      {SUGGESTIONS.map(text => <button key={text} type="button" disabled={disabled} onClick={() => onPick(text)}
        className="rounded-lg border bg-background px-3 py-2.5 text-left text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60">{text}</button>)}
    </div>
  </div>;
}

function MessageItem({message, pending, onRetry}: {message: ChatMessage; pending: boolean; onRetry?: () => void}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { toast.error("Copy failed. Select the text and copy it manually."); }
  };
  const runningTools = useMemo(() => message.tools?.filter(tool => tool.state === "running") ?? [], [message.tools]);

  if (message.role === "user") {
    return <li className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap text-primary-foreground">{message.content}</div></li>;
  }
  return <li className="flex gap-3">
    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-background text-primary"><Bot className="size-4" aria-hidden="true" /><span className="sr-only">Copilot:</span></span>
    <div className="min-w-0 flex-1">
      {Boolean(message.tools?.length) && <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="CRM lookups">
        {message.tools!.map(tool => <li key={tool.id} className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]", tool.state === "failed" ? "border-destructive/40 text-destructive" : "text-muted-foreground")}>
          {tool.state === "running" ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Wrench className="size-3" aria-hidden="true" />}{tool.label}{tool.state === "failed" ? " (failed)" : ""}
        </li>)}
      </ul>}
      {message.content ? <MarkdownView source={message.content} />
        : message.state === "streaming" ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />{runningTools.length ? `${runningTools[0].label}…` : "Thinking…"}</p>
        : null}
      {message.error && <div role="alert" className={cn("mt-2 flex items-start gap-2 rounded-lg border p-2.5 text-xs", message.state === "stopped" ? "text-muted-foreground" : "border-destructive/30 bg-destructive/5")}>
        <AlertCircle className={cn("mt-0.5 size-3.5 shrink-0", message.state !== "stopped" && "text-destructive")} aria-hidden="true" />
        <div className="flex-1">
          <p>{message.error.message}{message.content && message.state !== "stopped" && message.error.code !== "AI_SAVE_FAILED" ? " The partial reply above was not saved." : ""}</p>
        </div>
        {message.error.retryable && onRetry && <Button variant="outline" size="xs" onClick={onRetry} disabled={pending}><RotateCcw aria-hidden="true" />Retry</Button>}
      </div>}
      {message.state === "complete" && message.content && <div className="mt-1.5 flex gap-1">
        <Button variant="ghost" size="xs" onClick={() => void copy()} aria-label="Copy response">{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? "Copied" : "Copy"}</Button>
      </div>}
    </div>
  </li>;
}

function ConversationSkeleton() {
  return <div className="mx-auto max-w-3xl space-y-5" aria-label="Loading conversation">
    <Skeleton className="ml-auto h-10 w-2/3 rounded-2xl" /><Skeleton className="h-24 w-full" /><Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" /><Skeleton className="h-16 w-5/6" />
  </div>;
}

function InlineError({message, onRetry}: {message: string; onRetry?: () => void}) {
  return <div role="alert" className="mx-auto flex max-w-md flex-col items-center py-10 text-center text-sm">
    <AlertCircle className="mb-3 size-6 text-destructive" aria-hidden="true" />
    <p>{message}</p>
    {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}><RotateCcw aria-hidden="true" />Try again</Button>}
  </div>;
}
