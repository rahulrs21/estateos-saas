"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarCheck2, Loader2, Sparkles, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ViewingBriefOutput } from "../analysis";
import { errorMessage, salesGet, salesSend, type LeadIntelligenceView } from "../client";

type MatchingLeads = {propertyAvailable: boolean; matches: Array<{leadId: string; name: string; status: string; reasons: string[]; listingTitle: string; link: string}>;
  totalMatches: number; coverage: {leadsReviewed: number; leadsInScope: number}; note: string | null};
type PropertyViewing = {id: string; leadId: string; leadName: string; scheduledAt: string; status: string; customerConfirmation: string};
type StoredBrief = {brief: ViewingBriefOutput; propertyReference: string};

const dubai = (iso: string) => new Intl.DateTimeFormat("en-GB", {timeZone: "Asia/Dubai", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"}).format(new Date(iso));

/**
 * Property page actions. Matching leads are found by EstateOS rules over the
 * leads this member can see (no AI allowance). Viewing summaries call Claude
 * and are stored on the lead, where the full brief and draft are shown.
 */
export function PropertySalesActions({propertyId, organizationId}: {propertyId: string; organizationId: string}) {
  const [leads, setLeads] = useState<MatchingLeads | null>(null);
  const [viewings, setViewings] = useState<PropertyViewing[] | null>(null);
  const [brief, setBrief] = useState<{leadId: string; content: StoredBrief} | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key); setError(null);
    try { await work(); } catch (cause) { setError(errorMessage(cause, "The request could not be completed.")); } finally { setBusy(null); }
  };

  return <Card id="property-sales" className="shadow-xs ring-border">
    <CardHeader><div className="flex items-center gap-2"><Sparkles className="size-4 text-primary" aria-hidden="true" /><CardTitle>Sales assistant</CardTitle></div>
      <CardDescription>Find leads whose recorded requirements match this property, and prepare for upcoming viewings. Nothing is sent to customers.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy !== null} onClick={() => void run("leads", async () => setLeads(await salesGet<MatchingLeads>(`/api/ai/sales/properties/${propertyId}/leads`)))}>{busy === "leads" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UsersRound aria-hidden="true" />}Find matching leads</Button>
        <Button variant="outline" disabled={busy !== null} onClick={() => void run("viewings", async () => setViewings(await salesGet<PropertyViewing[]>(`/api/ai/sales/properties/${propertyId}/viewings`)))}>{busy === "viewings" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CalendarCheck2 aria-hidden="true" />}Prepare viewing summary</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {leads && <section aria-label="Matching leads">
        {leads.note ? <p className="text-sm text-muted-foreground">{leads.note}</p> : leads.matches.length === 0 ? <p className="text-sm text-muted-foreground">No open lead you can see has recorded requirements that match this property and an active listing price.</p>
          : <ul className="divide-y rounded-lg border">{leads.matches.map(match => <li key={match.leadId} className="p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2"><Link href={match.link} className="font-medium text-primary hover:underline">{match.name}</Link><Badge variant="outline">{match.status.replaceAll("_", " ").toLowerCase()}</Badge></div>
            <p className="mt-1 text-xs text-muted-foreground">{match.reasons.slice(1).join("; ")}</p></li>)}</ul>}
        <p className="mt-2 text-[11px] text-muted-foreground">{leads.totalMatches} match(es) among {leads.coverage.leadsReviewed} of {leads.coverage.leadsInScope} active leads you can access. Matching uses recorded requirements only.</p>
      </section>}

      {viewings && <section aria-label="Viewings of this property">
        {viewings.length === 0 ? <p className="text-sm text-muted-foreground">No viewings of this property in the last 14 or next 60 days for leads you can access.</p>
          : <ul className="space-y-2">{viewings.map(viewing => <li key={viewing.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
            <span><Link href={`/leads/${viewing.leadId}#ai-sales`} className="font-medium text-primary hover:underline">{viewing.leadName}</Link> <span className="text-muted-foreground">· {dubai(viewing.scheduledAt)} · {viewing.status.toLowerCase()} · confirmation {viewing.customerConfirmation.toLowerCase()}</span></span>
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run(`brief:${viewing.id}`, async () => {
              const view = await salesSend<LeadIntelligenceView>(`/api/ai/sales/viewings/${viewing.id}/brief`, organizationId, "POST", {leadId: viewing.leadId}, "The viewing summary could not be prepared.");
              if (view.latestViewingBrief) setBrief({leadId: viewing.leadId, content: view.latestViewingBrief.content as StoredBrief});
            })}>{busy === `brief:${viewing.id}` ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}Prepare with Claude</Button>
          </li>)}</ul>}
      </section>}

      {brief && <section aria-label="Viewing summary" className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <p className="font-semibold">Viewing summary <Badge variant="outline" className="ml-1">AI-generated</Badge></p>
        <p className="leading-6">{brief.content.brief.summary}</p>
        {brief.content.brief.questionsToClarify.length > 0 && <><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Questions to clarify</p><ul className="list-disc space-y-1 pl-5">{brief.content.brief.questionsToClarify.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
        <Link href={`/leads/${brief.leadId}#ai-sales`} className="inline-flex text-xs font-medium text-primary hover:underline">Open the full brief and editable follow-up on the lead</Link>
      </section>}
    </CardContent>
  </Card>;
}
