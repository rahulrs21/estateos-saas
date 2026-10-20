import type { Metadata } from "next";
import { Suspense } from "react";
import { Database, ShieldCheck } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { Brand } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { LogoutButton } from "@/modules/auth/components/logout-button";

export const metadata: Metadata = { title: "Company database setup", robots: { index: false, follow: false } };

async function DatabaseSetup() {
  await requireSession();
  const development = process.env.NODE_ENV === "development";
  return <div className="min-h-svh bg-background">
    <header className="flex items-center justify-between border-b bg-card px-5 py-5 sm:px-8"><Brand /><LogoutButton /></header>
    <main id="main-content" className="mx-auto max-w-2xl space-y-6 px-5 py-12">
      <Database className="size-10 text-primary" aria-hidden="true" />
      <h1 className="text-2xl font-semibold tracking-tight">Connect your company database</h1>
      <p className="text-sm leading-6 text-muted-foreground">Your sign-in is valid. The configured company database service or its operations could not be found. Your workspace will open once the connection is configured.</p>
      {development ? <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="Development setup">
        <h2 className="font-semibold">Develop locally</h2>
        <p className="text-sm leading-6 text-muted-foreground">Stop the current development server with Ctrl+C, then run this from the EstateOS folder:</p>
        <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm"><code>npm run dev:local</code></pre>
        <p className="text-sm leading-6 text-muted-foreground">This starts local SQL Connect and Next.js together. Keep the terminal open, then return to your dashboard. Your existing Firebase login still works; company records are stored locally.</p>
        <p className="text-sm leading-6 text-muted-foreground">For a hosted database, verify the Firebase project, service, region, connector and deployed CRM operations. Generating schema files locally does not publish them. Follow docs/SQL_CONNECT.md before any hosted migration.</p>
      </section> : <p role="status" className="rounded-xl border bg-card p-5 text-sm leading-6">Contact your workspace administrator to check the database service configuration, then try again.</p>}
      <form action="/workspace/dashboard" method="get"><Button type="submit">Check connection</Button></form>
      <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Workspace records stay unavailable until the database connection and active company membership can be verified.</p>
    </main>
  </div>;
}

export default function DatabaseSetupPage() {
  return <Suspense fallback={<main id="main-content" className="mx-auto max-w-2xl p-6"><PageSkeleton /></main>}><DatabaseSetup /></Suspense>;
}
