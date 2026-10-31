"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Globe, LayoutTemplate, Loader2, Plus, RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STATUS_LABELS, errorMessage, websitesGet, websitesSend } from "../client";
import { DESIGN_STYLES, DESIGN_STYLE_LABELS } from "../registry";
import type { websitesOverview } from "../server/service";

type Overview = Awaited<ReturnType<typeof websitesOverview>>;

const dateTime = (iso: string) => new Intl.DateTimeFormat("en-GB", {day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai"}).format(new Date(iso));

export function StatusBadge({status, live}: {status: string; live?: boolean}) {
  return <span className="inline-flex flex-wrap items-center gap-1">
    <Badge variant={status === "PUBLISHED" ? "default" : status === "IN_REVIEW" || status === "APPROVED" ? "secondary" : "outline"}>{STATUS_LABELS[status] ?? status}</Badge>
    {live && status !== "PUBLISHED" && <Badge variant="default">Live</Badge>}
  </span>;
}

function PendingEnquiries({overview, organizationId, onChange}: {overview: Overview; organizationId: string; onChange: () => void}) {
  const [busy, setBusy] = useState<string | null>(null);
  const pending = overview.pendingEnquiries;
  if (!pending || pending.total === 0) return null;
  const act = async (id: string, action: "retry" | "dismiss") => {
    setBusy(id);
    try {
      await websitesSend(`/api/websites/pending/${id}/${action}`, organizationId, "POST", {});
      toast.success(action === "retry" ? "The enquiry was saved as a lead." : "The enquiry was dismissed.");
      onChange();
    } catch (error) { toast.error(errorMessage(error, "The enquiry could not be updated.")); } finally { setBusy(null); }
  };
  return <section className="rounded-xl border border-amber-500/40 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100" aria-labelledby="pending-title">
    <h2 id="pending-title" className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" aria-hidden="true" />{pending.total} website enquir{pending.total === 1 ? "y" : "ies"} could not be saved as leads</h2>
    <p className="mt-1 text-sm">They were kept safely. Fix the cause (usually a missing active default pipeline), then retry. Retrying never creates a duplicate lead.</p>
    <ul className="mt-3 space-y-2">{pending.items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-background/70 px-3 py-2 text-sm">
      <span><span className="font-medium">{item.name}</span> · {dateTime(item.createdAt)} · {item.attempts} attempt{item.attempts === 1 ? "" : "s"} · <code className="text-xs">{item.errorCode}</code></span>
      <span className="flex gap-2">
        <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => act(item.id, "retry")}>{busy === item.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}Retry</Button>
        <Button size="sm" variant="ghost" disabled={busy === item.id} onClick={() => act(item.id, "dismiss")}>Dismiss</Button>
      </span>
    </li>)}</ul>
  </section>;
}

function SettingsForm({overview, organizationId, onSaved}: {overview: Overview; organizationId: string; onSaved: () => void}) {
  const [name, setName] = useState(overview.website.name);
  const [allowAgentDrafts, setAllow] = useState(overview.website.allowAgentDrafts);
  const [style, setStyle] = useState(overview.website.designSettings.defaultStyle ?? "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await websitesSend("/api/websites/settings", organizationId, "PUT", {expectedRevision: overview.website.revision, name, allowAgentDrafts, defaultStyle: style || null});
      toast.success("Website settings saved.");
      onSaved();
    } catch (error) { toast.error(errorMessage(error, "The settings could not be saved.")); } finally { setSaving(false); }
  };
  return <section className="space-y-4 rounded-xl border bg-card p-5" aria-labelledby="settings-title">
    <h2 id="settings-title" className="font-semibold">Website settings</h2>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="site-name">Website name</Label><Input id="site-name" value={name} maxLength={120} onChange={event => setName(event.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="site-style">Default design style</Label>
        <select id="site-style" className="h-8 w-full rounded-lg border bg-background px-2 text-sm" value={style} onChange={event => setStyle(event.target.value)}>
          <option value="">Choose per page</option>{DESIGN_STYLES.map(item => <option key={item} value={item}>{DESIGN_STYLE_LABELS[item]}</option>)}
        </select></div>
    </div>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 size-4" checked={allowAgentDrafts} onChange={event => setAllow(event.target.checked)} />
      <span><span className="font-medium">Allow agents to create page drafts</span><span className="block text-muted-foreground">Agents can then create and edit their own drafts from inventory assigned to them. Only owners and administrators approve and publish.</span></span></label>
    <p className="text-xs text-muted-foreground">Public addresses use your company address: /site/{overview.organization.slug || "your-company"}/page-name. Custom domains are not available yet.</p>
    <Button onClick={save} disabled={saving || name.trim().length < 2}>{saving && <Loader2 className="animate-spin" aria-hidden="true" />}Save settings</Button>
  </section>;
}

export function WebsitesOverview({organizationId, view = "list"}: {organizationId: string; view?: "list" | "settings"}) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => websitesGet<Overview>("/api/websites").then(data => { setOverview(data); setError(null); }, failure => setError(errorMessage(failure, "The website builder could not be loaded."))), []);
  useEffect(() => { load(); }, [load]);

  if (error) return <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm"><p className="font-medium text-destructive">{error}</p><Button className="mt-3" size="sm" variant="outline" onClick={() => { setError(null); load(); }}>Try again</Button></div>;
  if (!overview) return <div className="space-y-3" aria-busy="true" aria-label="Loading pages">{[0, 1, 2].map(index => <div key={index} className="h-14 animate-pulse rounded-xl bg-muted" />)}</div>;

  const {permissions} = overview;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{overview.website.name} · {overview.total} page{overview.total === 1 ? "" : "s"}</p>
      <div className="flex flex-wrap gap-2">
        {permissions.isAdministrator && view === "list" && <Link href={`/websites/${overview.website.id}`} className={buttonVariants({variant: "outline", size: "sm"})}><Settings2 aria-hidden="true" />Website settings</Link>}
        {view === "settings" && <Link href="/websites" className={buttonVariants({variant: "outline", size: "sm"})}>All pages</Link>}
        {permissions.canCreate && <Link href="/websites/new" className={buttonVariants({size: "sm"})}><Plus aria-hidden="true" />New landing page</Link>}
      </div>
    </div>
    {permissions.isAdministrator && <PendingEnquiries overview={overview} organizationId={organizationId} onChange={load} />}
    {view === "settings" && permissions.isAdministrator && <SettingsForm key={overview.website.revision} overview={overview} organizationId={organizationId} onSaved={load} />}
    {!permissions.canCreate && <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">Ask an owner or administrator to allow agent drafts to create landing pages.</p>}
    {overview.pages.length === 0
      ? <EmptyState icon={LayoutTemplate} title="No landing pages yet" description="Create a page from a template, from a blank layout or by describing it to Claude.">{permissions.canCreate && <Link href="/websites/new" className={buttonVariants({size: "sm"})}><Plus aria-hidden="true" />New landing page</Link>}</EmptyState>
      : <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[44rem] text-left text-sm">
        <caption className="sr-only">Landing pages</caption>
        <thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th scope="col" className="px-4 py-3 font-medium">Page</th><th scope="col" className="px-4 py-3 font-medium">Status</th><th scope="col" className="px-4 py-3 font-medium">Style</th><th scope="col" className="px-4 py-3 font-medium">Updated</th><th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{overview.pages.map(page => <tr key={page.id} className="border-t">
          <td className="px-4 py-3"><Link href={`/websites/${overview.website.id}/pages/${page.id}/edit`} className="font-medium hover:underline">{page.title}</Link><span className="block text-xs text-muted-foreground">/{page.slug} · by {page.createdBy}{page.linked ? "" : " · not linked to a CRM record"}</span></td>
          <td className="px-4 py-3"><StatusBadge status={page.status} live={page.live} /></td>
          <td className="px-4 py-3 text-muted-foreground">{DESIGN_STYLE_LABELS[page.designStyle as keyof typeof DESIGN_STYLE_LABELS] ?? page.designStyle}</td>
          <td className="px-4 py-3 text-muted-foreground">{dateTime(page.updatedAt)}</td>
          <td className="px-4 py-3 text-right"><span className="inline-flex gap-2">
            {page.publicPath && <a href={page.publicPath} target="_blank" rel="noreferrer" className={buttonVariants({variant: "ghost", size: "sm"})}><Globe aria-hidden="true" />View live<ExternalLink className="size-3" aria-hidden="true" /></a>}
            <Link href={`/websites/${overview.website.id}/pages/${page.id}/edit`} className={buttonVariants({variant: "outline", size: "sm"})}>Open editor</Link>
          </span></td>
        </tr>)}</tbody>
      </table></div>}
  </div>;
}
