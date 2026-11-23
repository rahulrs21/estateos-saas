import { CheckCircle2, Circle, Megaphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeadAdEnquiry } from "../types";
import { formatLeadDate } from "./lead-ui";

const PLATFORM = { facebook: "Facebook", instagram: "Instagram" } as const;
const humanize = (key: string) => { const text = key.replace(/[_?]+/g, " ").trim(); return text ? text[0].toUpperCase() + text.slice(1) : key; };

/**
 * The Meta lead ad form that created a lead (Phase 7D.4): every question and answer as Meta sent them, where the
 * lead came from (Facebook or Instagram, Page, form) and Meta's IDs for the ad. Unlike the Website enquiry card,
 * these are the answers as received: team edits to the lead do not change them.
 */
export function LeadAdEnquiryCard({ enquiry }: { enquiry: LeadAdEnquiry }) {
  const platform = enquiry.platform ? PLATFORM[enquiry.platform] : "Meta";
  const ids: Array<[string, string | null]> = [
    ["Campaign ID", enquiry.ids.campaignId], ["Ad set ID", enquiry.ids.adsetId], ["Ad ID", enquiry.ids.adId],
    ["Form ID", enquiry.ids.formId], ["Meta lead ID", enquiry.ids.leadgenId],
  ];
  const shownIds = ids.filter((entry): entry is [string, string] => Boolean(entry[1]));
  return <Card id="enquiry" className="scroll-mt-24 gap-4 py-4 shadow-xs ring-border" data-testid="lead-ad-enquiry">
    <CardHeader className="px-5 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <Megaphone className="size-4 text-muted-foreground" aria-hidden="true" />
        <CardTitle role="heading" aria-level={2}>Lead ad enquiry</CardTitle>
        <span className="inline-flex items-center rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium" data-testid="lead-ad-platform">{platform}</span>
        {enquiry.isOrganic && <span className="inline-flex items-center rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground" title="Submitted from the form without an ad">Organic</span>}
      </div>
      <CardDescription>
        What the person sent in {enquiry.formName ? <>the form <span className="font-medium text-foreground">{enquiry.formName}</span></> : "a lead form"}
        {enquiry.pageName ? <> on {enquiry.pageName}</> : null}, received {formatLeadDate(enquiry.receivedAt, true)}.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-5 px-5 sm:px-6">
      {enquiry.answers.length === 0 ? <p className="text-sm text-muted-foreground">Meta sent no answers with this lead.</p>
        : <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2" data-testid="lead-ad-answers">
          {enquiry.answers.map(answer => <div key={answer.key} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{answer.label}</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">{answer.value}</dd>
          </div>)}
        </dl>}
      {enquiry.consent.length > 0 && <div>
        <h3 className="text-xs text-muted-foreground">Consent on the form</h3>
        <ul className="mt-1.5 space-y-1">{enquiry.consent.map(item => <li key={item.key} className="flex items-center gap-2 text-sm">
          {item.checked ? <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> : <Circle className="size-3.5 text-muted-foreground" aria-hidden="true" />}
          {humanize(item.key)}<span className="sr-only">{item.checked ? " (ticked)" : " (not ticked)"}</span>
        </li>)}</ul>
      </div>}
      {shownIds.length > 0 && <details className="group rounded-lg border bg-muted/30 px-3 py-2 text-xs">
        <summary className="cursor-pointer select-none font-medium text-muted-foreground">Ad details from Meta</summary>
        <dl className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {shownIds.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="font-mono">{value}</dd></div>)}
          {enquiry.metaCreatedAt && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Submitted at Meta</dt><dd>{formatLeadDate(enquiry.metaCreatedAt, true)}</dd></div>}
        </dl>
      </details>}
      <p className="text-[11px] leading-4 text-muted-foreground">The answers as Meta sent them. Editing the lead does not change them.</p>
    </CardContent>
  </Card>;
}
