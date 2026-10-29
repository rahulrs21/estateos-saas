"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { FileSearch, Globe2, Play, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { leadRequest } from "@/modules/leads/client";
import { formatLeadDate, LeadField, LeadFormMessage, selectClassName, textareaClassName } from "@/modules/leads/components/lead-ui";
import { cn } from "@/lib/utils";
import { savePortalConnectionSchema, setPortalFieldMappingSchema } from "../input-validation";
import { connectionStatusClassName, connectionStatusDescriptions, connectionStatusLabels, humanize, mappingKeyLabels, publicationStateLabels } from "../presentation";
import type { PortalSettingsData } from "../server/service";
import { adminSettableConnectionStatuses, portalMappingKeys } from "../types";

type Provider = PortalSettingsData["providers"][number];
type Save = (path: string, body: unknown, message: string) => Promise<boolean>;

function ConnectionDialog({provider, save}: {provider: Provider; save: Save}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    const parsed = savePortalConnectionSchema.safeParse({provider: provider.provider, status: form.get("status"), accountReference: form.get("accountReference"), notes: form.get("notes"), expectedUpdatedAt: provider.updatedAt});
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setPending(true);
    if (await save("/api/portals/connections", parsed.data, `${provider.displayName} settings saved.`)) setOpen(false);
    setPending(false);
  }
  const current = (adminSettableConnectionStatuses as readonly string[]).includes(provider.status) ? provider.status : "NOT_CONFIGURED";
  return <Dialog open={open} onOpenChange={value => { if (!pending) { setOpen(value); setError(""); } }}>
    <DialogTrigger render={<Button variant="outline" size="sm" />}>Update status</DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>{provider.displayName} integration</DialogTitle><DialogDescription>Record the integration request status. A connection is shown as Connected only after a server-side verification, which is not yet available.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4">
        <LeadField id={`${prefix}-status`} label="Status"><select id={`${prefix}-status`} name="status" className={selectClassName} defaultValue={current}>{adminSettableConnectionStatuses.map(status => <option key={status} value={status}>{connectionStatusLabels[status]}</option>)}</select></LeadField>
        <LeadField id={`${prefix}-account`} label="Portal account reference" hint="A non-secret identifier such as your agency or broker number on the portal."><Input id={`${prefix}-account`} name="accountReference" maxLength={120} defaultValue={provider.accountReference ?? ""} autoComplete="off" /></LeadField>
        <LeadField id={`${prefix}-notes`} label="Internal notes"><textarea id={`${prefix}-notes`} name="notes" maxLength={1000} className={textareaClassName} defaultValue={provider.notes ?? ""} /></LeadField>
        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Never enter API keys, passwords or tokens here. Credentials will be stored in a protected server-side secret store when live integrations are approved.</p>
        <Button type="submit">{pending ? "Saving…" : "Save status"}</Button>
      </fieldset><LeadFormMessage message={error} /></form>
    </DialogContent>
  </Dialog>;
}

function MappingDialog({provider, agents, save}: {provider: Provider; agents: PortalSettingsData["agents"]; save: Save}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [fieldKey, setFieldKey] = useState<string>("PROPERTY_TYPE");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    const parsed = setPortalFieldMappingSchema.safeParse({provider: provider.provider, fieldKey, sourceValue: form.get("sourceValue"), targetValue: form.get("targetValue")});
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setPending(true);
    if (await save("/api/portals/mappings", parsed.data, "Field mapping saved.")) setOpen(false);
    setPending(false);
  }
  return <Dialog open={open} onOpenChange={value => { if (!pending) { setOpen(value); setError(""); } }}>
    <DialogTrigger render={<Button variant="outline" size="sm" />}><Plus aria-hidden="true" />Add mapping</DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>{provider.displayName} field mapping</DialogTitle><DialogDescription>Override the value sent to this portal for an EstateOS value. Overrides apply to this company only.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4">
        <LeadField id={`${prefix}-field`} label="Field"><select id={`${prefix}-field`} className={selectClassName} value={fieldKey} onChange={event => setFieldKey(event.target.value)}>{portalMappingKeys.map(key => <option key={key} value={key}>{mappingKeyLabels[key]}</option>)}</select></LeadField>
        {fieldKey === "AGENT_ID"
          ? <LeadField id={`${prefix}-source`} label="Agent" hint={agents.length ? undefined : "No active agents found."}><select id={`${prefix}-source`} name="sourceValue" className={selectClassName} required>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></LeadField>
          : <LeadField id={`${prefix}-source`} label="EstateOS value" hint="For example APARTMENT, SALE or DUBAI."><Input id={`${prefix}-source`} name="sourceValue" maxLength={120} required autoComplete="off" /></LeadField>}
        <LeadField id={`${prefix}-target`} label="Portal value" hint="Use the value from the provider's approved specification."><Input id={`${prefix}-target`} name="targetValue" maxLength={120} required autoComplete="off" /></LeadField>
        <Button type="submit">{pending ? "Saving…" : "Save mapping"}</Button>
      </fieldset><LeadFormMessage message={error} /></form>
    </DialogContent>
  </Dialog>;
}

function DryRun({provider, limit, run}: {provider: Provider; limit: number; run: (provider: string, format: string) => Promise<void>}) {
  const [format, setFormat] = useState("JSON");
  const [pending, setPending] = useState(false);
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label={`${provider.displayName} dry run format`} className={cn(selectClassName, "h-9 w-auto")} value={format} onChange={event => setFormat(event.target.value)}><option value="JSON">JSON</option><option value="XML">XML</option></select>
      <Button size="sm" variant="outline" disabled={pending || provider.status === "DISABLED"} onClick={async () => { setPending(true); await run(provider.provider, format); setPending(false); }}><Play aria-hidden="true" />{pending ? "Checking…" : "Run feed dry run"}</Button>
    </div>
    <p className="text-xs text-muted-foreground">Validates and serializes up to {limit} active listings in memory. Nothing is stored, published or exposed at a public URL.</p>
    {provider.jobs.length ? <ul className="space-y-2" aria-label={`${provider.displayName} recent dry runs`}>{provider.jobs.map(job => <li key={job.id} className="rounded-lg border p-3 text-xs">
      <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{job.format} · {job.validCount} of {job.listingCount} listings valid</span><time dateTime={job.startedAt} className="text-muted-foreground">{formatLeadDate(job.startedAt, true)}</time></div>
      {job.errorSummary && <p className="mt-1 break-words text-muted-foreground">Blocking issues: {job.errorSummary}</p>}
    </li>)}</ul> : <p className="text-xs text-muted-foreground">No dry runs yet.</p>}
  </div>;
}

export function PortalSettings({data}: {data: PortalSettingsData}) {
  const router = useRouter();
  async function save(path: string, body: unknown, message: string) {
    try { await leadRequest(path, "POST", body, data.organizationId); toast.success(message); router.refresh(); return true; }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : "The change could not be saved."); return false; }
  }
  async function run(provider: string, format: string) {
    try {
      const result = await leadRequest<{validCount: number; listingCount: number; truncated: boolean}>("/api/portals/feed-jobs", "POST", {provider, format}, data.organizationId);
      toast.success(`Dry run complete: ${result.validCount} of ${result.listingCount} listings are ready.${result.truncated ? " Only the first listings were reviewed." : ""}`);
      router.refresh();
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "The dry run failed."); }
  }
  return <div className="space-y-5">
    <Card className="shadow-xs ring-border"><CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">Live publishing is not enabled. Provider specifications and partner access have not been verified, so exports use an internal draft format for review only.</p>
      <Link href="/settings/property-portals/preview" className={buttonVariants({variant: "default", size: "sm"})}><FileSearch aria-hidden="true" />Open export preview</Link>
    </CardContent></Card>
    <div className="grid gap-5 xl:grid-cols-3">{data.providers.map(provider => <Card key={provider.provider} className="shadow-xs ring-border" aria-labelledby={`portal-${provider.provider}`}>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3"><CardTitle id={`portal-${provider.provider}`} className="flex items-center gap-2"><Globe2 className="size-4 text-primary" aria-hidden="true" />{provider.displayName}</CardTitle><Badge variant="outline" className={connectionStatusClassName[provider.status]}>{connectionStatusLabels[provider.status]}</Badge></div>
        <CardDescription>{connectionStatusDescriptions[provider.status]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid gap-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">Portal account reference</dt><dd className="mt-0.5 break-words">{provider.accountReference ?? "Not recorded"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Specification</dt><dd className="mt-0.5">Not verified — draft export format</dd></div>
          {provider.notes && <div><dt className="text-xs text-muted-foreground">Notes</dt><dd className="mt-0.5 whitespace-pre-wrap break-words text-muted-foreground">{provider.notes}</dd></div>}
          {provider.lastErrorCode && <div><dt className="text-xs text-muted-foreground">Last verification error</dt><dd className="mt-0.5 text-destructive">{provider.lastErrorCode}</dd></div>}
          {provider.updatedAt && <div><dt className="text-xs text-muted-foreground">Last updated</dt><dd className="mt-0.5"><time dateTime={provider.updatedAt}>{formatLeadDate(provider.updatedAt, true)}</time></dd></div>}
        </dl>
        <ConnectionDialog provider={provider} save={save} />

        <section className="space-y-2 border-t pt-4" aria-label={`${provider.displayName} listing publications`}>
          <h3 className="text-sm font-semibold">Listing validation</h3>
          {provider.publicationCounts.length ? <ul className="flex flex-wrap gap-2">{provider.publicationCounts.map(row => <li key={row.status}><Badge variant="outline">{publicationStateLabels[row.status] ?? humanize(row.status)}: {row.count}</Badge></li>)}</ul> : <p className="text-xs text-muted-foreground">No listings have been validated for this portal yet.</p>}
        </section>

        <section className="space-y-3 border-t pt-4" aria-label={`${provider.displayName} field mappings`}>
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Field mapping overrides</h3><MappingDialog provider={provider} agents={data.agents} save={save} /></div>
          {provider.mappings.length ? <ul className="space-y-2">{provider.mappings.map(mapping => <li key={mapping.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs">
            <span className="min-w-0 break-words"><span className="text-muted-foreground">{mappingKeyLabels[mapping.fieldKey] ?? mapping.fieldKey}:</span> {mapping.fieldKey === "AGENT_ID" ? data.agents.find(agent => agent.id === mapping.sourceValue)?.name ?? "Former agent" : mapping.sourceValue} → <span className="font-medium">{mapping.targetValue}</span></span>
            <Button size="icon-sm" variant="ghost" aria-label={`Remove mapping for ${mapping.sourceValue}`} onClick={() => save(`/api/portals/mappings/${mapping.id}/remove`, {}, "Field mapping removed.")}><Trash2 aria-hidden="true" /></Button>
          </li>)}</ul> : <p className="text-xs text-muted-foreground">Using the default draft mappings.</p>}
        </section>

        <section className="space-y-2 border-t pt-4" aria-label={`${provider.displayName} feed dry run`}>
          <h3 className="text-sm font-semibold">Feed dry run</h3>
          <DryRun provider={provider} limit={data.feedDryRunLimit} run={run} />
        </section>
      </CardContent>
    </Card>)}</div>
  </div>;
}
