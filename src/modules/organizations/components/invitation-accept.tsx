"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { AuthForm } from "@/modules/auth/components/auth-form";
import { logout } from "@/modules/auth/client";
import type { AuthFormMode } from "@/modules/auth/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseInvitationFragment, parseInvitationUrl } from "../invitation-link";
import { companyRequest } from "../client";
import type { PendingCompanyInvitation } from "../types";

const subscribe = (notify: () => void) => { window.addEventListener("hashchange", notify); return () => window.removeEventListener("hashchange", notify); };
const snapshot = () => window.location.hash;
const serverSnapshot = () => "";

export function InvitationAccept({ user, invitations = [], discoveryError = "" }: { user: { email: string; name?: string } | null; invitations?: PendingCompanyInvitation[]; discoveryError?: string }) {
  const fragment = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const invitation = parseInvitationFragment(fragment);
  const [mode, setMode] = useState<AuthFormMode>("login");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  function loadInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const value = String(new FormData(event.currentTarget).get("invitationLink") ?? "");
    const parsed = parseInvitationUrl(value, window.location.origin);
    if (!parsed) { setError("Paste the complete EstateOS invitation link for this site, including everything after #."); return; }
    setError("");
    event.currentTarget.reset();
    window.location.hash = new URLSearchParams(parsed).toString();
  }
  async function accept() {
    if (!invitation || pending) return;
    setPending(true); setError("");
    try {
      await companyRequest("/api/invitations/accept", "POST", invitation);
      setSuccess("Invitation accepted. Opening your company workspace…");
      window.history.replaceState(null, "", "/invite/accept");
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Clear the previous company and authentication route tree.
      window.location.assign("/workspace/dashboard");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "This invitation could not be accepted."); setPending(false); }
  }
  async function changeAccount() {
    if (pending) return;
    setPending(true); setError("");
    try { await logout(); window.location.replace("/invite/accept" + window.location.hash); }
    catch { setError("Sign-out could not be completed. Try again."); setPending(false); }
  }
  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    {success && <p role="status" className="rounded-lg border bg-secondary p-4 text-sm">{success}</p>}
    {!invitation && <>
      {discoveryError && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{discoveryError}</p>}
      {user && invitations.length > 0 ? <section aria-labelledby="pending-invitations" className="space-y-4 rounded-xl border bg-card p-5">
        <h2 id="pending-invitations" className="font-semibold">You have a company invitation</h2>
        <p className="text-sm leading-6 text-muted-foreground">Your company administrator has invited you to join their workspace. Accept the invitation using the link they sent. You do not need to register a company.</p>
        <ul className="divide-y">{invitations.map(item => <li key={item.id} className="py-3"><p className="break-words text-sm font-medium">{item.organization.name}</p><p className="mt-1 text-xs text-muted-foreground">Invited role: {item.role.toLowerCase()} · Expires {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Dubai" }).format(new Date(item.expiresAt))}</p></li>)}</ul>
        <p className="text-xs leading-5 text-muted-foreground">If the link is missing or expired, ask the company administrator to reissue it. Signing in alone does not accept an invitation.</p>
      </section> : <p role="status" className="rounded-lg border bg-card p-4 text-sm leading-6 text-muted-foreground">Open the complete invitation link from your email or development preview. You do not need to create a company to join an existing team.</p>}
      {user && <form onSubmit={loadInvitation} className="space-y-3 rounded-xl border bg-card p-5">
        <Label htmlFor="invitation-link">Invitation link from your email</Label>
        <Input id="invitation-link" name="invitationLink" type="url" required maxLength={4096} autoComplete="off" spellCheck={false} aria-describedby="invitation-link-help" placeholder="Paste your complete invitation link" disabled={pending} />
        <p id="invitation-link-help" className="text-xs leading-5 text-muted-foreground">Paste the private link your administrator sent, then review and accept the invitation.</p>
        <Button type="submit" variant="outline" disabled={pending}>Continue with invitation</Button>
      </form>}
    </>}
    {user ? <div className="space-y-5 rounded-xl border bg-card p-5"><p className="break-all text-sm">Signed in as <strong>{user.email}</strong></p><p className="text-sm leading-6 text-muted-foreground">Use the verified email address that received the invitation. Accepting joins that company with the role authorized by its administrator.</p><div className="flex flex-wrap gap-3"><Button onClick={accept} disabled={!invitation || pending}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}Accept invitation</Button><Button variant="outline" onClick={changeAccount} disabled={pending}>Use a different account</Button></div></div> :
      <div className="rounded-xl border bg-card p-5 sm:p-6"><p className="text-sm leading-6 text-muted-foreground">Sign in or create an account with the invited email. If you register, verify your email and return to this invitation to sign in and accept it. Your profile is set up when you accept; you do not need to create a company.</p>
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Account options">{([["login", "Log in"], ["signup", "Create account"], ["verify", "Resend verification"], ["reset", "Reset password"]] as const).map(([value, label]) => <Button key={value} type="button" size="sm" variant={mode === value ? "secondary" : "ghost"} onClick={() => setMode(value)} aria-pressed={mode === value}>{label}</Button>)}</div>
        <AuthForm key={mode} mode={mode} invitationFlow onModeChange={setMode} />
      </div>}
    {user && <div className="flex flex-wrap gap-x-5 gap-y-3 text-xs"><Link href="/workspace/dashboard" className="rounded font-medium text-primary">Open my workspace</Link><Link href="/onboarding/company?new=1" className="rounded text-muted-foreground underline-offset-4 hover:underline">Create a separate company</Link></div>}
  </div>;
}
