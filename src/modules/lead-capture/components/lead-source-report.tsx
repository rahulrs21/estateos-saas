import Link from "next/link";
import { Download, Radio, Target } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { costPerLeadLabel, rate, spendLabel, type BackfillPreview, type SourceReport, type SourceReportRow } from "../source-report";
import { LeadSourceBackfill } from "./lead-source-backfill";

/*
 * Phase 7E.4: "Where leads come from" (docs/LEAD_ATTRIBUTION_PLAN.md#3-where-it-shows). Leads, qualified and won by
 * channel and by campaign for the report's period and filters. Names come from URLs and ad platforms: text only.
 */

type Filters = { from: string; to: string; timeZone: string; bucket: string; sourceId: string; pipelineStageId: string; assignedMembershipId: string };

function Numbers({ row }: { row: SourceReportRow }) {
  return <>
    <td className="px-3 py-2 text-right tabular-nums">{row.leads.toLocaleString("en-GB")}</td>
    <td className="px-3 py-2 text-right tabular-nums">{row.qualified.toLocaleString("en-GB")}<span className="ml-1.5 text-[11px] text-muted-foreground">{rate(row.qualified, row.leads)}%</span></td>
    <td className="px-3 py-2 text-right tabular-nums">{row.won.toLocaleString("en-GB")}<span className="ml-1.5 text-[11px] text-muted-foreground">{rate(row.won, row.leads)}%</span></td>
  </>;
}

const headers = <>
  <th scope="col" className="px-3 py-2 text-right font-medium">Leads</th>
  <th scope="col" className="px-3 py-2 text-right font-medium">Qualified</th>
  <th scope="col" className="px-3 py-2 text-right font-medium">Won</th>
</>;

export function LeadSourceReport({ report, filters, backfill, organizationId }: { report: SourceReport; filters: Filters; backfill?: BackfillPreview | null; organizationId?: string }) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value) as [string, string][]);
  const leadsHref = (extra: Record<string, string>) => `/leads?${new URLSearchParams({ range: "CUSTOM", createdFrom: filters.from, createdTo: filters.to, ...extra })}`;
  const max = Math.max(1, ...report.channels.map(row => row.leads));
  return <Card data-testid="lead-source-report"><CardContent className="space-y-6 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-semibold">Where leads come from</h2>
        <p className="mt-1 text-xs text-muted-foreground">Leads created in this period by the channel and campaign that brought them, and how many are qualified or won so far.</p></div>
      <a href={`/api/lead-capture/reports/sources?${query}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))} download data-testid="lead-source-csv"><Download aria-hidden="true" />Download CSV</a>
    </div>

    {backfill && backfill.total > 0 && organizationId && <LeadSourceBackfill preview={backfill} organizationId={organizationId} />}

    <section aria-labelledby="source-channels-heading" className="space-y-2">
      <h3 id="source-channels-heading" className="flex items-center gap-2 text-sm font-medium"><Radio className="size-4 text-primary" aria-hidden="true" />By channel</h3>
      {report.channels.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No leads were created in this period.</p>
        : <div className="overflow-x-auto"><table className="w-full min-w-[32rem] text-sm"><caption className="sr-only">Leads by channel</caption>
          <thead className="border-b text-xs text-muted-foreground"><tr><th scope="col" className="px-3 py-2 text-left font-medium">Channel</th>{headers}</tr></thead>
          <tbody className="divide-y">{report.channels.map(row => <tr key={row.channel} data-testid="source-channel-row">
            <th scope="row" className="px-3 py-2 text-left font-normal">
              {row.channel === "UNRECORDED" ? <span className="text-muted-foreground" title="Leads created before sources were recorded">{row.label}</span>
                : <Link href={leadsHref({ channel: row.channel })} className="hover:underline">{row.label}</Link>}
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (row.leads / max) * 100)}%` }} /></div>
            </th>
            <Numbers row={row} />
          </tr>)}</tbody>
          <tfoot className="border-t font-medium"><tr><th scope="row" className="px-3 py-2 text-left">Total</th><Numbers row={report.total} /></tr></tfoot>
        </table></div>}
    </section>

    <section aria-labelledby="source-campaigns-heading" className="space-y-2">
      <h3 id="source-campaigns-heading" className="flex items-center gap-2 text-sm font-medium"><Target className="size-4 text-primary" aria-hidden="true" />Top campaigns</h3>
      {report.campaigns.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No leads in this period came from a named campaign. Campaigns come from UTM tags, Meta lead ads, WhatsApp ads, or the Campaign field on leads added by hand.</p>
        : <div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-sm"><caption className="sr-only">Top campaigns</caption>
          <thead className="border-b text-xs text-muted-foreground"><tr><th scope="col" className="px-3 py-2 text-left font-medium">Campaign</th><th scope="col" className="px-3 py-2 text-left font-medium">Channel</th>{headers}{report.spendShown && <><th scope="col" className="px-3 py-2 text-right font-medium">Spend</th><th scope="col" className="px-3 py-2 text-right font-medium">Cost per lead</th></>}</tr></thead>
          <tbody className="divide-y">{report.campaigns.map(row => <tr key={row.key} data-testid="source-campaign-row">
            <th scope="row" className="max-w-72 px-3 py-2 text-left font-normal"><Link href={leadsHref({ campaign: row.key })} className="block truncate hover:underline" title={row.label}>{row.label}</Link></th>
            <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{row.channelLabel || "—"}</td>
            <Numbers row={row} />
            {report.spendShown && <><td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{spendLabel(row.spend) || "—"}</td><td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{costPerLeadLabel(row) || "—"}</td></>}
          </tr>)}</tbody>
        </table></div>}
      {report.spendShown && <p className="text-[11px] text-muted-foreground">Spend comes from <Link href="/workspace/marketing" className="underline">Campaigns</Link>: the share of each entry inside these dates, never converted between currencies.</p>}
    </section>
    <p className="text-xs leading-5 text-muted-foreground">Qualified counts leads now at Qualified or a later stage (viewings, negotiation) or won; won includes Won and Converted. Percentages are of the row&apos;s leads. Not recorded: leads created before sources were tracked.</p>
  </CardContent></Card>;
}
