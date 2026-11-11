"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CircleCheck, CircleDot, Clock3, FlaskConical, Inbox, Layers, Link2Off, Loader2, MailOpen, MessagesSquare, PanelLeftClose, PanelLeftOpen, RefreshCw, Search, UserRound, UserX,
  type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { communicationsGet, errorMessage } from "@/modules/communications/client";
import { CHANNEL_LABELS, INBOX_CHANNELS, INBOX_VIEWS, PRIORITY_LABELS, VIEW_LABELS, type InboxChannel, type InboxView } from "../model";
import type { ConversationListView, InboxCountsView } from "../server/conversations";
import { ConversationPane } from "./conversation-pane";
import { CHANNEL_ICONS, CHANNEL_TONES, ContactAvatar, listTime } from "./inbox-ui";

export { CHANNEL_ICONS } from "./inbox-ui";

/** How often the open inbox checks for new messages (there is no real-time channel; docs/UNIFIED_INBOX.md#refresh). */
const REFRESH_MS = 30_000;
const COMPACT_KEY = "estateos.inbox.compactNav";
const compactListeners = new Set<() => void>();
function subscribeCompact(listener: () => void) {
  compactListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => { compactListeners.delete(listener); window.removeEventListener("storage", listener); };
}
const readCompact = () => { try { return window.localStorage.getItem(COMPACT_KEY) === "1"; } catch { return false; } };

const VIEW_ICONS: Record<InboxView, LucideIcon> = {
  ALL: Inbox, UNREAD: MailOpen, MINE: UserRound, UNASSIGNED: UserX, NEEDS_MATCHING: Link2Off, OPEN: CircleDot, PENDING: Clock3, RESOLVED: CircleCheck,
};
const QUEUES: InboxView[] = ["ALL", "UNREAD", "MINE", "UNASSIGNED", "NEEDS_MATCHING"];
const STATES: InboxView[] = ["OPEN", "PENDING", "RESOLVED"];
const CHANNELS = INBOX_CHANNELS.filter(item => item !== "INTERNAL");

type Row = ConversationListView["conversations"][number];

/** The unified inbox, laid out like a mail client: folders, the conversation list and the open conversation. */
export function InboxApp({organizationId, conversationId}: {organizationId: string; conversationId: string | null}) {
  const router = useRouter();
  const [view, setView] = useState<InboxView>("ALL");
  const [channel, setChannel] = useState<InboxChannel | "">("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [counts, setCounts] = useState<InboxCountsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  /** Developer tools only: simulated conversations are listed only when asked for. */
  const [withSimulated, setWithSimulated] = useState(false);
  const [simulatedAvailable, setSimulatedAvailable] = useState(false);
  /** The folder column as an icon rail (remembered on this device). */
  const compact = useSyncExternalStore(subscribeCompact, readCompact, () => false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggleCompact() {
    try { window.localStorage.setItem(COMPACT_KEY, compact ? "0" : "1"); } catch { /* storage unavailable */ }
    compactListeners.forEach(listener => listener());
  }

  const params = useCallback((extra: Record<string, string> = {}) => {
    const values = new URLSearchParams({view, ...(channel ? {channel} : {}), ...(query ? {search: query} : {}), ...(withSimulated ? {includeSimulated: "1"} : {}), ...extra});
    return values.toString();
  }, [view, channel, query, withSimulated]);

  const load = useCallback(() => Promise.all([
    communicationsGet<ConversationListView>(`/api/inbox/conversations?${params()}`, "Conversations could not be loaded."),
    communicationsGet<InboxCountsView>(`/api/inbox/counts${withSimulated ? "?includeSimulated=1" : ""}`, "Counts could not be loaded."),
  ]).then(([list, totals]) => { setRows(list.conversations); setCursor(list.nextCursor); setCounts(totals); setSimulatedAvailable(list.simulated.available); setError(null); },
    problem => setError(errorMessage(problem, "The inbox could not be loaded."))).finally(() => setRefreshing(false)), [params, withSimulated]);

  useEffect(() => { void load(); }, [load, refreshKey]);
  // A controlled refresh while the inbox is visible: on an interval and when the tab comes back.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") setRefreshKey(key => key + 1); };
    const timer = setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const more = await communicationsGet<ConversationListView>(`/api/inbox/conversations?${params({cursor})}`, "More conversations could not be loaded.");
      setRows(current => [...(current ?? []), ...more.conversations]);
      setCursor(more.nextCursor);
    } catch (problem) { setError(errorMessage(problem, "More conversations could not be loaded.")); }
    finally { setLoadingMore(false); }
  }

  function onSearch(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setQuery(value.trim()), 300);
  }
  function chooseView(item: InboxView) { setView(item); setRows(null); }
  function chooseChannel(item: InboxChannel | "") { setChannel(item); setRows(null); }

  const showList = !conversationId;
  const countOf = (item: InboxView) => item === "ALL" ? null : counts?.[item as Exclude<InboxView, "ALL">] ?? null;
  // In the rail, labels stay for screen readers; from xl the column shows them unless the member collapsed it.
  const label = compact ? "sr-only" : "sr-only xl:not-sr-only xl:min-w-0 xl:flex-1 xl:truncate xl:text-left";
  const rowAlign = compact ? "justify-center" : "justify-center xl:justify-start";
  const heading = compact ? "sr-only" : "sr-only xl:not-sr-only xl:block xl:px-2.5 xl:pb-1 xl:text-[11px] xl:font-medium xl:uppercase xl:tracking-wider xl:text-muted-foreground";

  const folder = (item: InboxView) => {
    const Icon = VIEW_ICONS[item];
    const count = countOf(item);
    const active = view === item;
    return <li key={item}><button type="button" onClick={() => chooseView(item)} aria-current={active ? "true" : undefined} title={VIEW_LABELS[item]}
      className={cn("relative flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        rowAlign, active && "bg-primary/10 font-medium text-primary hover:bg-primary/15 hover:text-primary")}>
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className={label}>{VIEW_LABELS[item]}</span>
      {count ? <span className={cn("rounded-full px-1.5 text-[10px] font-semibold tabular-nums leading-4", item === "UNREAD" ? "bg-primary text-primary-foreground" : "bg-muted-foreground/15 text-foreground",
        compact ? "absolute right-0.5 top-0.5" : "absolute right-0.5 top-0.5 xl:static xl:text-[11px] xl:leading-5")}>{count}</span> : null}
    </button></li>;
  };

  return <div className="flex h-[calc(100svh-6rem)] min-h-[520px] lg:h-[calc(100svh-19.5rem)] lg:min-h-[560px] min-w-0 overflow-hidden rounded-xl border bg-card shadow-xs">
    {/* Folders: queues, status and channels */}
    <nav aria-label="Inbox views" className={cn("hidden shrink-0 flex-col border-r bg-muted/25 lg:flex", compact ? "w-14" : "w-14 xl:w-56")}>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-2 py-3">
        <div><p className={heading}>Inbox</p><ul className="space-y-0.5">{QUEUES.map(folder)}</ul></div>
        <div><p className={heading}>Status</p><ul className="space-y-0.5">{STATES.map(folder)}</ul></div>
        <div><p className={heading}>Channels</p>
          <ul className="space-y-0.5">
            <li><button type="button" onClick={() => chooseChannel("")} aria-current={channel === "" ? "true" : undefined} title="All channels"
              className={cn("flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", rowAlign, channel === "" && "bg-muted font-medium text-foreground")}>
              <Layers aria-hidden className="size-4 shrink-0" /><span className={label}>All channels</span></button></li>
            {CHANNELS.map(item => { const Icon = CHANNEL_ICONS[item]; return <li key={item}>
              <button type="button" onClick={() => chooseChannel(item)} aria-current={channel === item ? "true" : undefined} title={CHANNEL_LABELS[item]}
                className={cn("flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", rowAlign, channel === item && "bg-muted font-medium text-foreground")}>
                <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center rounded-md", CHANNEL_TONES[item])}><Icon className="size-3" strokeWidth={2.5} /></span>
                <span className={label}>{CHANNEL_LABELS[item]}</span></button></li>; })}
          </ul></div>
        {simulatedAvailable && <label title="Include simulated conversations (developer tools)" data-testid="include-simulated"
          className={cn("flex items-start gap-2 rounded-lg border border-dashed px-2 py-2 text-xs text-muted-foreground", rowAlign)}>
          <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={withSimulated} onChange={event => setWithSimulated(event.target.checked)} />
          <span className={label}><FlaskConical aria-hidden className="mr-1 inline size-3.5" />Include simulated conversations (developer tools)</span></label>}
      </div>
      <div className="hidden border-t p-2 xl:block">
        <Button size="sm" variant="ghost" className={cn("w-full text-muted-foreground", compact ? "px-0" : "justify-start")} onClick={toggleCompact} aria-label={compact ? "Expand the folder list" : "Collapse the folder list"}>
          {compact ? <PanelLeftOpen aria-hidden /> : <><PanelLeftClose aria-hidden />Collapse</>}</Button>
      </div>
    </nav>

    {/* Conversation list */}
    <section aria-label="Conversations" className={cn("flex min-h-0 w-full min-w-0 shrink-0 flex-col border-r lg:w-80 2xl:w-96", !showList && "hidden lg:flex")}>
      <div className="space-y-2.5 border-b px-3 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-semibold">{VIEW_LABELS[view]}</h2>
          {channel && <Badge variant="secondary" className="shrink-0">{CHANNEL_LABELS[channel]}</Badge>}
          {countOf(view) ? <span className="text-xs tabular-nums text-muted-foreground">{countOf(view)}</span> : null}
          <Button size="icon-sm" variant="ghost" className="ml-auto" aria-label="Refresh" disabled={refreshing} onClick={() => { setRefreshing(true); setRefreshKey(key => key + 1); }}>
            <RefreshCw aria-hidden className={cn(refreshing && "animate-spin")} /></Button>
        </div>
        {/* Phones and tablets: the folders as two compact choices. */}
        <div className="grid grid-cols-2 gap-2 lg:hidden">
          <select aria-label="View" value={view} onChange={event => chooseView(event.target.value as InboxView)} className="h-8 min-w-0 rounded-md border bg-background px-2 text-xs">
            {INBOX_VIEWS.map(item => <option key={item} value={item}>{VIEW_LABELS[item]}{countOf(item) ? ` (${countOf(item)})` : ""}</option>)}</select>
          <select aria-label="Channel" value={channel} onChange={event => chooseChannel(event.target.value as InboxChannel | "")} className="h-8 min-w-0 rounded-md border bg-background px-2 text-xs">
            <option value="">All channels</option>{CHANNELS.map(item => <option key={item} value={item}>{CHANNEL_LABELS[item]}</option>)}</select>
        </div>
        <div className="relative"><Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="inbox-search" className="sr-only">Search conversations</label>
          <Input id="inbox-search" type="search" value={search} onChange={event => onSearch(event.target.value)} placeholder="Search name, number, email or text" className="h-9 bg-background pl-8" maxLength={100} /></div>
      </div>
      {error && <p role="alert" className="border-b bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!rows ? <div role="status" aria-label="Loading conversations" className="divide-y">{Array.from({length: 7}, (_, index) => <div key={index} className="flex gap-3 px-3 py-3">
            <Skeleton className="size-9 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/2" /><Skeleton className="h-3 w-5/6" /><Skeleton className="h-3 w-1/3" /></div></div>)}</div>
          : !rows.length ? <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted"><MessagesSquare aria-hidden className="size-5 text-muted-foreground" /></span>
              <p className="text-sm font-medium">{query ? "No matching conversations" : "No conversations here"}</p>
              <p className="mt-1 max-w-60 text-xs text-muted-foreground">{query ? "Try another name, number, email or word." : "Messages appear when customers write through a connected channel or a website form."}</p></div>
          : <ul data-testid="conversation-list">{rows.map(row => <ConversationRow key={row.id} row={row} selected={conversationId === row.id} />)}</ul>}
        {cursor && <div className="border-t p-2"><Button variant="ghost" size="sm" className="w-full" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore && <Loader2 aria-hidden className="animate-spin" />}Load more</Button></div>}
      </div>
    </section>

    {/* Open conversation */}
    <section aria-label="Conversation" className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col", showList && "hidden lg:flex")}>
      {conversationId ? <ConversationPane key={conversationId} conversationId={conversationId} organizationId={organizationId} refreshKey={refreshKey}
        onBack={() => router.push("/inbox")} onChanged={() => setRefreshKey(key => key + 1)} />
        : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10"><Inbox aria-hidden className="size-6 text-primary" /></span>
            <p className="text-sm font-medium">Choose a conversation to read it.</p>
            <p className="mt-1 max-w-72 text-xs text-muted-foreground">WhatsApp chats, emails and website enquiries you are allowed to see appear in the list. Replies are sent only after approval.</p></div>}
    </section>
  </div>;
}

/** One conversation in the list: who, when, the subject or last message, and what needs doing. */
function ConversationRow({row, selected}: {row: Row; selected: boolean}) {
  const name = row.contact?.fullName ?? row.customerName ?? row.customerIdentity;
  const unread = row.unreadCount > 0;
  const urgent = row.priority === "HIGH" || row.priority === "URGENT";
  return <li className="border-b last:border-b-0"><Link href={`/inbox/${row.id}`} aria-current={selected ? "page" : undefined}
    className={cn("relative flex gap-3 px-3 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none", selected && "bg-primary/[0.07] hover:bg-primary/10")}>
    {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" />}
    <ContactAvatar name={name} channel={row.channel as InboxChannel} />
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2">
        <span className={cn("min-w-0 flex-1 truncate text-sm", unread ? "font-semibold text-foreground" : "font-medium text-foreground/90")}>{name}</span>
        <time dateTime={row.lastMessageAt ?? undefined} className={cn("shrink-0 text-[11px] tabular-nums", unread ? "font-semibold text-primary" : "text-muted-foreground")}>{listTime(row.lastMessageAt)}</time>
      </div>
      {row.subject && <p dir="auto" className={cn("truncate text-[13px]", unread ? "font-medium text-foreground" : "text-foreground/80")}>{row.subject}</p>}
      <div className="flex items-center gap-2">
        <p dir="auto" className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{row.lastMessagePreview}</p>
        {unread && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold tabular-nums text-primary-foreground" aria-label={`${row.unreadCount} unread`}>{row.unreadCount}</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px]">
        <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{row.assignedMembership?.userProfile?.displayName ?? "Unassigned"}</span>
        {!row.contactId && <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">Needs matching</span>}
        {urgent && <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive">{PRIORITY_LABELS[row.priority as "HIGH" | "URGENT"]}</span>}
        {row.optedOut && <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">Opted out</span>}
        {row.simulated && <span className="rounded bg-destructive px-1.5 py-0.5 font-semibold text-white">SIMULATED</span>}
      </div>
    </div>
  </Link></li>;
}
