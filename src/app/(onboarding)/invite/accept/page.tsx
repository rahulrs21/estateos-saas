import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { MailCheck } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { Brand } from "@/components/shared/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { InvitationAccept } from "@/modules/organizations/components/invitation-accept";
import { getPendingCompanyInvitations } from "@/modules/organizations/server/pending-invitations";
import type { PendingCompanyInvitation } from "@/modules/organizations/types";

export const metadata: Metadata = { title: "Accept team invitation", robots: { index: false, follow: false }, referrer: "no-referrer" };
async function AcceptScreen() {
  await connection();
  const user = await getSession();
  let invitations: PendingCompanyInvitation[] = [];
  let discoveryError = "";
  if (user) {
    try { invitations = (await getPendingCompanyInvitations()).invitations; }
    catch { discoveryError = "We couldn't check your pending invitations. Try again shortly, or open your original invitation link to continue."; }
  }
  return <div className="min-h-svh bg-background"><header className="flex items-center justify-between border-b bg-card px-5 py-5 sm:px-8"><Brand /><ThemeToggle /></header><main id="main-content" className="mx-auto max-w-xl space-y-6 px-5 py-10"><MailCheck className="size-10 text-primary" aria-hidden="true" /><div><h1 className="text-2xl font-semibold tracking-tight">Join your company on EstateOS</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Invitation links are private, expire automatically and can be used once.</p></div><InvitationAccept user={user ? { email: user.email, name: user.name } : null} invitations={invitations} discoveryError={discoveryError} /></main></div>;
}
export default function AcceptInvitationPage() {
  return <Suspense fallback={<main id="main-content" className="mx-auto max-w-xl p-6"><PageSkeleton /></main>}><AcceptScreen /></Suspense>;
}
