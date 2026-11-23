"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, FileText, Link2, LoaderCircle, MoreHorizontal, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { leadRequest } from "@/modules/leads/client";
import { formatLeadDate } from "@/modules/leads/components/lead-ui";
import type { MetaLeadPagesView } from "../server/connect";

type Page = MetaLeadPagesView["pages"][number];

const FAILURE_LABELS: Record<string, string> = {
  STATE_INVALID: "The Facebook sign-in expired or could not be confirmed.",
  DENIED: "Facebook sign-in was cancelled.",
  NO_PAGES: "No Facebook Page was shared in Facebook's window.",
  ALL_TAKEN: "The Pages you shared are already connected to another EstateOS company.",
  NOT_ALLOWED: "Only company owners and administrators can connect Pages.",
  NOT_CONFIGURED: "Connecting Facebook is not set up on this server yet.",
};

function FacebookMark({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className}><path fill="currentColor" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" /></svg>;
}

function StatusPill({ page }: { page: Page }) {
  const ok = page.status === "ACTIVE";
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium", ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300")}>
    <span className={cn("size-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-amber-500")} aria-hidden="true" />{ok ? "Receiving leads" : "Needs reconnect"}
  </span>;
}

/** Settings → Meta Lead Ads: connect Facebook Pages, see their forms and import recent leads (OWNER or ADMIN). */
export function MetaLeadAdsSettings({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<MetaLeadPagesView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Page | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/lead-ads/meta/pages", { credentials: "same-origin", cache: "no-store" });
      const result = await response.json() as { data?: MetaLeadPagesView; error?: { message?: string } };
      if (!response.ok || !result.data) throw new Error(result.error?.message || "Connected Pages could not be loaded.");
      setData(result.data);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Connected Pages could not be loaded."); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the first load of a client-fetched view
  useEffect(() => { void load(); }, [load]);

  const outcome = params.get("meta");
  const reason = params.get("reason") ?? "";

  async function connect() {
    setBusy("connect");
    try {
      const result = await leadRequest<{ authorizationUrl: string }>("/api/lead-ads/meta/connect", "POST", {}, organizationId);
      window.location.assign(result.authorizationUrl);
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "Facebook sign-in could not start."); setBusy(null); }
  }
  async function importLeads(page: Page) {
    setBusy(`import:${page.id}`);
    try {
      const result = await leadRequest<{ forms: number; found: number; imported: number; known: number; failed: number; needsReconnect: boolean }>(`/api/lead-ads/meta/pages/${page.id}/import`, "POST", {}, organizationId);
      if (result.needsReconnect) toast.error(`Meta refused ${page.pageName}'s access. Reconnect the Page.`);
      else toast.success(result.imported ? `${result.imported} new ${result.imported === 1 ? "lead" : "leads"} imported from ${page.pageName}.` : `No new leads in the last 7 days (${result.forms} ${result.forms === 1 ? "form" : "forms"} checked).`);
      await load(); router.refresh();
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "Leads could not be imported."); }
    finally { setBusy(null); }
  }
  async function disconnect(page: Page) {
    setBusy(`disconnect:${page.id}`);
    try {
      await leadRequest(`/api/lead-ads/meta/pages/${page.id}/disconnect`, "POST", {}, organizationId);
      toast.success(`${page.pageName} disconnected. Its leads stay in EstateOS.`);
      setConfirm(null); await load();
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "The Page could not be disconnected."); }
    finally { setBusy(null); }
  }

  const connectButton = (label = "Connect Facebook") => <Button onClick={() => void connect()} disabled={busy !== null || data?.setup.enabled === false} data-testid="meta-connect" className="bg-[#1877F2] text-white hover:bg-[#166FE5]">
    {busy === "connect" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FacebookMark className="size-4" />}{label}
  </Button>;

  return <div className="space-y-4">
    {outcome === "connected" && <p role="status" className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200"><CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Facebook connected. New leads from your Pages&apos; lead forms now come into EstateOS.</p>}
    {outcome === "failed" && <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{FAILURE_LABELS[reason] ?? `Facebook was not connected (${reason || "unknown reason"}). Please try again.`}</p>}
    {data && !data.setup.enabled && <div role="note" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
      Connecting Facebook is not set up on this server yet. For the EstateOS administrator, missing: <code className="text-xs">{data.setup.missing.join(", ")}</code>.
    </div>}

    <section className="overflow-hidden rounded-lg border bg-card" aria-labelledby="meta-pages-title">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div><h2 id="meta-pages-title" className="text-sm font-semibold">Connected Facebook Pages</h2>
          <p className="text-xs text-muted-foreground">Leads from these Pages&apos; instant forms (Facebook and Instagram ads) become leads here, assigned by your distribution rules.</p></div>
        {data && data.pages.length > 0 && connectButton("Connect another Page")}
      </header>

      {error ? <div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-sm"><p role="alert" className="text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw aria-hidden="true" />Try again</Button></div>
        : !data ? <div role="status" className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Loading connected Pages…</div>
        : data.pages.length === 0 ? <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[#1877F2]/10 text-[#1877F2]"><FacebookMark className="size-6" /></span>
          <div><h3 className="font-semibold">No Facebook Page connected yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Sign in with Facebook and choose the Pages whose lead ads you run. You need to be an admin of the Page (or have the Advertise task).</p></div>
          {connectButton()}
          <ol className="mt-2 grid max-w-lg gap-2 text-left text-xs text-muted-foreground sm:grid-cols-3">
            {["Sign in with Facebook", "Choose your Pages in Facebook's window", "New leads arrive here automatically"].map((step, index) => <li key={step} className="flex gap-2 rounded-lg border bg-background p-2.5"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">{index + 1}</span>{step}</li>)}
          </ol>
        </div>
        : <ul className="divide-y">{data.pages.map(page => <li key={page.id} className="space-y-3 px-4 py-3" data-testid="meta-page">
          <div className="flex flex-wrap items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1877F2]/10 text-[#1877F2]"><FacebookMark className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-medium">{page.pageName}</p><StatusPill page={page} /></div>
              <p className="mt-0.5 text-xs text-muted-foreground">Page ID {page.pageId} · Last lead {page.lastLeadAt ? formatLeadDate(page.lastLeadAt, true) : "none yet"} · Checked {page.lastCheckedAt ? formatLeadDate(page.lastCheckedAt, true) : "not yet"}{page.connectedBy ? ` · Connected by ${page.connectedBy}` : ""}</p>
              {page.status !== "ACTIVE" && <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">Meta refused this Page&apos;s access{page.lastErrorCode ? ` (${page.lastErrorCode})` : ""}. Reconnect it to keep receiving leads; leads waiting are imported once it works again.</p>}
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void importLeads(page)} data-testid="meta-import">
                {busy === `import:${page.id}` ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}Import recent leads
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger disabled={busy !== null} render={<Button variant="ghost" size="icon-sm" aria-label={`More for ${page.pageName}`} data-testid="meta-page-actions" />}><MoreHorizontal aria-hidden="true" /></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => void connect()}><Link2 aria-hidden="true" />Reconnect</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirm(page)}><Unplug aria-hidden="true" />Disconnect</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="pl-12">
            {page.forms.length === 0 ? <p className="text-xs text-muted-foreground">No lead forms found yet. Forms appear here after their first lead, or when you import.</p>
              : <ul className="flex flex-wrap gap-1.5" aria-label={`Lead forms of ${page.pageName}`}>{page.forms.map(form => <li key={form.id} className={cn("inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs", !form.enabled && "opacity-60")}>
                <FileText className="size-3 text-muted-foreground" aria-hidden="true" />{form.name}<span className="text-muted-foreground">· {form.enabled ? (form.lastLeadAt ? `last lead ${formatLeadDate(form.lastLeadAt)}` : "no leads yet") : "off"}</span>
              </li>)}</ul>}
          </div>
        </li>)}</ul>}
    </section>

    {data && data.failures.length > 0 && <section className="overflow-hidden rounded-lg border bg-card" aria-labelledby="meta-failures-title">
      <header className="border-b px-4 py-3"><h2 id="meta-failures-title" className="text-sm font-semibold">Leads that could not be imported</h2>
        <p className="text-xs text-muted-foreground">EstateOS retries automatically for about an hour. Retrying by hand comes in the next update.</p></header>
      <table className="w-full text-left text-xs"><thead className="border-b bg-muted/30 text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Meta lead ID</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Reason</th><th className="px-4 py-2 font-medium">Received</th></tr></thead>
        <tbody className="divide-y">{data.failures.map(row => <tr key={row.id}><td className="px-4 py-2 font-mono">{row.leadgenId}</td><td className="px-4 py-2">{row.status === "DEAD" ? "Gave up" : `Retrying (${row.attempts})`}</td><td className="px-4 py-2 text-muted-foreground">{row.errorCode ?? "—"}</td><td className="px-4 py-2 text-muted-foreground">{formatLeadDate(row.receivedAt, true)}</td></tr>)}</tbody></table>
    </section>}

    <p className="text-[11px] leading-5 text-muted-foreground">EstateOS also checks each Page&apos;s forms every 15 minutes, so leads arrive even if a notification from Meta is missed. Disconnecting stops new leads; leads already in EstateOS stay.</p>

    <Dialog open={confirm !== null} onOpenChange={open => { if (!open && !busy) setConfirm(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Disconnect {confirm?.pageName}?</DialogTitle>
          <DialogDescription>New leads from this Page stop coming into EstateOS, and its form settings are removed. Leads already imported stay, with their answers.</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={() => setConfirm(null)} disabled={busy !== null}>Cancel</Button>
          <Button variant="destructive" onClick={() => confirm && void disconnect(confirm)} disabled={busy !== null} data-testid="meta-disconnect-confirm">{busy?.startsWith("disconnect:") ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Unplug aria-hidden="true" />}Disconnect</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
