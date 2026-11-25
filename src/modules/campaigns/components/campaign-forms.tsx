"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { leadRequest } from "@/modules/leads/client";
import { selectClassName, textareaClassName } from "@/modules/leads/components/lead-ui";
import { CAMPAIGN_PLATFORMS, CAMPAIGN_PLATFORM_LABELS, CAMPAIGN_STATUSES, CAMPAIGN_STATUS_LABELS, moneyInput } from "../model";

/*
 * Phase 7F.1: adding and changing campaigns and spend (docs/CAMPAIGNS_PLAN.md). Owners and administrators only;
 * the server and the database check the role again and validate every field.
 */

type Owner = { id: string; label: string };
export interface CampaignFormValues {
  id?: string; revision?: number; name: string; platform: string | null; status: string; startsOn: string | null; endsOn: string | null;
  budgetMinor: number | null; currency: string; ownerMembershipId: string | null; notes: string | null;
  metaCampaignId: string | null; googleCampaignId: string | null; tiktokCampaignId: string | null;
}
export interface SpendFormValues { id?: string; spentFrom: string; spentTo: string; amountMinor: number; currency: string; note: string | null }

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return <div className="space-y-1.5"><label htmlFor={id} className="text-xs font-medium">{label}</label>{children}{hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}</div>;
}

function useSubmit(onDone: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<void>) {
    setPending(true); setError("");
    try { await action(); onDone(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "This could not be saved. Please try again."); }
    finally { setPending(false); }
  }
  return { pending, error, setError, run };
}

/** Add a campaign, or change one's details. A new campaign is grouped with leads that carry the same name. */
export function CampaignDialog({ organizationId, owners, campaign, trigger }: { organizationId: string; owners: Owner[]; campaign?: CampaignFormValues; trigger?: ReactNode }) {
  const router = useRouter();
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const { pending, error, setError, run } = useSubmit(() => setOpen(false));
  const id = (name: string) => `${prefix}-${name}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const body = {
      name: value("name"), platform: value("platform") || null, status: value("status") || "ACTIVE", startsOn: value("startsOn"), endsOn: value("endsOn"),
      budget: value("budget"), currency: value("currency") || "AED", ownerMembershipId: value("ownerMembershipId"), notes: value("notes"),
      metaCampaignId: value("metaCampaignId"), googleCampaignId: value("googleCampaignId"), tiktokCampaignId: value("tiktokCampaignId"),
    };
    void run(async () => {
      if (campaign?.id) {
        await leadRequest(`/api/campaigns/${campaign.id}`, "PATCH", { ...body, expectedRevision: campaign.revision }, organizationId);
        toast.success("Campaign updated.");
        router.refresh();
      } else {
        const result = await leadRequest<{ campaign: { key: string } }>("/api/campaigns", "POST", body, organizationId);
        toast.success("Campaign added.");
        router.push(`/workspace/marketing/campaigns/${encodeURIComponent(result.campaign.key)}`);
      }
    });
  }

  return <Dialog open={open} onOpenChange={next => { if (!pending) { setOpen(next); setError(""); } }}>
    <DialogTrigger render={trigger ? <Button variant="outline" size="sm" /> : <Button />}>{trigger ?? <><Plus aria-hidden="true" />Add campaign</>}</DialogTrigger>
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <DialogHeader>
          <DialogTitle>{campaign?.id ? "Campaign details" : "Add a campaign"}</DialogTitle>
          <DialogDescription>{campaign?.id ? "Renaming a campaign keeps its leads: they stay grouped by the name they arrived with." : "Leads whose campaign tag has this name are counted with it, for example utm_campaign or the campaign typed on a lead."}</DialogDescription>
        </DialogHeader>
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field id={id("name")} label="Name *"><Input id={id("name")} name="name" required maxLength={200} defaultValue={campaign?.name ?? ""} placeholder="Marina Launch Q4" /></Field></div>
          <Field id={id("platform")} label="Platform"><select id={id("platform")} name="platform" className={selectClassName} defaultValue={campaign?.platform ?? ""}><option value="">Not set</option>{CAMPAIGN_PLATFORMS.map(platform => <option key={platform} value={platform}>{CAMPAIGN_PLATFORM_LABELS[platform]}</option>)}</select></Field>
          <Field id={id("status")} label="Status"><select id={id("status")} name="status" className={selectClassName} defaultValue={campaign?.status ?? "ACTIVE"}>{CAMPAIGN_STATUSES.map(status => <option key={status} value={status}>{CAMPAIGN_STATUS_LABELS[status]}</option>)}</select></Field>
          <Field id={id("startsOn")} label="Starts"><Input id={id("startsOn")} name="startsOn" type="date" defaultValue={campaign?.startsOn ?? ""} /></Field>
          <Field id={id("endsOn")} label="Ends"><Input id={id("endsOn")} name="endsOn" type="date" defaultValue={campaign?.endsOn ?? ""} /></Field>
          <Field id={id("budget")} label="Planned budget" hint="Optional. For comparing with spend."><Input id={id("budget")} name="budget" inputMode="decimal" defaultValue={campaign?.budgetMinor != null ? moneyInput(campaign.budgetMinor) : ""} placeholder="25000" /></Field>
          <Field id={id("currency")} label="Currency"><Input id={id("currency")} name="currency" maxLength={3} defaultValue={campaign?.currency ?? "AED"} className="uppercase" /></Field>
          <div className="sm:col-span-2"><Field id={id("owner")} label="Owner"><select id={id("owner")} name="ownerMembershipId" className={selectClassName} defaultValue={campaign?.ownerMembershipId ?? ""}><option value="">No owner</option>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.label}</option>)}</select></Field></div>
          <div className="sm:col-span-2"><Field id={id("notes")} label="Notes"><textarea id={id("notes")} name="notes" maxLength={2000} className={textareaClassName} defaultValue={campaign?.notes ?? ""} placeholder="Audience, offer, creative…" /></Field></div>
          <details className="sm:col-span-2 rounded-lg border px-3 py-2 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Ad platform IDs</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field id={id("meta")} label="Meta campaign ID"><Input id={id("meta")} name="metaCampaignId" inputMode="numeric" maxLength={40} defaultValue={campaign?.metaCampaignId ?? ""} /></Field>
              <Field id={id("google")} label="Google campaign ID"><Input id={id("google")} name="googleCampaignId" inputMode="numeric" maxLength={40} defaultValue={campaign?.googleCampaignId ?? ""} /></Field>
              <Field id={id("tiktok")} label="TikTok campaign ID"><Input id={id("tiktok")} name="tiktokCampaignId" inputMode="numeric" maxLength={40} defaultValue={campaign?.tiktokCampaignId ?? ""} /></Field>
            </div>
          </details>
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}{campaign?.id ? "Save changes" : "Add campaign"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

/** Spend for a period, entered by hand: added to a campaign, or an entry changed. */
export function SpendDialog({ organizationId, campaign, entry, defaultCurrency }: { organizationId: string; campaign: { id: string | null; key: string }; entry?: SpendFormValues; defaultCurrency: string }) {
  const router = useRouter();
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const { pending, error, setError, run } = useSubmit(() => setOpen(false));
  const id = (name: string) => `${prefix}-${name}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const body = { spentFrom: value("spentFrom"), spentTo: value("spentTo"), amount: value("amount"), currency: value("currency") || defaultCurrency, note: value("note") };
    void run(async () => {
      if (entry?.id) await leadRequest(`/api/campaigns/spend/${entry.id}`, "PATCH", body, organizationId);
      else await leadRequest("/api/campaigns/spend", "POST", { ...body, ...(campaign.id ? { campaignId: campaign.id } : { campaignKey: campaign.key }) }, organizationId);
      toast.success(entry?.id ? "Spend updated." : "Spend added.");
      router.refresh();
    });
  }

  return <Dialog open={open} onOpenChange={next => { if (!pending) { setOpen(next); setError(""); } }}>
    <DialogTrigger render={entry ? <Button variant="ghost" size="icon-sm" aria-label="Change this spend entry" /> : <Button size="sm" />}>{entry ? <Pencil aria-hidden="true" /> : <><Plus aria-hidden="true" />Add spend</>}</DialogTrigger>
    <DialogContent className="sm:max-w-md">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <DialogHeader>
          <DialogTitle>{entry?.id ? "Change spend" : "Add spend"}</DialogTitle>
          <DialogDescription>What the campaign cost for these days, both included. Reports count the share of the period inside the dates they show.</DialogDescription>
        </DialogHeader>
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          <Field id={id("from")} label="From *"><Input id={id("from")} name="spentFrom" type="date" required defaultValue={entry?.spentFrom ?? ""} /></Field>
          <Field id={id("to")} label="To *"><Input id={id("to")} name="spentTo" type="date" required defaultValue={entry?.spentTo ?? ""} /></Field>
          <Field id={id("amount")} label="Amount *"><Input id={id("amount")} name="amount" inputMode="decimal" required defaultValue={entry ? moneyInput(entry.amountMinor) : ""} placeholder="5000" /></Field>
          <Field id={id("currency")} label="Currency"><Input id={id("currency")} name="currency" maxLength={3} defaultValue={entry?.currency ?? defaultCurrency} className="uppercase" /></Field>
          <div className="sm:col-span-2"><Field id={id("note")} label="Note"><Input id={id("note")} name="note" maxLength={300} defaultValue={entry?.note ?? ""} placeholder="Invoice 1042, Meta Ads Manager…" /></Field></div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={pending} data-testid="spend-save">{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}{entry?.id ? "Save" : "Add spend"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

/** Removes a spend entry entered by hand, after confirming. */
export function DeleteSpendButton({ organizationId, spendId }: { organizationId: string; spendId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, error, setError, run } = useSubmit(() => setOpen(false));
  return <Dialog open={open} onOpenChange={next => { if (!pending) { setOpen(next); setError(""); } }}>
    <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Remove this spend entry" />}><Trash2 aria-hidden="true" /></DialogTrigger>
    <DialogContent className="sm:max-w-sm">
      <DialogHeader><DialogTitle>Remove this spend?</DialogTitle><DialogDescription>The campaign&apos;s spend and cost per lead will no longer include it.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
        <Button variant="destructive" disabled={pending} onClick={() => void run(async () => { await leadRequest(`/api/campaigns/spend/${spendId}/delete`, "POST", {}, organizationId); toast.success("Spend removed."); router.refresh(); })}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}Remove</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
