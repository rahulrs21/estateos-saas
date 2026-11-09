"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { communicationsGet, communicationsSend, errorMessage } from "@/modules/communications/client";
import { LeadField, selectClassName } from "@/modules/leads/components/lead-ui";
import type { ConnectionsView } from "../server/connections";

/**
 * Starts a WhatsApp conversation from EstateOS (Phase 7B.1, owners and administrators):
 * a test recipient and an approved template, saved as a reply draft that is checked and
 * approved before it is sent. Shown only when a WhatsApp channel can send.
 */
export function StartWhatsAppConversation({organizationId}: {organizationId: string}) {
  const router = useRouter();
  const prefix = useId();
  const [channels, setChannels] = useState<ConnectionsView["connections"]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // Only owners and administrators can list channels; for everyone else this stays hidden.
    void communicationsGet<ConnectionsView>("/api/inbox/connections", "").then(view => setChannels(view.connections.filter(row => row.provider === "WHATSAPP_CLOUD" && row.canSend)), () => setChannels([]));
  }, []);
  if (!channels.length) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const result = await communicationsSend<{conversationId: string; existing: boolean}>("/api/inbox/whatsapp/start", organizationId, "POST", {
        connectionId: String(form.get("connectionId")), phone: String(form.get("phone") ?? ""), template: {name: String(form.get("templateName") ?? "").trim(), language: String(form.get("language") ?? "").trim()},
      });
      toast.success(result.existing ? "Template reply added to the existing conversation. Check it and request approval." : "Conversation started with a template reply draft. Check it and request approval.");
      setOpen(false);
      router.push(`/inbox/${result.conversationId}`);
    } catch (problem) { toast.error(errorMessage(problem, "The conversation could not be started.")); }
    finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
    <DialogTrigger render={<Button variant="outline" size="sm" />}><MessageSquarePlus aria-hidden="true" />Start WhatsApp conversation</DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Start a WhatsApp conversation</DialogTitle>
      <DialogDescription>Phase 7B.1 test mode: only the test recipients configured on the server. The first message must be a template approved in Meta&apos;s WhatsApp Manager; it is saved as a draft and sent only after approval. Meta may charge for template messages.</DialogDescription></DialogHeader>
      <form className="space-y-3" onSubmit={submit}>
        <LeadField id={`${prefix}-channel`} label="Channel"><select id={`${prefix}-channel`} name="connectionId" className={selectClassName}>
          {channels.map(channel => <option key={channel.id} value={channel.id}>{channel.displayName}{channel.verifiedDisplayNumber ? ` (${channel.verifiedDisplayNumber})` : ""}</option>)}</select></LeadField>
        <LeadField id={`${prefix}-phone`} label="Customer's WhatsApp number" hint="International format, for example +971 50 123 4567."><Input id={`${prefix}-phone`} name="phone" required maxLength={32} inputMode="tel" autoComplete="off" /></LeadField>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <LeadField id={`${prefix}-template`} label="Template name"><Input id={`${prefix}-template`} name="templateName" required defaultValue="hello_world" maxLength={100} /></LeadField>
          <LeadField id={`${prefix}-language`} label="Language"><Input id={`${prefix}-language`} name="language" required defaultValue="en_US" maxLength={6} /></LeadField>
        </div>
        <Button type="submit" disabled={busy}>{busy ? "Starting…" : "Save template draft"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
