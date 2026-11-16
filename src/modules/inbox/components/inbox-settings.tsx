"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { Copy, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { communicationsGet, communicationsSend, errorMessage } from "@/modules/communications/client";
import { formatLeadDate, LeadField, LeadFormMessage, selectClassName } from "@/modules/leads/components/lead-ui";
import { CAPABILITIES, type Capability, type CapabilityState } from "../adapters/types";
import type { ConnectionsView } from "../server/connections";
import type { inboxSettings } from "../server/conversations";
import { FormDialog, Section, text } from "./settings-ui";
import { MailboxesSection } from "./mailboxes-section";

type SettingsView = Awaited<ReturnType<typeof inboxSettings>>;
type Connection = ConnectionsView["connections"][number];
type Send = (path: string, method: "POST" | "PUT", body: unknown, success: string) => Promise<boolean>;

const STATUS_LABELS: Record<string, string> = {NOT_CONFIGURED: "Not configured", CONFIGURED: "Configured, not verified", VERIFIED: "Verified", DISABLED: "Disabled", ERROR: "Error"};
const CAPABILITY_LABELS: Record<Capability, string> = {
  VALIDATE_CONNECTION: "Check connection", RECEIVE_EVENTS: "Receive messages", NORMALIZE_MESSAGE: "Read message content", SYNC_HISTORY: "Import history",
  SEND_MESSAGE: "Send messages", DELIVERY_RECEIPTS: "Delivery receipts", RESOLVE_MESSAGE_ID: "Match provider message IDs", HEALTH_CHECK: "Health check", DISCONNECT: "Disconnect",
};
const STATE_LABELS: Record<CapabilityState, string> = {SUPPORTED: "Built", PLANNED: "Planned (later phase)", UNSUPPORTED: "Not offered"};



function RulesSection({settings, send}: {settings: SettingsView; send: Send}) {
  const prefix = useId();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await send("/api/inbox/settings", "PUT", {expectedRevision: settings.revision, approvalRequired: form.get("approvalRequired") === "on",
        retentionDays: Number(text(form, "retentionDays")), unansweredMinutes: Number(text(form, "unansweredMinutes")), aiEnabled: form.get("aiEnabled") === "on"}, "Inbox rules saved.");
    } catch (problem) { setError(errorMessage(problem, "The rules could not be saved.")); }
    finally { setPending(false); }
  }
  return <Section title="Inbox rules" description="How your team's conversations are handled. Only owners and administrators can change these.">
    <form onSubmit={submit} className="space-y-4"><fieldset disabled={!settings.canEdit || pending} className="grid gap-4 sm:grid-cols-2">
      <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="approvalRequired" defaultChecked={settings.approvalRequired} className="mt-1" />
        <span><span className="font-medium">Outbound messages need approval</span><span className="block text-xs text-muted-foreground">An owner, administrator or manager approves each reply before it can be sent. The author cannot approve their own reply unless they are the owner.</span></span></label>
      <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="aiEnabled" defaultChecked={settings.aiEnabled} className="mt-1" />
        <span><span className="font-medium">Let Claude analyse conversations</span><span className="block text-xs text-muted-foreground">Members can ask Claude for a summary, the customer&apos;s questions and requirements, and a reply draft. Claude reads the latest messages with phone numbers and emails removed, and uses your company&apos;s AI allowance. Nothing is sent or saved to a lead without a person.</span></span></label>
      <LeadField id={`${prefix}-retention`} label="Keep message content for (days)" hint="After this, message text and files are removed; a record that a message existed remains. 30 to 3650 days.">
        <Input id={`${prefix}-retention`} name="retentionDays" type="number" min={30} max={3650} required defaultValue={settings.retentionDays} /></LeadField>
      <LeadField id={`${prefix}-unanswered`} label="Unanswered after (minutes)" hint="A conversation counts as unanswered when the customer's last message waited this long. Workflows can react to it.">
        <Input id={`${prefix}-unanswered`} name="unansweredMinutes" type="number" min={15} max={10080} required defaultValue={settings.unansweredMinutes} /></LeadField>
      {settings.canEdit && <div className="sm:col-span-2"><Button type="submit">{pending ? "Saving…" : "Save rules"}</Button></div>}
    </fieldset><LeadFormMessage message={error} /></form>
  </Section>;
}

function ConnectionFields({view, connection}: {view: ConnectionsView; connection?: Connection}) {
  const prefix = useId();
  const [provider, setProvider] = useState(connection?.provider ?? view.providers[0]?.provider ?? "WHATSAPP_CLOUD");
  const info = view.providers.find(item => item.provider === provider);
  return <>
    {!connection && <LeadField id={`${prefix}-provider`} label="Provider"><select id={`${prefix}-provider`} name="provider" className={selectClassName} value={provider} onChange={event => setProvider(event.target.value as typeof provider)}>
      {view.providers.map(item => <option key={item.provider} value={item.provider}>{item.label}</option>)}</select></LeadField>}
    <LeadField id={`${prefix}-name`} label="Name"><Input id={`${prefix}-name`} name="displayName" required minLength={2} maxLength={80} defaultValue={connection?.displayName ?? ""} placeholder="Sales WhatsApp" /></LeadField>
    <LeadField id={`${prefix}-account`} label="Account" hint={`The ${info?.accountLabel ?? "account identifier"}. Not secret; each account can belong to one company only.`}>
      <Input id={`${prefix}-account`} name="externalAccountReference" maxLength={200} defaultValue={connection?.externalAccountReference ?? ""} autoComplete="off" /></LeadField>
    <LeadField id={`${prefix}-secret`} label="Server secret name" hint={provider === "WHATSAPP_CLOUD"
      ? "The NAME of the server secret holding the Meta app secret, for example INBOX_WHATSAPP_APP_SECRET. The webhook verify token goes in a second secret with _VERIFY_TOKEN added to that name. Never paste a secret or a password here."
      : "The NAME of the server secret this connection will use. Email accounts are connected with OAuth in a later phase: never enter a mailbox password into EstateOS."}>
      <Input id={`${prefix}-secret`} name="credentialReference" maxLength={64} defaultValue={connection?.credentialReference ?? ""} autoComplete="off" pattern="INBOX_[A-Z0-9_]{3,56}" /></LeadField>
    {provider === "WHATSAPP_CLOUD" && <LeadField id={`${prefix}-token`} label="Access token secret name (for sending)"
      hint="The NAME of the server secret holding the WhatsApp access token from Meta, for example INBOX_WHATSAPP_ACCESS_TOKEN. Needed for Check connection and sending. Never paste the token here.">
      <Input id={`${prefix}-token`} name="accessTokenReference" maxLength={64} defaultValue={connection?.accessTokenReference ?? ""} autoComplete="off" pattern="INBOX_[A-Z0-9_]{3,56}" /></LeadField>}
    {provider === "WHATSAPP_CLOUD" && <LeadField id={`${prefix}-waba`} label="WhatsApp Business Account ID (for templates)"
      hint="In WhatsApp Manager, (https://business.facebook.com/ > Business Settings > Business Assets > Messaging Accounts ) the ID number shown under the account name (digits only). Not secret. EstateOS lists this account's approved templates.">
      <Input id={`${prefix}-waba`} name="businessAccountReference" maxLength={40} defaultValue={connection?.businessAccountReference ?? ""} autoComplete="off" inputMode="numeric" pattern="[0-9]{5,30}" /></LeadField>}
  </>;
}

function Capabilities({capabilities}: {capabilities: Record<Capability, CapabilityState>}) {
  return <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">What EstateOS can do with this channel</summary>
    <ul className="mt-2 grid gap-1 sm:grid-cols-2">{CAPABILITIES.map(capability => <li key={capability} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
      <span>{CAPABILITY_LABELS[capability]}</span><Badge variant={capabilities[capability] === "SUPPORTED" ? "secondary" : "outline"}>{STATE_LABELS[capabilities[capability]]}</Badge></li>)}</ul></details>;
}

function ConnectionsSection({view, send}: {view: ConnectionsView; send: Send}) {
  const copy = (value: string) => { void navigator.clipboard?.writeText(value).then(() => toast.success("Webhook address copied.")); };
  return <Section title="Channels" description="Company accounts with WhatsApp and email providers. Adding one here does not connect it: EstateOS verifies a connection and sends messages only after the live integration is built and approved (Phase 7B for WhatsApp, 7C for email)."
    action={<FormDialog trigger={<><Plus aria-hidden="true" />Add channel</>} title="Add a channel" description="Saving does not contact the provider and does not enable sending." submitLabel="Add channel"
      onSubmit={form => send("/api/inbox/connections", "POST", {provider: text(form, "provider"), displayName: text(form, "displayName"), externalAccountReference: text(form, "externalAccountReference") || null, credentialReference: text(form, "credentialReference") || null, accessTokenReference: text(form, "accessTokenReference") || null, businessAccountReference: text(form, "businessAccountReference") || null}, "Channel added.")}>
      <ConnectionFields view={view} /></FormDialog>}>
    {!view.connections.length ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No channel is set up. Website enquiries still arrive in the inbox.</p>
      : <ul className="space-y-3">{view.connections.map(connection => <li key={connection.id} className="space-y-2 rounded-lg border p-4" data-testid="inbox-connection">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-sm font-medium">{connection.displayName}</p><p className="text-xs text-muted-foreground">{connection.label}</p></div>
          <div className="flex flex-wrap items-center gap-1.5">
            {connection.simulator ? <Badge variant="destructive">Developer tools only</Badge> : <Badge variant="outline">{STATUS_LABELS[connection.connectionStatus] ?? connection.connectionStatus}</Badge>}
            {!connection.simulator && <Badge variant="outline">{connection.secretAvailable ? "Secret set on server" : "Secret not set on server"}</Badge>}
            <Badge variant={connection.canSend && !connection.simulator ? "secondary" : "outline"}>{!connection.canSend ? "Sending off" : connection.simulator ? "Sends to simulated conversations only"
              : connection.realCustomers?.sending ? "Sending on" : "Sending on (test recipients only)"}</Badge>
            {connection.realCustomers?.on && <Badge className={connection.realCustomers.sending ? "bg-emerald-600 text-white hover:bg-emerald-600" : ""} variant={connection.realCustomers.sending ? "default" : "outline"} data-testid="real-customers-badge">
              {connection.realCustomers.sending ? "Live: real customers" : "Real customers (not active)"}</Badge>}
          </div>
        </div>
        {!connection.simulator && <p className="text-xs text-muted-foreground">Account: {connection.externalAccountReference ?? "not set"} · Secret name: {connection.credentialReference ?? "not set"}
          {connection.verifyTokenName ? ` · Verify token secret: ${connection.verifyTokenName} (${connection.verifyTokenAvailable ? "set" : "not set"})` : ""}
          {connection.lastEventAt ? ` · Last verified event ${formatLeadDate(connection.lastEventAt, true)}` : ""}
          {connection.provider === "WHATSAPP_CLOUD" ? ` · Access token secret: ${connection.accessTokenReference ?? "not set"}${connection.accessTokenReference ? ` (${connection.accessTokenAvailable ? "set" : "not set"})` : ""}` : ""}
          {connection.provider === "WHATSAPP_CLOUD" ? ` · WhatsApp Business Account: ${connection.businessAccountReference ?? "not set (templates unavailable)"}` : ""}</p>}
        {connection.verifiedAt && <p className="text-xs" data-testid="connection-verified">Meta confirmed {connection.verifiedName ?? "this number"}{connection.verifiedDisplayNumber ? ` (${connection.verifiedDisplayNumber})` : ""} · {formatLeadDate(connection.verifiedAt, true)}</p>}
        {connection.realCustomers && <p className="text-xs text-muted-foreground" data-testid="whatsapp-mode">{connection.realCustomers.on
          ? `Real customers: approved replies and templates go to any customer (opt-outs and the do-not-contact list still apply)${connection.realCustomers.changedBy ? `. Switched on by ${connection.realCustomers.changedBy}` : ""}${connection.realCustomers.changedAt ? ` · ${formatLeadDate(connection.realCustomers.changedAt, true)}` : ""}.${connection.realCustomers.serverAllows ? "" : " This server does not allow real customers (INBOX_WHATSAPP_LIVE_SENDING), so nothing is sent."}`
          : connection.testMode?.configured
            ? `Test mode: this channel sends only to ${connection.testMode.testRecipients} test number${connection.testMode.testRecipients === 1 ? "" : "s"} (INBOX_WHATSAPP_TEST_RECIPIENTS).${connection.realCustomers.serverAllows ? " The company owner can switch it to real customers." : ""}`
            : `Test mode, with no test numbers set on this server (INBOX_WHATSAPP_TEST_RECIPIENTS).${connection.realCustomers.serverAllows ? " The company owner can switch it to real customers." : ""}`}</p>}
        {connection.webhookUrl && <p className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">Webhook address for the provider:</span><code className="break-all rounded bg-muted px-1.5 py-0.5">{connection.webhookUrl}</code>
          <Button variant="ghost" size="sm" onClick={() => copy(connection.webhookUrl!)} aria-label="Copy webhook address"><Copy aria-hidden="true" /></Button></p>}
        {!connection.webhookUrl && !connection.simulator && <p className="text-xs text-muted-foreground">EstateOS does not receive messages from this provider yet (planned with OAuth in Phase 7C). It accepts no webhooks for it.</p>}
        <Capabilities capabilities={connection.capabilities} />
        {!connection.simulator && <div className="flex flex-wrap gap-2">
          <FormDialog trigger="Edit" title="Edit channel" description="Saving does not contact the provider." submitLabel="Save"
            onSubmit={form => send(`/api/inbox/connections/${connection.id}`, "PUT", {expectedRevision: connection.revision, displayName: text(form, "displayName"), externalAccountReference: text(form, "externalAccountReference") || null, credentialReference: text(form, "credentialReference") || null, accessTokenReference: text(form, "accessTokenReference") || null, businessAccountReference: text(form, "businessAccountReference") || null}, "Channel saved. Check the connection again before sending.")}>
            <ConnectionFields view={view} connection={connection} /></FormDialog>
          <Button variant="outline" size="sm" onClick={() => void send(`/api/inbox/connections/${connection.id}/enabled`, "POST", {expectedRevision: connection.revision, enabled: connection.connectionStatus === "DISABLED"}, connection.connectionStatus === "DISABLED" ? "Channel enabled." : "Channel disabled; its webhooks are refused.").catch(() => undefined)}>
            {connection.connectionStatus === "DISABLED" ? "Enable" : "Disable"}</Button>
          {connection.provider === "WHATSAPP_CLOUD" && connection.connectionStatus !== "DISABLED" && <>
            <Button variant="outline" size="sm" onClick={() => void send(`/api/inbox/connections/${connection.id}/check`, "POST", {}, "Connection checked with Meta.").catch(() => undefined)}>Check connection</Button>
            {connection.connectionStatus === "VERIFIED" && <Button variant={connection.sendingEnabled ? "outline" : "default"} size="sm"
              onClick={() => void send(`/api/inbox/connections/${connection.id}/sending`, "POST", {expectedRevision: connection.revision, enabled: !connection.sendingEnabled},
                connection.sendingEnabled ? "Sending turned off." : "Sending turned on for test recipients.").catch(() => undefined)}>
              {connection.sendingEnabled ? "Turn sending off" : "Turn sending on"}</Button>}
            {connection.realCustomers?.canTurnOn && <FormDialog trigger="Switch to real customers" title="Send to real customers?" submitLabel="Switch to real customers"
              description="This channel will send to any customer, not only your test numbers. Every reply still needs a person to send it (and approval, if your company requires it)."
              onSubmit={form => send(`/api/inbox/connections/${connection.id}/live`, "POST", {expectedRevision: connection.revision, enabled: true, confirmed: form.get("confirmed") === "on"}, "This channel now sends to real customers.")}>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Meta charges for template messages (your WhatsApp account&apos;s payment method). There is a daily cost guard per channel.</li>
                <li>Customers who said STOP, and numbers on the do-not-contact list, are never messaged.</li>
                <li>Outside 24 hours after the customer&apos;s last message, only approved templates can be sent.</li>
              </ul>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmed" required className="mt-0.5 size-4 accent-primary" />
                I understand that messages will go to real customers and that Meta may charge for them.</label>
            </FormDialog>}
            {connection.realCustomers?.canTurnOff && <Button variant="outline" size="sm"
              onClick={() => void send(`/api/inbox/connections/${connection.id}/live`, "POST", {expectedRevision: connection.revision, enabled: false}, "Back to test numbers only.").catch(() => undefined)}>Back to test numbers</Button>}
          </>}
        </div>}
      </li>)}</ul>}
  </Section>;
}

export function InboxSettingsView({organizationId}: {organizationId: string}) {
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [connections, setConnections] = useState<ConnectionsView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => communicationsGet<SettingsView>("/api/inbox/settings", "Inbox settings could not be loaded.")
    .then(async rules => ({rules, channels: rules.canEdit ? await communicationsGet<ConnectionsView>("/api/inbox/connections", "Channels could not be loaded.") : null}))
    .then(({rules, channels}) => { setSettings(rules); setConnections(channels); setError(null); }, problem => setError(errorMessage(problem, "Inbox settings could not be loaded."))), []);
  useEffect(() => { void load(); }, [load]);

  /** Sends a change, then reloads so the page shows what was stored. */
  const send: Send = async (path, method, body, success) => {
    try { await communicationsSend(path, organizationId, method, body); toast.success(success); return true; }
    catch (problem) { toast.error(errorMessage(problem, "The change could not be saved.")); throw problem; }
    finally { void load(); }
  };

  if (error) return <div role="alert" className="space-y-3 rounded-xl border p-6"><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw aria-hidden="true" />Try again</Button></div>;
  if (!settings || (settings.canEdit && !connections)) return <div role="status" className="animate-pulse rounded-xl border p-6 text-sm text-muted-foreground">Loading inbox settings...</div>;
  return <div className="space-y-5">
    {!settings.canEdit && <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">These are your company&apos;s inbox rules. Only owners and administrators can change them or manage company channels; you can connect your own mailbox below.</p>}
    <RulesSection key={`rules-${settings.revision}`} settings={settings} send={send} />
    <MailboxesSection organizationId={organizationId} />
    {connections && <ConnectionsSection view={connections} send={send} />}
  </div>;
}
