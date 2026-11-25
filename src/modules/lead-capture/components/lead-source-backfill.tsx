"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { History, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { leadRequest } from "@/modules/leads/client";
import type { BackfillPreview } from "../source-report";

/**
 * Phase 7E.5: fill the sources of leads created before sources were recorded (docs/LEAD_ATTRIBUTION_PLAN.md).
 * Owners and administrators see what the fill would do before they confirm it; it only adds missing sources.
 */
export function LeadSourceBackfill({ preview, organizationId }: { preview: BackfillPreview; organizationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function fill() {
    setPending(true); setError("");
    try {
      const result = await leadRequest<{ filled: number }>("/api/lead-capture/reports/sources/backfill", "POST", {}, organizationId);
      toast.success(result.filled === 1 ? "The source of 1 lead was filled." : `The sources of ${result.filled.toLocaleString("en-GB")} leads were filled.`);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The sources could not be filled. Please try again.");
    } finally { setPending(false); }
  }

  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm" data-testid="lead-source-backfill">
    <p className="text-muted-foreground"><span className="font-medium text-foreground tabular-nums">{preview.total.toLocaleString("en-GB")}</span> {preview.total === 1 ? "lead has" : "leads have"} no recorded source, because {preview.total === 1 ? "it was" : "they were"} created before sources were tracked.</p>
    <Dialog open={open} onOpenChange={next => { if (!pending) { setOpen(next); setError(""); } }}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}><History aria-hidden="true" />Fill from their history</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fill lead sources</DialogTitle>
          <DialogDescription>Each lead gets the source recorded when it was created: its website form or landing page (with its UTM tags), its Meta lead ad, or the WhatsApp or email conversation it came from. Leads with none of these were added by hand. Sources that already exist are never changed.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-lg border text-sm" aria-label="What will be filled">
          {preview.channels.map(row => <li key={row.channel} className="flex justify-between gap-3 px-3 py-2"><span>{row.label}</span><span className="tabular-nums text-muted-foreground">{row.leads.toLocaleString("en-GB")}</span></li>)}
          <li className="flex justify-between gap-3 px-3 py-2 font-medium"><span>Total</span><span className="tabular-nums">{preview.total.toLocaleString("en-GB")}</span></li>
        </ul>
        <p className="text-xs text-muted-foreground">This covers every lead of the company without a source, not only this report&apos;s period. Campaign names Meta did not send at the time are shown by campaign ID.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending} onClick={() => void fill()} data-testid="lead-source-backfill-confirm">{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <History aria-hidden="true" />}{pending ? "Filling…" : `Fill ${preview.total.toLocaleString("en-GB")} ${preview.total === 1 ? "lead" : "leads"}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
