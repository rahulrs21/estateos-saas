"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { communicationsGet, communicationsSend, errorMessage } from "@/modules/communications/client";
import { formatLeadDate, LeadField, selectClassName, textareaClassName } from "@/modules/leads/components/lead-ui";
import { CHANNEL_LABELS, type InboxChannel } from "../model";
import type { InboxSimulatorView } from "../server/simulator";

type Result = {status: string; conversationId?: string | null; match?: string; externalMessageId?: string; reason?: string};

/** Developer tools: simulated inbound WhatsApp and email messages and website enquiries (fictional senders only). */
export function InboxSimulator({organizationId, leads, onChanged}: {organizationId: string; leads: Array<{leadId: string; name: string}>; onChanged: () => void}) {
  const [view, setView] = useState<InboxSimulatorView | null>(null);
  const [channel, setChannel] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP");
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<{body: Record<string, unknown>; result: Result} | null>(null);
  const load = useCallback(() => communicationsGet<InboxSimulatorView>("/api/dev/communication-tests/inbox", "The inbox simulator could not be loaded.").then(setView, () => setView(null)), []);
  useEffect(() => { void load(); }, [load]);

  async function send(key: string, path: string, body: Record<string, unknown>) {
    setBusy(key);
    try {
      const result = await communicationsSend<Result>(path, organizationId, "POST", body, "The simulated message could not be stored.");
      setLast({body, result});
      toast.success(result.status === "DUPLICATE" ? "Duplicate delivery ignored." : "Simulated message stored.");
      onChanged();
    } catch (problem) { toast.error(errorMessage(problem, "The simulated message could not be stored.")); }
    finally { setBusy(null); void load(); }
  }
  async function inbound(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const leadId = String(form.get("leadId") ?? "");
    const file = form.get("file");
    let attachment: {fileName: string; dataBase64: string} | undefined;
    if (file instanceof File && file.size > 0) {
      // The server checks the content, whatever the name or type says; simulator files are limited to 2 MB.
      if (file.size > 2 * 1024 * 1024) { toast.error("Simulator attachments must be 2 MB or smaller."); return; }
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      attachment = {fileName: file.name, dataBase64: btoa(binary)};
    }
    void send("inbound", "/api/dev/communication-tests/inbox/inbound", {channel, ...(leadId ? {leadId} : {}), text: String(form.get("text") ?? ""),
      ...(channel === "EMAIL" ? {subject: String(form.get("subject") ?? "") || undefined} : {}), ...(attachment ? {attachment} : {})});
  }
  function website(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send("website", "/api/dev/communication-tests/inbox/website", {message: String(new FormData(event.currentTarget).get("message") ?? "")});
  }

  return <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><CardTitle role="heading" aria-level={2}>Inbox simulator</CardTitle>
    <CardDescription>Incoming messages through the real ingestion pipeline on the simulator connection, from fictional senders; website enquiries through the real public form path. Everything is labelled SIMULATED and nothing is delivered anywhere.</CardDescription></CardHeader>
    <CardContent className="space-y-5 px-5">
      <form onSubmit={event => void inbound(event)} className="grid gap-4 sm:grid-cols-2" aria-label="Simulate an incoming message">
        <LeadField id="sim-inbox-channel" label="Channel"><select id="sim-inbox-channel" className={selectClassName} value={channel} onChange={event => setChannel(event.target.value as "WHATSAPP" | "EMAIL")}>
          <option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option></select></LeadField>
        <LeadField id="sim-inbox-sender" label="Sender"><select id="sim-inbox-sender" name="leadId" className={selectClassName}>
          <option value="">Unknown sender (not on record)</option>{leads.map(lead => <option key={lead.leadId} value={lead.leadId}>{lead.name}</option>)}</select></LeadField>
        {channel === "EMAIL" && <LeadField id="sim-inbox-subject" label="Subject"><Input id="sim-inbox-subject" name="subject" maxLength={200} defaultValue="Question about a property" /></LeadField>}
        <div className="sm:col-span-2"><LeadField id="sim-inbox-text" label="Message"><textarea id="sim-inbox-text" name="text" required maxLength={4000} rows={3} className={textareaClassName}
          defaultValue="Hello, I am interested in a two-bedroom apartment. Is it still available?" /></LeadField></div>
        <div className="sm:col-span-2"><LeadField id="sim-inbox-file" label="Attachment (optional)" hint="An image, PDF, Office document, audio or video file up to 2 MB, checked by its content. Stored privately like a real attachment.">
          <Input id="sim-inbox-file" name="file" type="file" /></LeadField></div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy !== null}>{busy === "inbound" && <Loader2 aria-hidden className="animate-spin" />}Receive message</Button>
          <Button type="button" variant="outline" disabled={busy !== null || !last?.result.externalMessageId}
            onClick={() => last && void send("replay", "/api/dev/communication-tests/inbox/inbound", {...last.body, attachment: undefined, replayOf: last.result.externalMessageId})}>Deliver the last message again</Button>
        </div>
      </form>
      <form onSubmit={website} className="flex flex-wrap items-end gap-2" aria-label="Simulate a website enquiry">
        <div className="min-w-60 flex-1"><LeadField id="sim-inbox-web" label="Website enquiry message"><Input id="sim-inbox-web" name="message" required maxLength={4000} defaultValue="Please send me the payment plan for the Marina project." /></LeadField></div>
        <Button type="submit" variant="outline" disabled={busy !== null}>{busy === "website" && <Loader2 aria-hidden className="animate-spin" />}Submit website enquiry</Button>
      </form>
      {last && <p className="text-sm" data-testid="inbox-simulator-result">Result: <Badge variant="secondary">{last.result.status}</Badge>{last.result.match && <> · sender {last.result.match.toLowerCase()}</>}
        {last.result.conversationId && <> · <Link href={`/inbox/${last.result.conversationId}`} className="text-primary hover:underline">open in the inbox</Link></>}</p>}
      {view && view.conversations.length > 0 && <ul className="divide-y rounded-md border" aria-label="Simulated conversations">{view.conversations.map(row => <li key={row.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
        <Badge variant="destructive">SIMULATED</Badge><Link href={`/inbox/${row.id}`} className="font-medium text-primary hover:underline">{row.customerName ?? row.customerIdentity}</Link>
        <span className="text-muted-foreground">{CHANNEL_LABELS[row.channel as InboxChannel]} · {formatLeadDate(row.lastMessageAt, true)}{row.contactId ? "" : " · needs matching"}</span></li>)}</ul>}
    </CardContent></Card>;
}
