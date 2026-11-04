"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Globe, Inbox, Loader2, Mail, MessageCircle, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { communicationsGet, errorMessage } from "@/modules/communications/client";
import { formatLeadDate } from "@/modules/leads/components/lead-ui";
import { CHANNEL_LABELS, INBOX_CHANNELS, INBOX_VIEWS, PRIORITY_LABELS, VIEW_LABELS, type InboxChannel, type InboxView } from "../model";
import type { ConversationListView, InboxCountsView } from "../server/conversations";
import { ConversationPane } from "./conversation-pane";

/** How often the open inbox checks for new messages (there is no real-time channel; docs/UNIFIED_INBOX.md#refresh). */
const REFRESH_MS = 30_000;

export const CHANNEL_ICONS: Record<InboxChannel, typeof Mail> = {WHATSAPP: MessageCircle, EMAIL: Mail, WEBSITE: Globe, INTERNAL: Inbox};

type Row = ConversationListView["conversations"][number];

/** The unified inbox: views and channels, the conversation list, and the open conversation. */
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
  const [refreshKey, setRefreshKey] = useState(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const params = useCallback((extra: Record<string, string> = {}) => {
    const values = new URLSearchParams({view, ...(channel ? {channel} : {}), ...(query ? {search: query} : {}), ...extra});
    return values.toString();
  }, [view, channel, query]);

  const load = useCallback(() => Promise.all([
    communicationsGet<ConversationListView>(`/api/inbox/conversations?${params()}`, "Conversations could not be loaded."),
    communicationsGet<InboxCountsView>("/api/inbox/counts", "Counts could not be loaded."),
  ]).then(([list, totals]) => { setRows(list.conversations); setCursor(list.nextCursor); setCounts(totals); setError(null); },
    problem => setError(errorMessage(problem, "The inbox could not be loaded."))), [params]);

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

  const showList = !conversationId;
  return <div className="grid min-h-[70vh] min-w-0 gap-4 lg:grid-cols-[11rem_18rem_minmax(0,1fr)]">
    {/* Views and channels */}
    <nav aria-label="Inbox views" className={cn("space-y-4", !showList && "hidden lg:block")}>
      <ul className="space-y-0.5">{INBOX_VIEWS.map(item => {
        const count = item === "ALL" ? null : counts?.[item as Exclude<InboxView, "ALL">];
        return <li key={item}><button type="button" onClick={() => setView(item)} aria-current={view === item ? "true" : undefined}
          className={cn("flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted", view === item && "bg-muted font-medium")}>
          <span>{VIEW_LABELS[item]}</span>{count ? <Badge variant={item === "UNREAD" ? "default" : "secondary"} className="tabular-nums">{count}</Badge> : null}
        </button></li>;
      })}</ul>
      <div className="space-y-1.5"><p className="px-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Channels</p>
        <ul className="space-y-0.5">
          <li><button type="button" onClick={() => setChannel("")} aria-current={channel === "" ? "true" : undefined} className={cn("w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted", channel === "" && "bg-muted font-medium")}>All channels</button></li>
          {INBOX_CHANNELS.filter(item => item !== "INTERNAL").map(item => { const Icon = CHANNEL_ICONS[item]; return <li key={item}>
            <button type="button" onClick={() => setChannel(item)} aria-current={channel === item ? "true" : undefined} className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted", channel === item && "bg-muted font-medium")}>
              <Icon aria-hidden className="size-4 text-muted-foreground" />{CHANNEL_LABELS[item]}</button></li>; })}
        </ul></div>
    </nav>

    {/* Conversation list */}
    <section aria-label="Conversations" className={cn("flex min-w-0 flex-col rounded-xl border", !showList && "hidden lg:flex")}>
      <div className="flex items-center gap-2 border-b p-2">
        <div className="relative flex-1"><Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="inbox-search" className="sr-only">Search conversations</label>
          <Input id="inbox-search" value={search} onChange={event => onSearch(event.target.value)} placeholder="Search name, number, email or text" className="pl-8" maxLength={100} /></div>
        <Button size="icon" variant="ghost" aria-label="Refresh" onClick={() => setRefreshKey(key => key + 1)}><RefreshCw aria-hidden /></Button>
      </div>
      {error && <p role="alert" className="border-b p-3 text-sm text-destructive">{error}</p>}
      {!rows ? <p role="status" className="p-4 text-sm text-muted-foreground">Loading conversations…</p>
        : !rows.length ? <div className="p-6 text-center text-sm text-muted-foreground"><p className="font-medium text-foreground">No conversations here</p>
            <p className="mt-1">Messages appear when customers write through a connected channel or a website form.</p></div>
        : <ul className="divide-y overflow-y-auto" data-testid="conversation-list">{rows.map(row => {
          const Icon = CHANNEL_ICONS[row.channel as InboxChannel];
          const selected = conversationId === row.id;
          return <li key={row.id}><Link href={`/inbox/${row.id}`} aria-current={selected ? "page" : undefined}
            className={cn("block space-y-1 px-3 py-2.5 hover:bg-muted/60", selected && "bg-muted")}>
            <div className="flex items-center gap-2">
              <Icon aria-label={CHANNEL_LABELS[row.channel as InboxChannel]} className="size-4 shrink-0 text-muted-foreground" />
              <span className={cn("min-w-0 flex-1 truncate text-sm", row.unreadCount > 0 && "font-semibold")}>{row.contact?.fullName ?? row.customerName ?? row.customerIdentity}</span>
              {row.unreadCount > 0 && <Badge className="tabular-nums" aria-label={`${row.unreadCount} unread`}>{row.unreadCount}</Badge>}
            </div>
            <p className="truncate text-xs text-muted-foreground" dir="auto">{row.subject ? `${row.subject} · ` : ""}{row.lastMessagePreview}</p>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>{formatLeadDate(row.lastMessageAt, true)}</span>
              <span>· {row.assignedMembership?.userProfile?.displayName ?? "Unassigned"}</span>
              {!row.contactId && <Badge variant="outline" className="h-4 px-1 text-[10px]">Needs matching</Badge>}
              {(row.priority === "HIGH" || row.priority === "URGENT") && <Badge variant="destructive" className="h-4 px-1 text-[10px]">{PRIORITY_LABELS[row.priority as "HIGH" | "URGENT"]}</Badge>}
              {row.simulated && <Badge variant="destructive" className="h-4 px-1 text-[10px]">SIMULATED</Badge>}
            </div>
          </Link></li>;
        })}</ul>}
      {cursor && <div className="border-t p-2"><Button variant="ghost" size="sm" className="w-full" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore && <Loader2 aria-hidden className="animate-spin" />}Load more</Button></div>}
    </section>

    {/* Open conversation */}
    <section aria-label="Conversation" className={cn("min-w-0", showList && "hidden lg:block")}>
      {conversationId ? <ConversationPane key={conversationId} conversationId={conversationId} organizationId={organizationId} refreshKey={refreshKey}
        onBack={() => router.push("/inbox")} onChanged={() => setRefreshKey(key => key + 1)} />
        : <div className="flex h-full min-h-60 items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Choose a conversation to read it.</div>}
    </section>
  </div>;
}
