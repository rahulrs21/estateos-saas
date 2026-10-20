import Link from "next/link";
import { Activity, ArrowRight, CalendarCheck2, ChartNoAxesCombined, CircleDollarSign, GitBranch, Handshake, ListTodo, LockKeyhole, Plug, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/modules/dashboard/components/kpi-card";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function Dashboard({ companyName }: { companyName: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="A clear view of your agency. Everything starts here." eyebrow={companyName}>
        <Link href="/workspace/leads" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "bg-card px-4")}>Explore leads<ArrowRight aria-hidden="true" /></Link>
      </PageHeader>

      <section aria-labelledby="workspace-start-title" className="relative flex flex-col justify-between gap-5 overflow-hidden rounded-xl border border-primary/15 bg-secondary/50 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-card text-primary"><Plug className="size-5" aria-hidden="true" /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h2 id="workspace-start-title" className="text-base font-semibold">{companyName}</h2><Badge variant="outline" className="border-primary/20 text-[10px] text-primary">Company workspace</Badge></div>
            <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">Your company workspace is ready. Manage leads with your team; dashboard analytics will arrive in a future update.</p>
          </div>
        </div>
        <Link href="/settings/company" className="inline-flex shrink-0 items-center gap-2 self-start rounded text-sm font-semibold text-primary sm:self-center">Company settings<ArrowRight className="size-4" aria-hidden="true" /></Link>
      </section>

      <section aria-label="Agency key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total leads" icon={UsersRound} description="Lead metrics not connected" />
        <KpiCard title="Active deals" icon={Handshake} description="Deal data not connected" />
        <KpiCard title="Pipeline value" icon={CircleDollarSign} unit="AED" description="Pipeline data not connected" />
        <KpiCard title="Upcoming tasks" icon={CalendarCheck2} description="Task data not connected" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <Card className="gap-5 rounded-xl py-5 shadow-xs ring-border">
          <CardHeader className="px-5 sm:px-6"><CardTitle role="heading" aria-level={2}>Lead overview</CardTitle><CardDescription className="mt-1 text-xs">Understand how your pipeline grows over time.</CardDescription><CardAction><Badge variant="outline" className="text-[10px] text-muted-foreground">Not connected</Badge></CardAction></CardHeader>
          <CardContent className="px-5 sm:px-6">
            <div className="chart-grid relative flex min-h-60 items-center justify-center rounded-lg border-x border-b">
              <EmptyState icon={ChartNoAxesCombined} title="Your next opportunity starts here" description="Lead trends will appear when dashboard analytics are connected." className="relative mx-4 rounded-xl bg-card/95 py-6" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />Lead volume</span><span>Awaiting connected data</span></div>
          </CardContent>
        </Card>

        <Card className="rounded-xl py-5 shadow-xs ring-border">
          <CardHeader className="px-5 sm:px-6"><CardTitle role="heading" aria-level={2}>Deal pipeline</CardTitle><CardDescription className="mt-1 text-xs">From first conversation to closed deal.</CardDescription></CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center px-5 pt-3">
            <div className="flex size-32 items-center justify-center rounded-full border-[14px] border-muted" aria-hidden="true"><GitBranch className="size-7 text-muted-foreground/70" /></div>
            <h3 className="mt-5 text-sm font-semibold">A fresh pipeline</h3>
            <p className="mt-2 max-w-60 text-center text-xs leading-5 text-muted-foreground">Deal stages and values will appear after pipeline data is connected.</p>
            <Link href="/workspace/deals" className="mt-4 inline-flex items-center gap-1.5 rounded text-xs font-semibold text-primary">Explore deals<ArrowRight className="size-3.5" aria-hidden="true" /></Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="gap-0 rounded-xl py-5 shadow-xs ring-border">
          <CardHeader className="border-b px-5 pb-4 sm:px-6"><CardTitle role="heading" aria-level={2}>Recent activity</CardTitle><CardDescription className="mt-1 text-xs">Stay close to what’s happening in your agency.</CardDescription><CardAction><Activity className="size-4 text-muted-foreground" aria-hidden="true" /></CardAction></CardHeader>
          <CardContent className="px-2"><EmptyState icon={Activity} title="No activity to display" description="Your team’s updates will appear here after agency activity is connected." className="py-8" /></CardContent>
        </Card>
        <Card className="gap-0 rounded-xl py-5 shadow-xs ring-border">
          <CardHeader className="border-b px-5 pb-4 sm:px-6"><CardTitle role="heading" aria-level={2}>Upcoming tasks</CardTitle><CardDescription className="mt-1 text-xs">Keep the next step in sight.</CardDescription><CardAction><Link href="/workspace/tasks" className="inline-flex items-center gap-1 rounded text-xs font-medium text-primary">View tasks<ArrowRight className="size-3.5" aria-hidden="true" /></Link></CardAction></CardHeader>
          <CardContent className="px-2"><EmptyState icon={ListTodo} title="Your task list starts here" description="Follow-ups and viewings will appear when task management is connected." className="py-8" /></CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-2 rounded-lg px-1 text-xs leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><p>Company records are protected by your active membership and role. Dashboard metrics remain empty until analytics are connected.</p></div>
    </div>
  );
}
