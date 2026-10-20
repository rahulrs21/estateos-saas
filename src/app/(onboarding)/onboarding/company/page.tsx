import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Building2, MailCheck } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getCompanyWorkspace } from "@/modules/organizations/server/workspace";
import { CompanyForm } from "@/modules/organizations/components/company-form";
import { WorkspaceSwitcher } from "@/modules/organizations/components/workspace-switcher";
import { companyOnboardingState } from "@/modules/organizations/workspace-policy";
import { Brand } from "@/components/shared/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/modules/auth/components/logout-button";
import { PageSkeleton } from "@/components/shared/page-skeleton";

export const metadata: Metadata = { title: "Choose your workspace", robots: { index: false, follow: false } };

async function CompanyOnboarding({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireSession();
  const workspace = await getCompanyWorkspace();
  const parameters = await searchParams;
  const createAnother = parameters.new === "1";
  const state = companyOnboardingState(workspace, createAnother);
  if (state.redirect) redirect(state.redirect);
  const selectOnly = state.view === "select";
  const createCompany = state.view === "create";
  const title = createCompany
    ? (workspace.companies.length ? "Create another company." : "Set up your company.")
    : "Choose your company workspace.";
  const description = selectOnly
    ? "Open a company where you have an active membership."
    : createCompany
      ? "Tell us about your agency to start working in your own EstateOS workspace."
      : "Joining an existing team? Accept your invitation to open its workspace. You do not need to register a company.";
  return <div className="min-h-svh bg-background">
    <header className="flex min-h-20 items-center justify-between gap-4 border-b bg-card px-4 sm:px-8"><Link href="/"><Brand /></Link><div className="flex items-center gap-3"><ThemeToggle /><LogoutButton /></div></header>
    <main id="main-content" className="mx-auto max-w-3xl space-y-7 px-4 py-10 sm:py-14">
      <div className="space-y-3"><span className="flex size-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary"><Building2 aria-hidden="true" /></span><p className="break-all text-xs text-muted-foreground">Signed in as {user.email}{user.name && <span className="mt-1 block">{user.name}</span>}</p><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="text-sm leading-6 text-muted-foreground">{description}</p></div>
      {workspace.companies.length > 0 && <section aria-label="Your companies" className="rounded-xl border bg-card p-5"><WorkspaceSwitcher companies={workspace.companies} activeId={workspace.activeCompany?.id} />{workspace.activeCompany && <Link href="/workspace/dashboard" className="mt-4 inline-block rounded text-sm font-medium text-primary">Return to {workspace.activeCompany.name}</Link>}</section>}
      {selectOnly ? <p className="text-sm text-muted-foreground">Starting a separate agency? <Link href="/onboarding/company?new=1" className="rounded font-medium text-primary">Create a new company</Link></p> : createCompany ? <><CompanyForm /><Link href="/invite/accept" className="inline-block rounded text-sm font-medium text-primary">Invited to an existing company? Accept your invitation</Link></> : <div className="grid gap-4 sm:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-primary/20 bg-card p-6"><MailCheck className="size-6 text-primary" aria-hidden="true" /><h2 className="text-lg font-semibold">Join your team</h2><p className="text-sm leading-6 text-muted-foreground">Use the invitation from your company owner or administrator. Your assigned role becomes active after you accept.</p><Link href="/invite/accept" className="inline-block rounded text-sm font-semibold text-primary">Continue with invitation →</Link></section>
        <section className="space-y-4 rounded-xl border bg-card p-6"><Building2 className="size-6 text-muted-foreground" aria-hidden="true" /><h2 className="text-lg font-semibold">Start your own company</h2><p className="text-sm leading-6 text-muted-foreground">Create a separate workspace if you are setting up your own agency. You will be its owner.</p><Link href="/onboarding/company?new=1" className="inline-block rounded text-sm font-semibold text-primary">Create a company →</Link></section>
      </div>}
    </main>
  </div>;
}

export default function OnboardingPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<main id="main-content" className="mx-auto max-w-3xl p-6"><PageSkeleton /></main>}><CompanyOnboarding {...props} /></Suspense>;
}
