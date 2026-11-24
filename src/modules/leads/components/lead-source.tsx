import { Compass, FileText, Globe, Hand, Mail, Megaphone, MessageCircle, MousePointerClick, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LEAD_CHANNEL_LABELS, LEAD_PLATFORM_LABELS, type LeadChannel } from "@/modules/lead-capture/attribution";
import type { LeadOrigin, LeadSourceRecord } from "../types";
import { formatLeadDate } from "./lead-ui";

/*
 * Phase 7E.3: where a lead came from (docs/LEAD_ATTRIBUTION_PLAN.md#3-where-it-shows). Every value was
 * recorded from a URL, a browser or Meta and is shown as text only.
 */

export const CHANNEL_ICONS: Record<LeadChannel, LucideIcon> = {
  MANUAL: Hand, WEBSITE_FORM: FileText, LANDING_PAGE: Globe, META_LEAD_AD: Megaphone, WHATSAPP_AD: Megaphone,
  WHATSAPP: MessageCircle, EMAIL: Mail, PORTAL: Compass, OTHER: MousePointerClick,
};

/** The channel, and the campaign under it, for a list row or a board card. */
export function LeadChannelTag({ origin, compact = false }: { origin?: LeadOrigin | null; compact?: boolean }) {
  if (!origin) return <span className="text-xs text-muted-foreground/70" title="No source was recorded for this lead">—</span>;
  const Icon = CHANNEL_ICONS[origin.channel] ?? MousePointerClick;
  return <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs" data-testid="lead-channel">
    <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    <span className="min-w-0">
      <span className="block truncate text-foreground/80">{LEAD_CHANNEL_LABELS[origin.channel] ?? origin.channel}</span>
      {origin.campaign && !compact && <span className="block truncate text-[11px] text-muted-foreground" title={origin.campaign}>{origin.campaign}</span>}
    </span>
  </span>;
}

function Row({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null;
  return <div className="flex min-w-0 items-baseline justify-between gap-3 py-1.5">
    <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
    <dd className={cn("min-w-0 break-words text-right text-xs font-medium", mono && "break-all font-mono text-[11px] font-normal")}>{value}</dd>
  </div>;
}

/** The Source card on the lead page: channel, platform, campaign, ad, UTM tags, landing page and click IDs. */
export function LeadSourceCard({ source }: { source: LeadSourceRecord | null | undefined }) {
  const Icon = source ? CHANNEL_ICONS[source.channel] ?? MousePointerClick : MousePointerClick;
  const landing = source?.landingHost ? `${source.landingHost}${source.landingPath && source.landingPath !== "/" ? source.landingPath : ""}` : null;
  const utm = source ? ([["Source", source.utmSource], ["Medium", source.utmMedium], ["Campaign", source.utmCampaign], ["Content", source.utmContent], ["Term", source.utmTerm]] as const)
    .filter(([, value]) => Boolean(value)) : [];
  const manualCampaign = source?.channel === "MANUAL";
  return <Card id="source" className="scroll-mt-24 gap-3 py-4 shadow-xs ring-border" data-testid="lead-source">
    <CardHeader className="px-5">
      <div className="flex items-center gap-2"><Icon className="size-4 text-muted-foreground" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>Source</CardTitle></div>
      {source ? <CardDescription>Recorded {formatLeadDate(source.capturedAt, true)}.</CardDescription>
        : <CardDescription>No source was recorded for this lead. Leads created before sources were tracked have none.</CardDescription>}
    </CardHeader>
    {source && <CardContent className="px-5">
      <dl className="divide-y">
        <Row label="Channel" value={LEAD_CHANNEL_LABELS[source.channel] ?? source.channel} />
        {source.channel !== "MANUAL" && <Row label="Platform" value={LEAD_PLATFORM_LABELS[source.platform] ?? source.platform} />}
        <Row label="Campaign" value={source.metaCampaignName ?? (manualCampaign ? source.utmCampaign : null) ?? source.campaign} />
        <Row label="Ad set" value={source.metaAdsetName} />
        <Row label="Ad" value={source.metaAdName} />
        <Row label="Landing page" value={landing} />
        <Row label="Came from" value={source.referrerHost} />
      </dl>
      {!manualCampaign && (utm.length > 0 || source.metaCampaignId || source.metaAdId || source.clickIds.length > 0) && <details className="group mt-2 rounded-md border bg-muted/20 px-3 py-1.5 text-xs">
        <summary className="cursor-pointer select-none py-1 text-muted-foreground hover:text-foreground">Tracking details</summary>
        <dl className="divide-y pb-1">
          {utm.map(([label, value]) => <Row key={label} label={`UTM ${label.toLowerCase()}`} value={value} />)}
          <Row label="Meta campaign ID" value={source.metaCampaignId} mono />
          <Row label="Meta ad set ID" value={source.metaAdsetId} mono />
          <Row label="Meta ad ID" value={source.metaAdId} mono />
          <Row label="Meta form ID" value={source.metaFormId} mono />
          {source.clickIds.map(click => <Row key={click.name} label={click.name} value={click.value} mono />)}
        </dl>
      </details>}
    </CardContent>}
  </Card>;
}
