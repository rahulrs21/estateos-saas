"use client";

import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Copy, Plus, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatLeadDate, LeadField, LeadFormMessage, selectClassName, textareaClassName } from "@/modules/leads/components/lead-ui";
import { communicationsGet, communicationsSend, errorMessage } from "../client";
import type { CommunicationRules } from "../compliance";
import { SUPPRESSION_REASON_LABELS, SUPPRESSION_REASONS } from "../model";
import { displayNumber } from "../phone";
import type { providerSettings } from "../server/providers";
import type { getCommunicationSettings, listSuppressions } from "../server/settings";

type SettingsView = Awaited<ReturnType<typeof getCommunicationSettings>>;
type ProvidersView = Awaited<ReturnType<typeof providerSettings>>;
type SuppressionsView = Awaited<ReturnType<typeof listSuppressions>>;
type Send = (path: string, method: "POST" | "PUT", body: unknown, success: string) => Promise<boolean>;

const STATUS_LABELS: Record<string, string> = {NOT_CONFIGURED: "Not configured", CONFIGURED: "Not verified", VERIFIED: "Verified", DISABLED: "Disabled", ERROR: "Verification failed"};
const LINE_STATUS: Record<string, string> = {PENDING: "Pending", ACTIVE: "Active", DISABLED: "Disabled"};
const PURPOSES: Record<string, string> = {SALES: "Sales calls", SUPPORT: "Customer service", MARKETING: "Marketing calls", VOICE_ASSISTANT: "Voice assistant (test only)"};

function Section({title, description, action, children}: {title: string; description: ReactNode; action?: ReactNode; children: ReactNode}) {
  return <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 space-y-1"><CardTitle role="heading" aria-level={2}>{title}</CardTitle><CardDescription>{description}</CardDescription></div>{action}</div></CardHeader><CardContent className="px-5">{children}</CardContent></Card>;
}

/** A dialog with a form whose values are sent as JSON. */
function FormDialog({trigger, title, description, submitLabel, children, onSubmit}: {trigger: ReactNode; title: string; description: string; submitLabel: string; children: ReactNode; onSubmit: (form: FormData) => Promise<boolean>}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    try { if (await onSubmit(new FormData(event.currentTarget))) setOpen(false); }
    catch (problem) { setError(errorMessage(problem, "The change could not be saved.")); }
    finally { setPending(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!pending) { setOpen(value); setError(""); } }}>
    <DialogTrigger render={<Button variant="outline" size="sm" />}>{trigger}</DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4">{children}<Button type="submit">{pending ? "Saving…" : submitLabel}</Button></fieldset><LeadFormMessage message={error} /></form>
    </DialogContent>
  </Dialog>;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const number = (form: FormData, name: string) => Number(text(form, name));

function RulesSection({settings, send}: {settings: SettingsView; send: Send}) {
  const prefix = useId();
  const rules: CommunicationRules = settings.rules;
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await send("/api/communications/settings", "PUT", {
        expectedRevision: settings.revision, timeZone: text(form, "timeZone"), callingWindowStart: text(form, "callingWindowStart"), callingWindowEnd: text(form, "callingWindowEnd"),
        maxCallsPerContactPerDay: number(form, "maxCallsPerContactPerDay"), telemarketingEnabled: form.get("telemarketingEnabled") === "on", telemarketingApprovalReference: text(form, "telemarketingApprovalReference") || null,
        marketingWindowStart: text(form, "marketingWindowStart"), marketingWindowEnd: text(form, "marketingWindowEnd"), marketingMaxCallsPerDay: number(form, "marketingMaxCallsPerDay"),
        marketingMaxUnansweredPerWeek: number(form, "marketingMaxUnansweredPerWeek"), allowedCallingCodes: text(form, "allowedCallingCodes"), maxConcurrentLiveCalls: number(form, "maxConcurrentLiveCalls"),
        maxLiveCallsPerAgentPerDay: number(form, "maxLiveCallsPerAgentPerDay"), recordingEnabled: false, recordingNoticeText: settings.recordingNoticeText, recordingLegalBasis: settings.recordingLegalBasis,
        retentionDays: number(form, "retentionDays"), aiAnalysisEnabled: false,
      }, "Calling rules saved.");
    } catch (problem) { setError(errorMessage(problem, "The rules could not be saved.")); }
    finally { setPending(false); }
  }
  const field = (name: keyof CommunicationRules, label: string, props: Record<string, unknown> = {}, hint?: string) => <LeadField id={`${prefix}-${name}`} label={label} hint={hint}>
    <Input id={`${prefix}-${name}`} name={name} defaultValue={String(rules[name] ?? "")} disabled={!settings.canManage} {...props} /></LeadField>;
  return <Section title="Calling rules" description={<>Checked on the server for every call. Live calls that break a rule are refused; manually logged calls are saved with a warning. {settings.updatedAt ? `Last saved ${formatLeadDate(settings.updatedAt, true)}${settings.updatedBy ? ` by ${settings.updatedBy}` : ""}.` : "Defaults in use (not saved yet)."}</>}>
    <form onSubmit={submit} className="space-y-5"><fieldset disabled={pending || !settings.canManage} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {field("timeZone", "Timezone")}
        {field("callingWindowStart", "Calling hours from", {type: "time"})}
        {field("callingWindowEnd", "Calling hours until", {type: "time"}, "Company policy for every call.")}
        {field("maxCallsPerContactPerDay", "Calls per number per day", {type: "number", min: 1, max: 10})}
        {field("allowedCallingCodes", "Allowed calling codes", {}, "Without +, separated by commas.")}
        {field("maxConcurrentLiveCalls", "Simultaneous live calls", {type: "number", min: 1, max: 50})}
        {field("maxLiveCallsPerAgentPerDay", "Live calls per agent per day", {type: "number", min: 1, max: 500})}
        {field("retentionDays", "Keep call details (days)", {type: "number", min: 1, max: 3650})}
      </div>
      <fieldset className="space-y-4 rounded-lg border p-4"><legend className="px-1 text-sm font-medium">Marketing calls (UAE telemarketing rules)</legend>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="telemarketingEnabled" defaultChecked={rules.telemarketingEnabled} disabled={!settings.canManage} className="size-4" />Our company may make marketing calls (TDRA approval obtained)</label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {field("telemarketingApprovalReference", "TDRA approval reference")}
          {field("marketingWindowStart", "Marketing from", {type: "time", min: "09:00", max: "18:00"})}
          {field("marketingWindowEnd", "Marketing until", {type: "time", min: "09:00", max: "18:00"}, "Within 09:00-18:00.")}
          {field("marketingMaxCallsPerDay", "Marketing calls per day", {type: "number", min: 0, max: 1})}
          {field("marketingMaxUnansweredPerWeek", "Unanswered per week", {type: "number", min: 0, max: 2})}
        </div>
      </fieldset>
      <p className="text-xs leading-5 text-muted-foreground">Call recording and Claude analysis are off and arrive in later updates with their own consent controls. These checks are not legal advice; see the compliance notes for points your legal adviser should review.</p>
      {settings.canManage && <Button type="submit">{pending ? "Saving…" : "Save calling rules"}</Button>}
    </fieldset><LeadFormMessage message={error} /></form>
  </Section>;
}

function LiveCallingSection({view, send}: {view: ProvidersView; send: Send}) {
  const {attestation} = view;
  const verified = view.connections.some(connection => connection.connectionStatus === "VERIFIED" && connection.capabilities.outboundCalls);
  const activeLines = view.lines.filter(line => line.status === "ACTIVE" && line.linePurpose !== "VOICE_ASSISTANT").length;
  return <Section title="Live calling" description="EstateOS places calls only when all of these are in place. Until then agents log the calls they make on their approved phone service.">
    <ul className="space-y-2 text-sm">
      <li className="flex items-center gap-2">{verified ? <ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" /> : <ShieldAlert className="size-4 text-muted-foreground" aria-hidden="true" />}A verified provider connection that can place calls: {verified ? "yes" : "no"}</li>
      <li className="flex items-center gap-2">{activeLines ? <ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" /> : <ShieldAlert className="size-4 text-muted-foreground" aria-hidden="true" />}Active company lines registered to the company: {activeLines}</li>
      <li className="flex items-center gap-2">{attestation.current ? <ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" /> : <ShieldAlert className="size-4 text-muted-foreground" aria-hidden="true" />}Confirmation by an owner or administrator: {attestation.current ? `given ${formatLeadDate(attestation.attestedAt, true)}${attestation.attestedBy ? ` by ${attestation.attestedBy}` : ""}` : attestation.attestedAt ? "outdated (the statement changed)" : "not given"}</li>
      <li className="flex items-center gap-2">{view.publicOrigin.startsWith("https://") ? <ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" /> : <ShieldAlert className="size-4 text-muted-foreground" aria-hidden="true" />}A public HTTPS address for provider updates: {view.publicOrigin.startsWith("https://") ? view.publicOrigin : "not configured (local or HTTP address)"}</li>
    </ul>
    <blockquote className="mt-4 rounded-lg border-l-4 bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">{attestation.statement}</blockquote>
    <div className="mt-3 flex flex-wrap gap-2">
      {!attestation.current && <Button size="sm" disabled={!attestation.settingsSaved} onClick={() => void send("/api/communications/attestation", "POST", {confirm: true, version: attestation.version}, "Live-calling arrangements confirmed.")}>I confirm this statement</Button>}
      {attestation.attestedAt && <Button size="sm" variant="outline" onClick={() => void send("/api/communications/attestation/revoke", "POST", {}, "Confirmation withdrawn. Live calling is off.")}>Withdraw confirmation</Button>}
    </div>
    {!attestation.settingsSaved && <p className="mt-2 text-xs text-muted-foreground">Save the calling rules first.</p>}
  </Section>;
}

function ConnectionFields({view, connection}: {view: ProvidersView; connection?: ProvidersView["connections"][number]}) {
  const prefix = useId();
  return <>
    {!connection && <LeadField id={`${prefix}-type`} label="Provider"><select id={`${prefix}-type`} name="providerType" className={selectClassName}>{view.providers.map(provider => <option key={provider.type} value={provider.type}>{provider.label}</option>)}</select></LeadField>}
    <LeadField id={`${prefix}-name`} label="Name"><Input id={`${prefix}-name`} name="displayName" required minLength={2} maxLength={80} defaultValue={connection?.displayName ?? ""} placeholder="Main Twilio account" /></LeadField>
    <LeadField id={`${prefix}-account`} label="Provider account identifier" hint={connection ? connection.label : "For example the Twilio Account SID or the Retell agent ID. Not secret."}><Input id={`${prefix}-account`} name="externalAccountId" maxLength={80} defaultValue={connection?.externalAccountId ?? ""} autoComplete="off" /></LeadField>
    <LeadField id={`${prefix}-secret`} label="Server secret name" hint="The NAME of the server environment variable or Secret Manager secret holding the credential, for example COMMS_TWILIO_AUTH_TOKEN. Never paste the credential itself."><Input id={`${prefix}-secret`} name="secretRef" maxLength={80} defaultValue={connection?.secretRef ?? ""} autoComplete="off" pattern="COMMS_[A-Z0-9_]{3,60}" /></LeadField>
  </>;
}

function ProvidersSection({view, send}: {view: ProvidersView; send: Send}) {
  const copy = (value: string) => { void navigator.clipboard?.writeText(value).then(() => toast.success("Webhook address copied.")); };
  return <Section title="Calling providers" description="Connections to approved providers. Credentials stay on the server; EstateOS stores only the secret's name. Any change needs a new verification."
    action={<FormDialog trigger={<><Plus aria-hidden="true" />Add connection</>} title="Add a provider connection" description="Saving does not contact the provider. Check the connection afterwards." submitLabel="Add connection"
      onSubmit={form => send("/api/communications/providers", "POST", {providerType: text(form, "providerType"), displayName: text(form, "displayName"), externalAccountId: text(form, "externalAccountId") || null, secretRef: text(form, "secretRef") || null}, "Connection added.")}>
      <ConnectionFields view={view} /></FormDialog>}>
    {!view.connections.length ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No provider is connected. Live calling stays off; agents log their calls manually.</p>
      : <ul className="space-y-3">{view.connections.map(connection => <li key={connection.id} className="space-y-2 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-sm font-medium">{connection.displayName}</p><p className="text-xs text-muted-foreground">{connection.label}</p></div>
          <div className="flex flex-wrap items-center gap-1.5"><Badge variant={connection.connectionStatus === "VERIFIED" ? "secondary" : "outline"}>{STATUS_LABELS[connection.connectionStatus] ?? connection.connectionStatus}</Badge>
            <Badge variant="outline">{connection.secretAvailable ? "Secret set on server" : "Secret not set on server"}</Badge></div>
        </div>
        <p className="text-xs text-muted-foreground">Account: {connection.externalAccountId ?? "not set"} · Secret name: {connection.secretRef ?? "not set"}{connection.lastWebhookAt ? ` · Last provider update ${formatLeadDate(connection.lastWebhookAt, true)}` : ""}</p>
        {connection.verificationNote && <p className="text-xs text-muted-foreground">Last check{connection.verifiedAt ? ` (${formatLeadDate(connection.verifiedAt, true)})` : ""}: {connection.verificationNote}</p>}
        {connection.webhookUrl && <p className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">Webhook address for the provider:</span><code className="break-all rounded bg-muted px-1.5 py-0.5">{connection.webhookUrl}</code><Button variant="ghost" size="sm" onClick={() => copy(connection.webhookUrl!)} aria-label="Copy webhook address"><Copy aria-hidden="true" /></Button></p>}
        {!connection.capabilities.verifiedWebhooks && <p className="text-xs text-muted-foreground">EstateOS has no verified integration for this provider yet: it accepts no webhooks and places no calls.</p>}
        {connection.providerType === "RETELL" && <p className="text-xs text-muted-foreground">Retell is used only for the voice assistant in test mode. EstateOS never starts AI phone calls.</p>}
        <div className="flex flex-wrap gap-2">
          <FormDialog trigger="Edit" title="Edit connection" description="Changing the details returns the connection to not verified." submitLabel="Save"
            onSubmit={form => send(`/api/communications/providers/${connection.id}`, "PUT", {expectedRevision: connection.revision, providerType: connection.providerType, displayName: text(form, "displayName"), externalAccountId: text(form, "externalAccountId") || null, secretRef: text(form, "secretRef") || null}, "Connection saved.")}>
            <ConnectionFields view={view} connection={connection} /></FormDialog>
          {connection.connectionStatus !== "DISABLED" && connection.connectionStatus !== "NOT_CONFIGURED" && connection.capabilities.verifiedWebhooks &&
            <Button variant="outline" size="sm" onClick={() => void send(`/api/communications/providers/${connection.id}/verify`, "POST", {expectedRevision: connection.revision}, "Connection checked.")}>Check connection</Button>}
          <Button variant="outline" size="sm" onClick={() => void send(`/api/communications/providers/${connection.id}/enabled`, "POST", {expectedRevision: connection.revision, enabled: connection.connectionStatus === "DISABLED"}, connection.connectionStatus === "DISABLED" ? "Connection enabled; check it again." : "Connection disabled.")}>{connection.connectionStatus === "DISABLED" ? "Enable" : "Disable"}</Button>
        </div>
      </li>)}</ul>}
  </Section>;
}

function LineFields({view, line}: {view: ProvidersView; line?: ProvidersView["lines"][number]}) {
  const prefix = useId();
  return <>
    {!line && <LeadField id={`${prefix}-connection`} label="Provider connection"><select id={`${prefix}-connection`} name="providerConnectionId" className={selectClassName} required>{view.connections.map(connection => <option key={connection.id} value={connection.id}>{connection.displayName}</option>)}</select></LeadField>}
    {!line && <LeadField id={`${prefix}-number`} label="Company number" hint="Registered to your company's commercial licence, with its country code."><Input id={`${prefix}-number`} name="phoneNumber" required placeholder="+971 4 123 4567" /></LeadField>}
    <LeadField id={`${prefix}-name`} label="Label (optional)"><Input id={`${prefix}-name`} name="displayName" maxLength={80} defaultValue={line?.displayName ?? ""} /></LeadField>
    <LeadField id={`${prefix}-purpose`} label="Used for"><select id={`${prefix}-purpose`} name="linePurpose" className={selectClassName} defaultValue={line?.linePurpose ?? "SALES"}>{Object.entries(PURPOSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></LeadField>
    <LeadField id={`${prefix}-member`} label="Assigned member"><select id={`${prefix}-member`} name="assignedMembershipId" className={selectClassName} defaultValue={line?.assignedMembershipId ?? ""}><option value="">Not assigned</option>{view.members.map(member => <option key={member.id} value={member.id}>{member.userProfile?.displayName || member.email}</option>)}</select></LeadField>
    <LeadField id={`${prefix}-forward`} label="Ring the member on" hint="The member's own phone. EstateOS rings it first, then connects the customer."><Input id={`${prefix}-forward`} name="forwardToNumber" defaultValue={line?.forwardToNumber ?? ""} placeholder="+971 50 123 4567" /></LeadField>
  </>;
}

function LinesSection({view, send}: {view: ProvidersView; send: Send}) {
  const lineBody = (form: FormData) => ({displayName: text(form, "displayName") || null, linePurpose: text(form, "linePurpose"), assignedMembershipId: text(form, "assignedMembershipId") || null, forwardToNumber: text(form, "forwardToNumber") || null});
  return <Section title="Company lines" description="Numbers your agents call from. A line is used only after an owner or administrator confirms it is registered to the company and activates it."
    action={view.connections.length > 0 && <FormDialog trigger={<><Plus aria-hidden="true" />Add line</>} title="Add a company line" description="The number must already exist on the provider account." submitLabel="Add line"
      onSubmit={form => send("/api/communications/lines", "POST", {providerConnectionId: text(form, "providerConnectionId"), phoneNumber: text(form, "phoneNumber"), ...lineBody(form)}, "Line added.")}><LineFields view={view} /></FormDialog>}>
    {!view.lines.length ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{view.connections.length ? "No lines yet." : "Add a provider connection first."}</p>
      : <ul className="space-y-3">{view.lines.map(line => <li key={line.id} className="space-y-2 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{displayNumber(line.phoneNumber)}{line.displayName && <span className="font-normal text-muted-foreground"> · {line.displayName}</span>}</p><Badge variant={line.status === "ACTIVE" ? "secondary" : "outline"}>{LINE_STATUS[line.status]}</Badge></div>
        <p className="text-xs text-muted-foreground">{PURPOSES[line.linePurpose]} · {line.assignedMembership ? `Assigned to ${line.assignedMembership.userProfile?.displayName || line.assignedMembership.email}` : "Not assigned"} · Rings {line.forwardToNumber ? displayNumber(line.forwardToNumber) : "no number set"} · {line.registrationConfirmedAt ? `Registration confirmed ${formatLeadDate(line.registrationConfirmedAt, true)}${line.registrationConfirmedBy ? ` by ${line.registrationConfirmedBy.displayName}` : ""}` : "Registration not confirmed"}</p>
        <div className="flex flex-wrap gap-2">
          <FormDialog trigger="Edit" title="Edit line" description="An active line must stay assigned to an active member." submitLabel="Save"
            onSubmit={form => send(`/api/communications/lines/${line.id}`, "PUT", {expectedRevision: line.revision, ...lineBody(form)}, "Line saved.")}><LineFields view={view} line={line} /></FormDialog>
          {!line.registrationConfirmedAt && <Button variant="outline" size="sm" onClick={() => void send(`/api/communications/lines/${line.id}/registration`, "POST", {expectedRevision: line.revision}, "Registration confirmed.")}>Confirm it is registered to the company</Button>}
          <Button variant="outline" size="sm" onClick={() => void send(`/api/communications/lines/${line.id}/active`, "POST", {expectedRevision: line.revision, active: line.status !== "ACTIVE"}, line.status === "ACTIVE" ? "Line disabled." : "Line activated.")}>{line.status === "ACTIVE" ? "Disable" : "Activate"}</Button>
        </div>
      </li>)}</ul>}
  </Section>;
}

function SuppressionsSection({view, send}: {view: SuppressionsView; send: Send}) {
  const prefix = useId();
  return <Section title="Do-not-call list" description="Numbers EstateOS must not call, or must not call for marketing. Entries are kept as evidence when withdrawn. EstateOS does not query the TDRA Do Not Call Registry; record listed numbers here."
    action={<FormDialog trigger={<><Plus aria-hidden="true" />Add number</>} title="Add to the do-not-call list" description="Applies to every agent's calls from now on." submitLabel="Add"
      onSubmit={form => send("/api/communications/suppressions", "POST", {number: text(form, "number"), scope: text(form, "scope"), reason: text(form, "reason"), note: text(form, "note") || null}, "Number added to the do-not-call list.")}>
      <LeadField id={`${prefix}-number`} label="Number"><Input id={`${prefix}-number`} name="number" required placeholder="+971 50 123 4567" /></LeadField>
      <LeadField id={`${prefix}-scope`} label="Applies to"><select id={`${prefix}-scope`} name="scope" className={selectClassName}><option value="ALL">All calls</option><option value="MARKETING">Marketing calls only</option></select></LeadField>
      <LeadField id={`${prefix}-reason`} label="Reason"><select id={`${prefix}-reason`} name="reason" className={selectClassName}>{SUPPRESSION_REASONS.map(reason => <option key={reason} value={reason}>{SUPPRESSION_REASON_LABELS[reason]}</option>)}</select></LeadField>
      <LeadField id={`${prefix}-note`} label="Note (optional)"><textarea id={`${prefix}-note`} name="note" maxLength={500} className={textareaClassName} /></LeadField>
    </FormDialog>}>
    {!view.active.length ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No numbers on the list.</p>
      : <ul className="divide-y">{view.active.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
        <div><p className="text-sm font-medium">{displayNumber(item.normalizedNumber)} <Badge variant={item.scope === "ALL" ? "destructive" : "secondary"}>{item.scope === "ALL" ? "No calls" : "No marketing calls"}</Badge></p>
          <p className="text-xs text-muted-foreground">{SUPPRESSION_REASON_LABELS[item.reason as keyof typeof SUPPRESSION_REASON_LABELS] ?? item.reason} · {item.source === "CALL_OUTCOME" ? "from a call outcome" : item.source === "DNCR_CHECK" ? "registry check" : "added by an administrator"} · {formatLeadDate(item.createdAt, true)}{item.createdBy ? ` · ${item.createdBy.displayName}` : ""}</p></div>
        <FormDialog trigger="Withdraw" title="Withdraw from the list" description="The number can be called again. The entry is kept with your reason." submitLabel="Withdraw"
          onSubmit={form => send(`/api/communications/suppressions/${item.id}/withdraw`, "POST", {reason: text(form, "reason")}, "Withdrawn from the do-not-call list.")}>
          <LeadField id={`${prefix}-withdraw-${item.id}`} label="Reason"><textarea id={`${prefix}-withdraw-${item.id}`} name="reason" required minLength={3} maxLength={500} className={textareaClassName} placeholder="For example: the customer asked to be called again on 3 Nov." /></LeadField>
        </FormDialog>
      </li>)}</ul>}
    {view.withdrawn.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer text-xs text-muted-foreground">Withdrawn ({view.withdrawn.length})</summary>
      <ul className="mt-2 space-y-1.5">{view.withdrawn.map(item => <li key={item.id} className="text-xs text-muted-foreground">{displayNumber(item.normalizedNumber)} · withdrawn {item.withdrawnAt ? formatLeadDate(item.withdrawnAt, true) : ""}{item.withdrawnBy ? ` by ${item.withdrawnBy.displayName}` : ""}: {item.withdrawalReason}</li>)}</ul></details>}
  </Section>;
}

/** Communication settings: the calling rules for everyone; providers, lines, confirmation and the do-not-call list for owners and administrators. */
export function CommunicationSettingsView({organizationId}: {organizationId: string}) {
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [providers, setProviders] = useState<ProvidersView | null>(null);
  const [suppressions, setSuppressions] = useState<SuppressionsView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => communicationsGet<SettingsView>("/api/communications/settings", "Settings could not be loaded.")
    .then(async rules => ({rules, admin: rules.canManage ? await Promise.all([
      communicationsGet<ProvidersView>("/api/communications/providers", "Providers could not be loaded."),
      communicationsGet<SuppressionsView>("/api/communications/suppressions", "The do-not-call list could not be loaded."),
    ]) : null}))
    .then(({rules, admin}) => {
      setSettings(rules);
      if (admin) { setProviders(admin[0]); setSuppressions(admin[1]); }
      setError(null);
    }, problem => setError(errorMessage(problem, "Settings could not be loaded."))), []);
  useEffect(() => { void load(); }, [load]);

  /** Sends a change; refreshes everything after it, successful or not, so the page shows the stored state. */
  const send: Send = async (path, method, body, success) => {
    try { await communicationsSend(path, organizationId, method, body); toast.success(success); return true; }
    catch (problem) { toast.error(errorMessage(problem, "The change could not be saved.")); throw problem; }
    finally { void load(); }
  };
  const quietSend: Send = (...args) => send(...args).catch(() => false);

  if (error) return <div role="alert" className="space-y-3 rounded-xl border p-6"><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw aria-hidden="true" />Try again</Button></div>;
  if (!settings || (settings.canManage && (!providers || !suppressions))) return <div role="status" className="animate-pulse rounded-xl border p-6 text-sm text-muted-foreground">Loading settings...</div>;
  return <div className="space-y-5">
    {!settings.canManage && <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">These are the calling rules your company applies. Only owners and administrators can change them.</p>}
    <RulesSection key={`rules-${settings.revision}`} settings={settings} send={send} />
    {providers && <LiveCallingSection view={providers} send={quietSend} />}
    {providers && <ProvidersSection view={providers} send={send} />}
    {providers && <LinesSection view={providers} send={send} />}
    {suppressions && <SuppressionsSection view={suppressions} send={send} />}
  </div>;
}
