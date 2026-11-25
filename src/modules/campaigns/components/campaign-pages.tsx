import Link from "next/link";
import { ArrowLeft, Megaphone, Target } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LEAD_CHANNEL_LABELS, type LeadChannel } from "@/modules/lead-capture/attribution";
import type { CampaignPageData, CampaignsPageData } from "../server/service";
import {
  CAMPAIGN_PLATFORMS, CAMPAIGN_PLATFORM_LABELS, CAMPAIGN_STATUSES, CAMPAIGN_STATUS_LABELS, costs, formatMoney,
  type CampaignFigures, type CampaignPlatform, type CampaignRow,
} from "../model";
import { CampaignDialog, DeleteSpendButton, SpendDialog } from "./campaign-forms";

/*
 * Phase 7F.1: the Marketing page and a campaign's page (docs/CAMPAIGNS_PLAN.md). Spend is shown per currency and
 * never converted; cost per lead appears when a campaign's spend is in one currency. Names come from URLs and ad
 * platforms: text only.
 */

const select = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";
const platformLabel = (platform: string | null) => platform && (CAMPAIGN_PLATFORMS as readonly string[]).includes(platform) ? CAMPAIGN_PLATFORM_LABELS[platform as CampaignPlatform] : platform === "direct" || !platform ? "—" : platform;
const spendText = (spend: CampaignFigures["spend"]) => spend.length ? spend.map(item => formatMoney(item.amountMinor, item.currency)).join(" + ") : "—";
const costText = (minor: number | null, currency: string | null) => minor === null || !currency ? "—" : formatMoney(minor, currency);
const campaignHref = (key: string, period: { from: string; to: string }) => `/workspace/marketing/campaigns/${encodeURIComponent(key)}?from=${period.from}&to=${period.to}`;

function PeriodForm({ period, extra }: { period: { from: string; to: string; status?: string; platform?: string }; extra?: boolean }) {
  return <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Campaign filters">
    <label className="space-y-1 text-xs font-medium">From<input className={select} type="date" name="from" defaultValue={period.from} /></label>
    <label className="space-y-1 text-xs font-medium">To<input className={select} type="date" name="to" defaultValue={period.to} /></label>
    {extra && <>
      <label className="space-y-1 text-xs font-medium">Status<select className={select} name="status" defaultValue={period.status ?? ""}><option value="">Any status</option>{CAMPAIGN_STATUSES.map(status => <option key={status} value={status}>{CAMPAIGN_STATUS_LABELS[status]}</option>)}</select></label>
      <label className="space-y-1 text-xs font-medium">Platform<select className={select} name="platform" defaultValue={period.platform ?? ""}><option value="">Any platform</option>{CAMPAIGN_PLATFORMS.map(platform => <option key={platform} value={platform}>{CAMPAIGN_PLATFORM_LABELS[platform]}</option>)}</select></label>
    </>}
    <div className="flex items-end"><Button type="submit" variant="outline" className="w-full">Apply</Button></div>
  </form>;
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="px-4 py-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate text-xl font-semibold tracking-tight tabular-nums" title={value}>{value}</p>{note && <p className="text-[11px] text-muted-foreground">{note}</p>}</div>;
}

function Figures({ figures }: { figures: CampaignFigures }) {
  const cost = costs(figures);
  return <section aria-label="Totals" className="grid grid-cols-2 divide-x divide-y overflow-hidden rounded-lg border bg-card sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
    <Tile label="Spend" value={spendText(figures.spend)} />
    <Tile label="Leads" value={figures.leads.toLocaleString("en-GB")} />
    <Tile label="Qualified" value={figures.qualified.toLocaleString("en-GB")} />
    <Tile label="Won" value={figures.won.toLocaleString("en-GB")} />
    <Tile label="Cost per lead" value={costText(cost.perLead, cost.currency)} note={figures.spend.length > 1 ? "Spend is in several currencies" : undefined} />
    <Tile label="Cost per qualified" value={costText(cost.perQualified, cost.currency)} />
  </section>;
}

export function CampaignsAccess({ message }: { message: string }) {
  return <div className="space-y-6"><PageHeader eyebrow="Marketing" title="Campaigns" description="What each campaign cost and what it brought in." />
    <Card className="py-6 ring-border"><EmptyState icon={Megaphone} title="Campaigns are not available" description={message} className="min-h-72">
      <Link href="/workspace/dashboard" className={buttonVariants({ variant: "outline" })}>Back to dashboard</Link></EmptyState></Card></div>;
}

export function CampaignsList({ data }: { data: CampaignsPageData }) {
  const { period, rows, totals } = data;
  return <div className="space-y-5">
    <PageHeader eyebrow="Marketing" title="Campaigns" description="What each campaign cost, the leads it brought, and how many were qualified or won.">
      {data.canManage && <CampaignDialog organizationId={data.organization.id} owners={data.owners} />}
    </PageHeader>
    <Card><CardContent className="p-4"><PeriodForm period={period} extra />
      <p className="mt-3 text-xs text-muted-foreground">Leads created from {period.from} through {period.to} (Dubai time), and the share of spend in those days.</p></CardContent></Card>
    <Figures figures={totals} />
    <div className="overflow-hidden rounded-lg border bg-card">
      {rows.length === 0 ? <EmptyState icon={Target} title="No campaigns yet" description="Campaigns appear here as soon as a lead arrives with a campaign (UTM tags, Meta lead ads, WhatsApp ads or the Campaign field on a lead), or when you add one." className="min-h-64" />
        : <div className="overflow-x-auto"><table className="w-full min-w-[56rem] text-sm" data-testid="campaigns-table"><caption className="sr-only">Campaigns for the chosen days</caption>
          <thead className="border-b bg-muted/30 text-xs text-muted-foreground"><tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">Campaign</th><th scope="col" className="px-3 py-2 text-left font-medium">Status</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Spend</th><th scope="col" className="px-3 py-2 text-right font-medium">Leads</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Qualified</th><th scope="col" className="px-3 py-2 text-right font-medium">Won</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Cost per lead</th><th scope="col" className="px-3 py-2 text-right font-medium">Cost per won</th>
          </tr></thead>
          <tbody className="divide-y">{rows.map(row => <CampaignListRow key={row.key} row={row} period={period} />)}</tbody>
        </table></div>}
    </div>
    <p className="text-[11px] leading-5 text-muted-foreground">Qualified counts leads now at Qualified or a later stage, or won. Spend is never converted between currencies; cost per lead is shown when a campaign&apos;s spend is in one currency. Campaigns found in leads count as active until given a status.</p>
  </div>;
}

function CampaignListRow({ row, period }: { row: CampaignRow; period: { from: string; to: string } }) {
  const cost = costs(row);
  return <tr data-testid="campaign-row">
    <th scope="row" className="max-w-80 px-3 py-2 text-left font-normal"><Link href={campaignHref(row.key, period)} className="block truncate font-medium hover:underline" title={row.name}>{row.name}</Link>
      <span className="block truncate text-[11px] text-muted-foreground">{[platformLabel(row.platform), row.channel ? LEAD_CHANNEL_LABELS[row.channel as LeadChannel] ?? row.channel : null].filter(value => value && value !== "—").join(" · ") || "—"}</span></th>
    <td className="whitespace-nowrap px-3 py-2 text-xs">{row.status ? CAMPAIGN_STATUS_LABELS[row.status] : <span className="text-muted-foreground">Found in leads</span>}</td>
    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{spendText(row.spend)}</td>
    <td className="px-3 py-2 text-right tabular-nums">{row.leads.toLocaleString("en-GB")}</td>
    <td className="px-3 py-2 text-right tabular-nums">{row.qualified.toLocaleString("en-GB")}</td>
    <td className="px-3 py-2 text-right tabular-nums">{row.won.toLocaleString("en-GB")}</td>
    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{costText(cost.perLead, cost.currency)}</td>
    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{costText(cost.perWon, cost.currency)}</td>
  </tr>;
}

export function CampaignDetail({ data }: { data: CampaignPageData }) {
  const { row, record, period } = data;
  const cost = costs(row);
  const values = record ? { ...record } : null;
  const defaultCurrency = record?.currency ?? row.spend[0]?.currency ?? "AED";
  const budget = record?.budgetMinor != null ? formatMoney(record.budgetMinor, record.currency) : null;
  const details: Array<[string, string | null]> = record ? [
    ["Status", CAMPAIGN_STATUS_LABELS[record.status]], ["Platform", platformLabel(record.platform)], ["Starts", record.startsOn], ["Ends", record.endsOn],
    ["Planned budget", budget], ["Owner", record.ownerName], ["Meta campaign ID", record.metaCampaignId], ["Google campaign ID", record.googleCampaignId], ["TikTok campaign ID", record.tiktokCampaignId],
  ] : [];
  return <div className="space-y-5" data-testid="campaign-detail">
    <Link href={`/workspace/marketing?from=${period.from}&to=${period.to}`} className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" aria-hidden="true" />Back to campaigns</Link>
    <PageHeader eyebrow="Campaign" title={row.name} description={`Grouped as “${row.key}”: leads whose campaign has this name, in any spelling.`}>
      <div className="flex flex-wrap gap-2">
        <Link href={`/leads?campaign=${encodeURIComponent(row.key)}&range=ALL`} className={buttonVariants({ variant: "outline" })}>View leads</Link>
        {data.canManage && record && values && <CampaignDialog organizationId={data.organization.id} owners={data.owners} campaign={values} trigger="Edit details" />}
      </div>
    </PageHeader>
    <Card><CardContent className="p-4"><PeriodForm period={period} /></CardContent></Card>
    <Figures figures={row} />
    {budget && row.spend.length === 1 && row.spend[0].currency === record?.currency && <p className="text-xs text-muted-foreground">Spent {spendText(row.spend)} of a planned {budget} in these days.</p>}
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <Card><CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Spend</h2>
          {data.canManage && <SpendDialog organizationId={data.organization.id} campaign={{ id: record?.id ?? null, key: row.key }} defaultCurrency={defaultCurrency} />}</div>
        {!record || record.entries.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No spend entered yet.{data.canManage ? " Add what the campaign cost, for any period; reports count the share inside the days they show." : ""}</p>
          : <div className="overflow-x-auto"><table className="w-full text-sm" data-testid="spend-table"><caption className="sr-only">Spend entries</caption>
            <thead className="border-b text-xs text-muted-foreground"><tr><th scope="col" className="px-2 py-2 text-left font-medium">Period</th><th scope="col" className="px-2 py-2 text-right font-medium">Amount</th><th scope="col" className="px-2 py-2 text-left font-medium">Entered</th><th scope="col" className="px-2 py-2"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody className="divide-y">{record.entries.map(entry => <tr key={entry.id} data-testid="spend-row">
              <td className="whitespace-nowrap px-2 py-2">{entry.spentFrom === entry.spentTo ? entry.spentFrom : `${entry.spentFrom} – ${entry.spentTo}`}{entry.note && <span className="block max-w-64 truncate text-[11px] text-muted-foreground" title={entry.note}>{entry.note}</span>}</td>
              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatMoney(entry.amountMinor, entry.currency)}</td>
              <td className="px-2 py-2 text-xs text-muted-foreground">{entry.source === "MANUAL" ? "By hand" : entry.source.charAt(0) + entry.source.slice(1).toLowerCase()}</td>
              <td className="whitespace-nowrap px-2 py-2 text-right">{data.canManage && entry.source === "MANUAL" && <div className="flex justify-end gap-1">
                <SpendDialog organizationId={data.organization.id} campaign={{ id: record.id, key: row.key }} entry={entry} defaultCurrency={entry.currency} />
                <DeleteSpendButton organizationId={data.organization.id} spendId={entry.id} /></div>}</td>
            </tr>)}</tbody></table></div>}
      </CardContent></Card>
      <div className="space-y-5">
        <Card><CardContent className="space-y-2 p-5"><h2 className="font-semibold">Details</h2>
          {record ? <dl className="divide-y text-sm">{details.filter(([, value]) => value && value !== "—").map(([label, value]) => <div key={label} className="flex justify-between gap-3 py-1.5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-right text-xs font-medium">{value}</dd></div>)}</dl>
            : <p className="text-sm text-muted-foreground">Found in leads. {data.canManage ? "Adding spend gives it a record, then you can add its details." : ""}</p>}
          {record?.notes && <p className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-2 text-xs">{record.notes}</p>}
        </CardContent></Card>
        <Card><CardContent className="space-y-2 p-5"><h2 className="font-semibold">Leads by channel</h2><p className="text-[11px] text-muted-foreground">All time</p>
          {data.channels.length === 0 ? <p className="text-sm text-muted-foreground">No leads yet.</p>
            : <ul className="divide-y text-sm">{data.channels.map(item => <li key={item.channel} className="flex justify-between py-1.5"><span>{LEAD_CHANNEL_LABELS[item.channel as LeadChannel] ?? item.channel}</span><span className="tabular-nums text-muted-foreground">{item.leads}</span></li>)}</ul>}
        </CardContent></Card>
        {cost.perWon !== null && <p className="text-xs text-muted-foreground">Cost per won lead: {costText(cost.perWon, cost.currency)}</p>}
      </div>
    </div>
  </div>;
}
