"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CircleAlert, Link2, LoaderCircle, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { leadRequest } from "@/modules/leads/client";
import { formatLeadDate } from "@/modules/leads/components/lead-ui";
import type { MetaAdAccountsView } from "../server/meta-ads";

/*
 * Phase 7F.2: Meta ad accounts (docs/CAMPAIGNS_PLAN.md). Owners and administrators connect ad accounts with Facebook's
 * sign-in (read-only, ads_read), sync them now, or disconnect them. Spend is read every 6 hours.
 */

const NOTICES: Record<string, string> = {
  STATE_INVALID: "The Facebook sign-in expired or could not be confirmed. Please connect again.",
  DENIED: "Facebook sign-in was cancelled, so no ad account was connected.",
  NO_ACCOUNTS: "No ad account was shared. Connect again and choose your ad accounts in Facebook's window.",
  ALL_TAKEN: "Every ad account you shared is already connected to another EstateOS company.",
  NOT_ALLOWED: "Only owners and administrators can connect ad accounts.",
};

export function AdAccounts({ data, organizationId, notice }: { data: MetaAdAccountsView; organizationId: string; notice: { kind: "connected" | "failed" | null; reason: string | null } }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function connect() {
    setBusy("connect");
    try {
      const result = await leadRequest<{ authorizationUrl: string }>("/api/campaigns/meta/connect", "POST", {}, organizationId);
      window.location.assign(result.authorizationUrl);
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "Facebook sign-in could not be started."); setBusy(null); }
  }
  async function sync(id: string) {
    setBusy(`sync:${id}`);
    try {
      const result = await leadRequest<{ status: string; campaigns: number; days: number; errorCode?: string }>(`/api/campaigns/meta/accounts/${id}/sync`, "POST", {}, organizationId);
      if (result.status === "SYNCED") toast.success(`Synced: ${result.campaigns} ${result.campaigns === 1 ? "campaign" : "campaigns"}, ${result.days} days of spend.`);
      else toast.error(result.status === "NEEDS_RECONNECT" ? "Meta no longer accepts this connection. Connect the ad account again." : `Meta did not answer (${result.errorCode ?? "error"}). It will try again within the hour.`);
      router.refresh();
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "The sync could not start."); }
    finally { setBusy(null); }
  }

  const failed = notice.kind === "failed" ? NOTICES[notice.reason ?? ""] ?? `The ad accounts were not connected (${notice.reason ?? "error"}). Please try again.` : null;
  return <div className="space-y-5" data-testid="ad-accounts">
    <Link href="/workspace/marketing" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" aria-hidden="true" />Back to campaigns</Link>
    <PageHeader eyebrow="Marketing" title="Ad accounts" description="Connect Meta ad accounts so each campaign's spend is read automatically. EstateOS only reads: it never creates or changes ads.">
      {data.setup.enabled && <Button onClick={() => void connect()} disabled={busy !== null}>{busy === "connect" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Link2 aria-hidden="true" />}Connect Meta ad accounts</Button>}
    </PageHeader>
    {notice.kind === "connected" && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">Ad accounts connected. Their last 90 days of spend are being read.</p>}
    {failed && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{failed}</p>}
    {!data.setup.enabled && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">Connecting ad accounts is not set up on this server yet. Missing: {data.setup.missing.join(", ")}.</p>}
    <Card><CardContent className="p-0">
      {data.accounts.length === 0 ? <EmptyState icon={Link2} title="No ad accounts connected" description="Connect a Meta ad account to read its campaigns' daily spend. Until then, spend can be added by hand on each campaign." className="min-h-56" />
        : <ul className="divide-y">{data.accounts.map(account => <li key={account.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid="ad-account">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-medium">{account.name}{account.status === "NEEDS_RECONNECT" ? <Badge variant="destructive">Connect again</Badge> : <Badge variant="secondary">Connected</Badge>}</p>
            <p className="text-xs text-muted-foreground">act_{account.adAccountId} · {account.currency}{account.timeZone ? ` · ${account.timeZone}` : ""}</p>
            <p className="text-xs text-muted-foreground">{account.lastSyncedAt ? `Last read ${formatLeadDate(account.lastSyncedAt, true)}` : "Not read yet"}{account.tokenExpiresAt ? ` · access until ${formatLeadDate(account.tokenExpiresAt)}` : ""}</p>
            {account.lastErrorCode && <p className="mt-1 flex items-center gap-1 text-xs text-destructive"><CircleAlert className="size-3.5" aria-hidden="true" />Last attempt failed ({account.lastErrorCode}).</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void sync(account.id)}>{busy === `sync:${account.id}` ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}Sync now</Button>
            <DisconnectButton organizationId={organizationId} account={account} />
          </div>
        </li>)}</ul>}
    </CardContent></Card>
    <p className="text-[11px] leading-5 text-muted-foreground">Spend is read every 6 hours for the last 3 days, which Meta still revises; the first read covers 90 days. Amounts stay in the ad account&apos;s currency. Leads from Meta lead ads and WhatsApp ads are grouped by the campaign Meta reports for their ad.{data.accounts.some(account => account.tokenExpiresAt) ? " Access from a personal sign-in lasts about 60 days; connect again before it ends." : ""}</p>
  </div>;
}

function DisconnectButton({ organizationId, account }: { organizationId: string; account: { id: string; name: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  async function disconnect() {
    setPending(true);
    try { await leadRequest(`/api/campaigns/meta/accounts/${account.id}/disconnect`, "POST", {}, organizationId); toast.success("Ad account disconnected."); setOpen(false); router.refresh(); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : "The ad account could not be disconnected."); }
    finally { setPending(false); }
  }
  return <Dialog open={open} onOpenChange={next => { if (!pending) setOpen(next); }}>
    <DialogTrigger render={<Button variant="ghost" size="sm" />}><Unplug aria-hidden="true" />Disconnect</DialogTrigger>
    <DialogContent className="sm:max-w-sm">
      <DialogHeader><DialogTitle>Disconnect {account.name}?</DialogTitle><DialogDescription>Its access is deleted and its spend is no longer read. Spend already read stays on its campaigns.</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
        <Button variant="destructive" disabled={pending} onClick={() => void disconnect()}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}Disconnect</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
