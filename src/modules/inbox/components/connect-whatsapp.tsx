"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { communicationsGet, communicationsSend, errorMessage } from "@/modules/communications/client";
import { LeadField } from "@/modules/leads/components/lead-ui";
import { SIGNUP_PIN, parseSignupMessage, type SignupMessage } from "../embedded-signup";

/*
 * One-click "Connect WhatsApp" (Meta's Embedded Signup; docs/CHANNEL_ADAPTERS.md#embedded-signup). Meta's script is
 * loaded when the dialog opens, so the click opens Meta's popup directly (browsers block popups that are not opened by
 * a click). The popup's one-time code goes straight to EstateOS's server, which finishes the connection.
 */

type Setup = {enabled: boolean; appId: string | null; configId: string | null; graphVersion: string; missing: string[]};
type FacebookSdk = {
  init: (options: {appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string}) => void;
  login: (callback: (response: {authResponse?: {code?: string} | null}) => void, options: Record<string, unknown>) => void;
};
declare global { interface Window { FB?: FacebookSdk; fbAsyncInit?: () => void } }

const SDK_URL = "https://connect.facebook.net/en_US/sdk.js";

/** Loads Meta's SDK once (or uses one already on the page). */
function loadSdk(setup: Setup): Promise<FacebookSdk> {
  const ready = (sdk: FacebookSdk) => { sdk.init({appId: setup.appId!, autoLogAppEvents: true, xfbml: false, version: setup.graphVersion}); return sdk; };
  if (window.FB) return Promise.resolve(ready(window.FB));
  return new Promise((resolve, reject) => {
    window.fbAsyncInit = () => window.FB ? resolve(ready(window.FB)) : reject(new Error("Meta's sign-in did not load."));
    if (document.querySelector(`script[src="${SDK_URL}"]`)) return;
    const script = Object.assign(document.createElement("script"), {src: SDK_URL, async: true, defer: true, crossOrigin: "anonymous"});
    script.onerror = () => reject(new Error("Meta's sign-in could not be loaded. Check the connection or any ad blocker, then try again."));
    document.body.appendChild(script);
  });
}

export function ConnectWhatsApp({organizationId, onConnected}: {organizationId: string; onConnected: () => void}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [sdk, setSdk] = useState<FacebookSdk | null>(null);
  const [name, setName] = useState("Sales WhatsApp");
  const [pin, setPin] = useState("");
  const [pinAgain, setPinAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const session = useRef<SignupMessage | null>(null);

  useEffect(() => { void communicationsGet<Setup>("/api/inbox/whatsapp/connect", "Connect WhatsApp is unavailable.").then(setSetup, () => setSetup(null)); }, []);
  // Meta's script, when the dialog opens.
  useEffect(() => {
    if (!open || !setup?.enabled || sdk) return;
    let cancelled = false;
    loadSdk(setup).then(value => { if (!cancelled) setSdk(value); }, error => { if (!cancelled) setProblem(error instanceof Error ? error.message : "Meta's sign-in could not be loaded."); });
    return () => { cancelled = true; };
  }, [open, setup, sdk]);
  // What the popup reports (from Meta's pages only).
  useEffect(() => {
    if (!open) return;
    const listen = (event: MessageEvent) => { const message = parseSignupMessage(event.origin, event.data); if (message) session.current = message; };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [open]);

  if (!setup) return null;
  const pinProblem = pin && !SIGNUP_PIN.test(pin) ? "The PIN is 6 digits." : pinAgain && pin !== pinAgain ? "The two PINs differ." : null;
  const ready = Boolean(sdk) && SIGNUP_PIN.test(pin) && pin === pinAgain && name.trim().length >= 2 && !busy;

  async function finish(code: string) {
    // The popup's details may arrive just after its result: wait briefly for them.
    for (let waited = 0; !session.current && waited < 4000; waited += 200) await new Promise(resolve => setTimeout(resolve, 200));
    const message = session.current;
    if (message?.kind === "business_app") throw new Error("That number is used in the WhatsApp Business app. EstateOS connects a dedicated business number only, so the features on your phone stay as they are.");
    if (message?.kind !== "finish") throw new Error("Meta did not return a phone number. Choose or add your business number in the popup, then click Finish.");
    const result = await communicationsSend<{verified: boolean; notes: string[]}>("/api/inbox/whatsapp/connect", organizationId, "POST",
      {code, phoneNumberId: message.phoneNumberId, businessAccountId: message.businessAccountId, pin, displayName: name.trim()}, "WhatsApp could not be connected.");
    if (result.notes.length) toast.warning(`WhatsApp connected, with notes: ${result.notes.join(" ")}`, {duration: 15_000});
    else toast.success("WhatsApp connected and verified. Turn sending on in the channel when you are ready.");
  }

  function connect() {
    if (!sdk || !setup?.configId) return;
    setProblem(null); setBusy(true); session.current = null;
    sdk.login(response => {
      const code = response.authResponse?.code;
      const current = session.current as SignupMessage | null;
      if (!code) {
        setBusy(false);
        setProblem(current?.kind === "error" ? `Meta reported an error: ${current.message}` : "The Meta window was closed before finishing. Nothing was connected.");
        return;
      }
      void finish(code).then(() => { setOpen(false); setPin(""); setPinAgain(""); onConnected(); }, error => setProblem(errorMessage(error, "WhatsApp could not be connected."))).finally(() => setBusy(false));
    }, {config_id: setup.configId, response_type: "code", override_default_response_type: true, extras: {setup: {}}});
  }

  return <>
    <Button size="sm" onClick={() => setOpen(true)} disabled={!setup.enabled} title={setup.enabled ? undefined : `Not set up on this server yet (${setup.missing.join(", ")}).`} data-testid="connect-whatsapp">
      <MessageCircle aria-hidden="true" />Connect WhatsApp</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Connect WhatsApp</DialogTitle>
          <DialogDescription>Sign in with Facebook in Meta&apos;s window and choose your business phone number. Use a number for WhatsApp Business on EstateOS only, not one used in the WhatsApp app on a phone.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <LeadField id={`${prefix}-name`} label="Channel name"><Input id={`${prefix}-name`} value={name} onChange={event => setName(event.target.value)} maxLength={80} /></LeadField>
          <div className="grid gap-3 sm:grid-cols-2">
            <LeadField id={`${prefix}-pin`} label="6-digit PIN" hint="Your number's two-step verification PIN. Keep it safe."><Input id={`${prefix}-pin`} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" autoComplete="new-password" /></LeadField>
            <LeadField id={`${prefix}-pin-again`} label="PIN again"><Input id={`${prefix}-pin-again`} value={pinAgain} onChange={event => setPinAgain(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" autoComplete="new-password" /></LeadField>
          </div>
          {pinProblem && <p className="text-xs text-destructive">{pinProblem}</p>}
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Meta asks you to confirm your business and pick or add the number (a code is sent to that number).</li>
            <li>After connecting, add a payment method in WhatsApp Manager to send template messages.</li>
            <li>Sending stays off until you turn it on in the channel.</li>
          </ul>
          {problem && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{problem}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!ready} onClick={connect} data-testid="connect-whatsapp-start">{busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <MessageCircle aria-hidden="true" />}{!sdk && !problem ? "Loading Meta…" : "Continue with Facebook"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
