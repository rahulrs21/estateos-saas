"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { communicationsGet, communicationsSend, errorMessage } from "@/modules/communications/client";
import { LeadField, selectClassName } from "@/modules/leads/components/lead-ui";
import type { ConnectionsView } from "../server/connections";
import { TemplatePicker, type ChosenTemplate } from "./template-picker";

/**
 * Starts a WhatsApp conversation from EstateOS (owners and administrators): a customer's number and an
 * approved template chosen from the WhatsApp account (Phase 7B.2), saved as a reply draft that goes through
 * the normal checks (and approval, when the company requires it) before it is sent. Shown only when a
 * WhatsApp channel can send; in test mode only to the server's test numbers.
 */
export function StartWhatsAppConversation({organizationId, me}: {organizationId: string; me: {name: string; company: string}}) {
  const router = useRouter();
  const prefix = useId();
  const [channels, setChannels] = useState<ConnectionsView["connections"]>([]);
  const [channelId, setChannelId] = useState("");
  const [phone, setPhone] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // Only owners and administrators can list channels; for everyone else this stays hidden.
    void communicationsGet<ConnectionsView>("/api/inbox/connections", "").then(view => {
      const usable = view.connections.filter(row => row.provider === "WHATSAPP_CLOUD" && row.canSend);
      setChannels(usable);
      setChannelId(current => current || usable[0]?.id || "");
    }, () => setChannels([]));
  }, []);
  if (!channels.length) return null;
  const channel = channels.find(row => row.id === channelId) ?? channels[0];

  async function start(template: ChosenTemplate) {
    if (phone.replace(/\D/g, "").length < 6) { toast.error("Enter the customer's WhatsApp number in international format, for example +971 50 123 4567."); return; }
    setBusy(true);
    try {
      const result = await communicationsSend<{conversationId: string; existing: boolean}>("/api/inbox/whatsapp/start", organizationId, "POST", {connectionId: channel.id, phone, template});
      toast.success(result.existing ? "Template reply added to the existing conversation. Check it, then send." : "Conversation started with a template reply. Check it, then send.");
      setOpen(false);
      setPhone("");
      router.push(`/inbox/${result.conversationId}`);
    } catch (problem) { toast.error(errorMessage(problem, "The conversation could not be started.")); }
    finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
    <DialogTrigger render={<Button variant="outline" size="sm" />}><MessageSquarePlus aria-hidden="true" />Start WhatsApp conversation</DialogTrigger>
    <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Start a WhatsApp conversation</DialogTitle>
      <DialogDescription>WhatsApp lets a business start a conversation only with a template approved in WhatsApp Manager. It is saved as a reply in the new conversation, checked, and sent from there. Meta may charge for template messages.</DialogDescription></DialogHeader>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <LeadField id={`${prefix}-channel`} label="Channel"><select id={`${prefix}-channel`} name="connectionId" className={selectClassName} value={channel.id} onChange={event => setChannelId(event.target.value)}>
            {channels.map(item => <option key={item.id} value={item.id}>{item.displayName}{item.verifiedDisplayNumber ? ` (${item.verifiedDisplayNumber})` : ""}</option>)}</select></LeadField>
          <LeadField id={`${prefix}-phone`} label="Customer's WhatsApp number" hint="International format, for example +971 50 123 4567.">
            <Input id={`${prefix}-phone`} name="phone" required maxLength={32} inputMode="tel" autoComplete="off" value={phone} onChange={event => setPhone(event.target.value)} /></LeadField>
        </div>
        <TemplatePicker key={channel.id} source={`/api/inbox/connections/${channel.id}/templates`} submitLabel={busy ? "Starting…" : "Start conversation"} busy={busy}
          quickFills={[{label: "Your name", value: me.name}, {label: "Company", value: me.company}]} onSubmit={start} />
      </div>
    </DialogContent>
  </Dialog>;
}
