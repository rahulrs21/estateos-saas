"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Bell, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leadRequest } from "@/modules/leads/client";
import type { InAppNotification } from "../types";

export function NotificationBell({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/lead-distribution/notifications?limit=10", { credentials: "same-origin", cache: "no-store" });
      const result = await response.json() as {data?: {notifications?: InAppNotification[]}; error?: {message?: string}};
      if (!response.ok || !result.data) throw new Error(result.error?.message || "Notifications could not be loaded.");
      setItems(result.data.notifications ?? []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Notifications could not be loaded."); }
    finally { setLoading(false); }
  }, []);

  async function markRead(notification: InAppNotification) {
    if (notification.readAt) return;
    try {
      await leadRequest(`/api/lead-distribution/notifications/${notification.id}/read`, "POST", {}, organizationId);
      setItems(current => current.map(item => item.id === notification.id ? {...item, readAt: new Date().toISOString()} : item));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Notification could not be updated."); }
  }

  const unread = items.filter(item => !item.readAt).length;
  return <div className="relative">
    <Button type="button" variant="ghost" size="icon" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} aria-controls="workspace-notifications" onClick={() => { setOpen(value => !value); if (!open) void load(); }}>
      <Bell aria-hidden="true" />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-primary px-1 text-[9px] font-semibold leading-4 text-primary-foreground">{unread > 9 ? "9+" : unread}</span>}
    </Button>
    {open && <section id="workspace-notifications" aria-label="Notifications" className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl">
      <div className="flex items-center justify-between border-b pb-2"><h2 className="text-sm font-semibold">Notifications</h2><Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => void load()}>{loading ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : "Refresh"}</Button></div>
      {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
      {loading && items.length === 0 ? <p role="status" className="py-5 text-center text-sm text-muted-foreground">Loading notifications…</p> : items.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">You’re all caught up.</p> : <ul className="max-h-80 divide-y overflow-y-auto">{items.map(item => {
        const content = <span className="block min-w-0"><span className="flex items-center gap-2 text-sm font-medium"><span className={`size-1.5 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-primary"}`} aria-hidden="true" />{item.title}</span><span className="mt-1 block truncate pl-3.5 text-xs text-muted-foreground">{item.body}</span><time className="mt-1 block pl-3.5 text-[10px] text-muted-foreground" dateTime={item.createdAt}>{new Intl.DateTimeFormat(undefined, {dateStyle: "short", timeStyle: "short"}).format(new Date(item.createdAt))}</time></span>;
        return <li key={item.id} className="py-1">{item.lead ? <Link href={`/leads/${item.lead.id}`} onClick={() => void markRead(item)} className="block rounded-lg p-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{content}</Link> : <button type="button" onClick={() => void markRead(item)} className="w-full rounded-lg p-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{content}</button>}</li>;
      })}</ul>}
    </section>}
  </div>;
}
