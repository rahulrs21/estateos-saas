"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { communicationsGet, communicationsSend, errorMessage } from "@/modules/communications/client";
import { formatLeadDate, LeadField } from "@/modules/leads/components/lead-ui";
import type { MailboxesView } from "../server/mailboxes";
import { FormDialog, Section, text } from "./settings-ui";

/*
 * Mailboxes connected with Google sign-in (Phase 7C, docs/EMAIL_INTEGRATION_PLAN.md).
 * EstateOS never asks for a mailbox password: Connect opens Google's own
 * consent screen, and the address Google confirms is the one connected.
 */

type Mailbox = MailboxesView["company"][number];

const SYNC_LABELS: Record<string, string> = {ACTIVE: "Importing", RESYNC: "Catching up", NEEDS_RECONNECT: "Reconnect needed", DISCONNECTED: "Disconnected"};
const FAILURES: Record<string, string> = {
  CANCELLED: "Google sign-in was cancelled, so nothing was connected.",
  STATE_EXPIRED: "The sign-in took too long. Connect again.",
  GOOGLE_SCOPES_MISSING: "EstateOS needs permission both to read and to send email. Connect again and leave both boxes ticked.",
  GOOGLE_NO_REFRESH_TOKEN: "Google did not grant lasting access. Remove EstateOS from your Google account's third-party access, then connect again.",
  ADDRESS_TAKEN: "That mailbox is already connected to EstateOS (each mailbox can be connected once).",
  WRONG_MAILBOX: "You signed in to a different mailbox than the one being reconnected.",
  ALREADY_CONNECTED: "You already have a connected mailbox. Disconnect it first.",
  NOT_ALLOWED: "Your role does not allow connecting this mailbox.",
  LIMIT: "This company already has the maximum number of company channels.",
  NO_KEY: "The server cannot store mailbox sign-ins safely yet (no encryption key).",
};

function ConnectDialog({organizationId, kind, mailbox, disabled}: {organizationId: string; kind: "COMPANY" | "PERSONAL"; mailbox?: Mailbox; disabled: boolean}) {
  const prefix = useId();
  const reconnect = Boolean(mailbox);
  return <FormDialog trigger={reconnect ? "Reconnect" : <><Mail aria-hidden="true" />{kind === "COMPANY" ? "Connect company Gmail" : "Connect my Gmail"}</>}
    title={reconnect ? "Reconnect mailbox" : kind === "COMPANY" ? "Connect a company Gmail mailbox" : "Connect your Gmail"}
    description="You will sign in on Google's own page. EstateOS never asks for your password and never sees it." submitLabel="Continue to Google"
    onSubmit={async form => {
      if (disabled) throw new Error("This server is not ready to connect mailboxes yet.");
      const data = await communicationsSend<{authorizationUrl: string}>("/api/inbox/mailboxes/google/start", organizationId, "POST",
        {kind, displayName: text(form, "displayName"), connectionId: mailbox?.id ?? null});
      window.location.assign(data.authorizationUrl);
      return false;
    }}>
    <LeadField id={`${prefix}-name`} label="Name" hint={kind === "COMPANY" ? "For example Sales mailbox. Shown to your team." : "For example My Gmail."}>
      <Input id={`${prefix}-name`} name="displayName" required minLength={2} maxLength={80} defaultValue={mailbox?.displayName ?? (kind === "COMPANY" ? "Sales mailbox" : "My Gmail")} /></LeadField>
    <p className="rounded-lg border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
      {kind === "COMPANY"
        ? "Customer emails arriving in this mailbox appear in the inbox. Spam, promotions, newsletters and automatic notifications are skipped."
        : "Only emails from people already in EstateOS (a contact) are imported, plus later replies in those threads. Your other email never enters EstateOS. Imported conversations are assigned to you and follow the normal inbox rules."}
      {" "}EstateOS asks Google for permission to read and to send email; replies are still sent only after approval.</p>
  </FormDialog>;
}

function MailboxRow({mailbox, organizationId, reload, ready}: {mailbox: Mailbox; organizationId: string; reload: () => void; ready: boolean}) {
  const act = async (path: string, body: unknown, success: string) => {
    try { await communicationsSend(path, organizationId, "POST", body); toast.success(success); }
    catch (problem) { toast.error(errorMessage(problem, "The change could not be saved.")); }
    finally { reload(); }
  };
  const status = mailbox.connectionStatus === "DISABLED" ? "Disconnected" : mailbox.syncState === "NEEDS_RECONNECT" || mailbox.connectionStatus === "ERROR" ? "Reconnect needed" : mailbox.connectionStatus === "VERIFIED" ? "Connected" : "Not connected";
  return <li className="space-y-2 rounded-lg border p-4" data-testid="mailbox">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0"><p className="text-sm font-medium">{mailbox.displayName}</p>
        <p className="break-all text-xs text-muted-foreground">{mailbox.address ?? "No address"}{mailbox.personal ? ` · Personal mailbox of ${mailbox.mine ? "you" : mailbox.owner}` : " · Company mailbox"}</p></div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={status === "Connected" ? "secondary" : "outline"} data-testid="mailbox-status">{status}</Badge>
        <Badge variant={mailbox.sendingEnabled ? "secondary" : "outline"}>{mailbox.sendingEnabled ? "Sending on (test recipients only)" : "Sending off"}</Badge>
      </div>
    </div>
    {mailbox.connectionStatus !== "DISABLED" && <p className="text-xs text-muted-foreground">
      {mailbox.syncState ? `${SYNC_LABELS[mailbox.syncState] ?? mailbox.syncState}` : "Waiting for the first import"}
      {mailbox.lastSyncedAt ? ` · Last checked ${formatLeadDate(mailbox.lastSyncedAt, true)}` : ""}
      {mailbox.lastErrorCode ? ` · Last problem: ${mailbox.lastErrorCode}` : ""}</p>}
    {mailbox.personal && mailbox.ownerActive === false && <p className="text-xs text-destructive">The owner is no longer an active member: this mailbox is no longer imported.</p>}
    <div className="flex flex-wrap gap-2">
      {mailbox.can.check && <Button variant="outline" size="sm" onClick={() => void act(`/api/inbox/mailboxes/${mailbox.id}/sync`, {}, "Mailbox checked.")}><RefreshCw aria-hidden="true" />Check now</Button>}
      {mailbox.can.reconnect && <ConnectDialog organizationId={organizationId} kind={mailbox.personal ? "PERSONAL" : "COMPANY"} mailbox={mailbox} disabled={!ready} />}
      {mailbox.can.sendingOn && !mailbox.sendingEnabled && <Button variant="outline" size="sm" onClick={() => void act(`/api/inbox/mailboxes/${mailbox.id}/sending`, {expectedRevision: mailbox.revision, enabled: true}, "Sending turned on for test recipients.")}>Turn sending on</Button>}
      {mailbox.can.sendingOff && <Button variant="outline" size="sm" onClick={() => void act(`/api/inbox/mailboxes/${mailbox.id}/sending`, {expectedRevision: mailbox.revision, enabled: false}, "Sending turned off.")}>Turn sending off</Button>}
      {mailbox.can.disconnect && <Button variant="outline" size="sm" onClick={() => {
        if (window.confirm(`Disconnect ${mailbox.address ?? "this mailbox"}? EstateOS stops importing and sending, and Google's permission is withdrawn. Conversations already imported stay.`)) {
          void act(`/api/inbox/mailboxes/${mailbox.id}/disconnect`, {expectedRevision: mailbox.revision}, "Mailbox disconnected.");
        }
      }}>Disconnect</Button>}
    </div>
  </li>;
}

export function MailboxesSection({organizationId}: {organizationId: string}) {
  const [view, setView] = useState<MailboxesView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => communicationsGet<MailboxesView>("/api/inbox/mailboxes", "Mailboxes could not be loaded.")
    .then(data => { setView(data); setError(null); }, problem => setError(errorMessage(problem, "Mailboxes could not be loaded."))), []);
  useEffect(() => { void load(); }, [load]);
  // The result of Google's sign-in (the callback returns here with a code, never a message or a token).
  const params = useSearchParams();
  const result = params.get("mailbox");
  const notice = result === "connected" ? {ok: true, message: "Mailbox connected. New emails are imported within a minute."}
    : result === "failed" ? {ok: false, message: FAILURES[params.get("reason") ?? ""] ?? "The mailbox was not connected. Try again."} : null;

  if (error) return <Section title="Email mailboxes" description="Gmail mailboxes connected with Google sign-in."><div role="alert" className="space-y-3"><p className="text-sm text-destructive">{error}</p>
    <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw aria-hidden="true" />Try again</Button></div></Section>;
  if (!view) return <div role="status" className="animate-pulse rounded-xl border p-6 text-sm text-muted-foreground">Loading mailboxes...</div>;
  const ready = view.setup.googleConfigured && view.setup.vaultConfigured;
  const mine = view.personal.filter(mailbox => mailbox.mine);
  const others = view.personal.filter(mailbox => !mailbox.mine);
  const hasOwn = mine.some(mailbox => mailbox.connectionStatus !== "DISABLED");
  return <Section title="Email mailboxes" description="Gmail mailboxes connected with Google sign-in. EstateOS never asks for, sees or stores a mailbox password."
    action={<div className="flex flex-wrap gap-2">{view.canConnectCompany && <ConnectDialog organizationId={organizationId} kind="COMPANY" disabled={!ready} />}
      {!hasOwn && <ConnectDialog organizationId={organizationId} kind="PERSONAL" disabled={!ready} />}</div>}>
    <div className="space-y-4" id="mailboxes">
      {notice && <p role={notice.ok ? "status" : "alert"} data-testid="mailbox-notice" className={notice.ok ? "rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary" : "rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"}>{notice.message}</p>}
      {!ready && <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground" data-testid="mailbox-setup">
        Mailboxes cannot be connected on this server yet: {!view.setup.googleConfigured ? "Google sign-in is not set up (INBOX_GOOGLE_CLIENT_ID and INBOX_GOOGLE_CLIENT_SECRET)" : ""}{!view.setup.googleConfigured && !view.setup.vaultConfigured ? " and " : ""}{!view.setup.vaultConfigured ? "there is no encryption key for sign-ins (INBOX_TOKEN_ENCRYPTION_KEY)" : ""}.</p>}
      <p className="text-xs text-muted-foreground">{view.setup.sendingConfigured
        ? `Phase 7C.1 test mode: email is sent only to ${view.setup.testRecipients} test address${view.setup.testRecipients === 1 ? "" : "es"} (INBOX_EMAIL_TEST_RECIPIENTS), and each reply needs approval.`
        : "Email sending is off on this server: no test addresses are set (INBOX_EMAIL_TEST_RECIPIENTS). Mailboxes can still be connected and imported."}</p>
      {view.canConnectCompany && <div className="space-y-2"><h3 className="text-sm font-medium">Company mailboxes</h3>
        {view.company.length ? <ul className="space-y-3">{view.company.map(mailbox => <MailboxRow key={mailbox.id} mailbox={mailbox} organizationId={organizationId} reload={() => void load()} ready={ready} />)}</ul>
          : <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No company mailbox is connected.</p>}</div>}
      <div className="space-y-2"><h3 className="text-sm font-medium">Your mailbox</h3>
        {mine.length ? <ul className="space-y-3">{mine.map(mailbox => <MailboxRow key={mailbox.id} mailbox={mailbox} organizationId={organizationId} reload={() => void load()} ready={ready} />)}</ul>
          : <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">You have not connected a mailbox. Connecting your Gmail imports emails from your CRM customers only.</p>}</div>
      {others.length > 0 && <div className="space-y-2"><h3 className="text-sm font-medium">Members&apos; personal mailboxes</h3>
        <p className="text-xs text-muted-foreground">Administrators can see that these are connected and can disconnect them (for example when someone leaves). Only the owner can send through their mailbox.</p>
        <ul className="space-y-3">{others.map(mailbox => <MailboxRow key={mailbox.id} mailbox={mailbox} organizationId={organizationId} reload={() => void load()} ready={ready} />)}</ul></div>}
    </div>
  </Section>;
}
