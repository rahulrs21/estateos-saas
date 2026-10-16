import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  CircleDashed,
  Command,
  LayoutDashboard,
  PanelsTopLeft,
  Sparkles,
  UsersRound,
  Workflow,
} from "lucide-react";

import { Brand } from "@/components/shared/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { MobileNavigation } from "@/modules/marketing/components/mobile-navigation";
import { cn } from "@/lib/utils";

const productAreas = [
  {
    icon: UsersRound,
    title: "Relationships, connected.",
    description:
      "A planned home for every lead, contact and conversation, with a clear path from first enquiry to closing.",
    detail: "Leads · Contacts · Communications",
  },
  {
    icon: Building2,
    title: "Your inventory. In perspective.",
    description:
      "Bring developers, projects and properties into one connected view of your agency’s real estate business.",
    detail: "Developers · Projects · Properties",
  },
  {
    icon: Workflow,
    title: "A better rhythm for your team.",
    description:
      "Give agents a focused place for daily work, with future tools for deals, tasks, automation and reporting.",
    detail: "Agents · Deals · Tasks · Reports",
  },
];

function WorkspaceIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-2xl py-5 lg:py-12">
      <div className="absolute inset-x-8 inset-y-10 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_24px_90px_-30px_rgba(16,65,53,0.24)]">
        <div className="flex h-11 items-center gap-1.5 border-b bg-muted/40 px-4" aria-hidden="true">
          <span className="size-2 rounded-full bg-foreground/15" />
          <span className="size-2 rounded-full bg-foreground/15" />
          <span className="size-2 rounded-full bg-foreground/15" />
          <span className="mx-auto flex items-center gap-1.5 rounded-md border bg-background px-7 py-1 text-[10px] text-muted-foreground">
            <Command className="size-2.5" /> estateos / workspace
          </span>
        </div>
        <div className="flex min-h-80 sm:min-h-96">
          <div className="hidden w-14 shrink-0 flex-col items-center gap-5 border-r bg-muted/25 py-5 sm:flex" aria-hidden="true">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Building2 className="size-4" /></span>
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><LayoutDashboard className="size-4" /></span>
            <UsersRound className="size-4 text-muted-foreground/60" />
            <Building2 className="size-4 text-muted-foreground/60" />
            <PanelsTopLeft className="size-4 text-muted-foreground/60" />
            <Workflow className="size-4 text-muted-foreground/60" />
          </div>
          <div className="min-w-0 flex-1 p-5 sm:p-7">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <p className="mb-1 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">A clearer working day</p>
                <p className="text-lg font-semibold tracking-tight">Your agency, at a glance.</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-semibold tracking-wide text-primary uppercase">UI preview</span>
            </div>
            <div className="mb-5 grid grid-cols-3 gap-2.5">
              {["Your pipeline", "Your portfolio", "Your team"].map((label) => (
                <div key={label} className="rounded-lg border bg-background/60 px-3 py-4">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="mt-2 text-xl text-foreground/35" aria-label="No data">—</p>
                  <div className="mt-2 h-1 w-9 rounded bg-primary/15" aria-hidden="true" />
                </div>
              ))}
            </div>
            <div className="rounded-xl border bg-background/50 p-4">
              <div className="flex items-center justify-between text-xs font-medium">
                A place for your next opportunity
                <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="flex flex-col items-center py-7 text-center">
                <span className="mb-3 flex size-9 items-center justify-center rounded-full border border-dashed border-primary/35 bg-primary/5 text-primary"><CircleDashed className="size-4" aria-hidden="true" /></span>
                <p className="text-xs font-medium">Space to build something great.</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Your agency data will belong here.</p>
              </div>
            </div>
            <p className="mt-4 text-center text-[10px] text-muted-foreground">Frontend foundation · No business data connected</p>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-1 right-4 flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg shadow-primary/5 sm:right-8">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Check className="size-4" aria-hidden="true" /></span>
        <div><p className="text-xs font-semibold">Designed around your day</p><p className="mt-0.5 text-[10px] text-muted-foreground">Built with UAE agencies in mind</p></div>
      </div>
    </div>
  );
}

export function MarketingHome() {
  return (
    <div className="min-h-screen bg-background">
      <header className="relative z-20 border-b border-border/70 bg-background/95">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" aria-label="EstateOS home"><Brand /></Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground lg:flex" aria-label="Main navigation">
            <a href="#platform" className="transition-colors hover:text-foreground">The platform</a>
            <a href="#built-for-you" className="transition-colors hover:text-foreground">Built for your agency</a>
            <Link href="/workspace/dashboard" className="transition-colors hover:text-foreground">Workspace</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className={cn(buttonVariants({ variant: "ghost", className: "h-10 px-4" }))}>Log in</Link>
              <Link href="/signup" className={cn(buttonVariants({ className: "h-10 gap-2 px-4" }))}>Get started <ArrowRight className="size-4" aria-hidden="true" /></Link>
            </div>
            <div className="lg:hidden"><MobileNavigation /></div>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="relative overflow-hidden border-b">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_30%,var(--color-primary)_0%,transparent_60%)] opacity-[0.035]" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pt-16 pb-20 sm:px-8 sm:pt-20 lg:grid-cols-[1fr_1.05fr] lg:gap-12 lg:pt-20 lg:pb-24">
            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                An ambitious vision. A thoughtful foundation.
              </div>
              <h1 className="max-w-xl text-[2.6rem] leading-[1.08] font-semibold tracking-[-0.055em] sm:text-6xl xl:text-[4.5rem]">
                Every relationship.<br />Every opportunity.<br /><span className="text-primary">One workspace.</span>
              </h1>
              <p className="mt-7 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                Meet EstateOS. A connected CRM vision for UAE real estate agencies — designed to bring your people, properties and possibilities together.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/workspace/dashboard" className={cn(buttonVariants({ className: "h-12 gap-3 px-5" }))}>Explore the workspace <ArrowRight className="size-4" aria-hidden="true" /></Link>
                <a href="#platform" className={cn(buttonVariants({ variant: "outline", className: "h-12 gap-3 px-5" }))}>Discover the vision <ArrowDown className="size-4" aria-hidden="true" /></a>
              </div>
              <p className="mt-5 text-xs leading-5 text-muted-foreground">Verified sign-in is available. Agency setup and business features are still taking shape.</p>
            </div>
            <WorkspaceIllustration />
          </div>
          <div className="border-t bg-card/60">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5 py-5 text-xs text-muted-foreground sm:justify-between sm:px-8">
              <span className="font-medium tracking-wide text-foreground">PURPOSE-BUILT FOR WHAT’S NEXT</span>
              <span className="flex items-center gap-2"><Building2 className="size-4 text-primary" aria-hidden="true" /> UAE real estate</span>
              <span className="flex items-center gap-2"><UsersRound className="size-4 text-primary" aria-hidden="true" /> Agency-first design</span>
              <span className="flex items-center gap-2"><PanelsTopLeft className="size-4 text-primary" aria-hidden="true" /> One connected vision</span>
            </div>
          </div>
        </section>

        <section id="platform" className="scroll-mt-8 mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div><p className="mb-3 text-xs font-semibold tracking-[0.18em] text-primary uppercase">The platform vision</p><h2 className="max-w-xl text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">Less scattered work.<br />More room to move forward.</h2></div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">One thoughtfully planned platform for the people, inventory and operations behind your agency. Business modules are on the roadmap.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {productAreas.map(({ icon: Icon, title, description, detail }) => (
              <article key={title} className="rounded-2xl border bg-card p-7">
                <span className="mb-8 flex size-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/5 text-primary"><Icon className="size-5" aria-hidden="true" /></span>
                <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
                <p className="mt-7 border-t pt-5 text-xs font-medium text-muted-foreground">{detail}</p>
                <span className="mt-3 inline-flex rounded-md bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Planned</span>
              </article>
            ))}
          </div>
        </section>

        <section id="built-for-you" className="scroll-mt-8 border-y bg-card">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[0.8fr_1fr] md:items-center md:gap-20 sm:py-20">
            <div className="relative overflow-hidden rounded-2xl bg-[#113e35] px-8 pt-9 pb-0 text-white sm:px-10">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-100/75"><span className="size-1.5 rounded-full bg-emerald-300" aria-hidden="true" /> A regional focus. A broader vision.</div>
              <p className="relative z-10 mt-6 max-w-xs text-3xl leading-tight font-medium tracking-tight">Built for the ambition<br />of UAE real estate.</p>
              <div className="relative mt-10 flex h-40 items-end justify-center gap-3" aria-hidden="true">
                {["h-20 w-12", "h-28 w-14", "h-36 w-10", "h-24 w-16", "h-32 w-12", "h-16 w-12"].map((style, index) => (
                  <div key={style} className={`${style} rounded-t-sm border border-white/10 bg-gradient-to-t from-white/10 to-white/5 p-2`}>
                    <div className="grid grid-cols-2 gap-1.5">{Array.from({ length: index % 2 ? 8 : 6 }).map((_, window) => <span key={window} className="h-1 bg-emerald-200/15" />)}</div>
                  </div>
                ))}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#113e35] to-transparent" />
              </div>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-primary uppercase">Built for your agency</p>
              <h2 className="max-w-lg text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">A strong foundation.<br />A clear way forward.</h2>
              <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground">Great agency software starts with a calm, intuitive workspace. We’re building EstateOS in deliberate phases, beginning with the experience your team will use every day.</p>
              <ul className="mt-6 space-y-4 text-sm">
                <li className="flex items-start gap-3"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><span>Responsive workspace, from the office to the viewing.</span></li>
                <li className="flex items-start gap-3"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><span>Clear navigation with room for your agency to grow.</span></li>
                <li className="flex items-start gap-3"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><span>Light and dark themes for a comfortable working day.</span></li>
              </ul>
              <div className="mt-7 flex items-start gap-3 border-t pt-6 text-xs leading-6 text-muted-foreground"><Sparkles className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" /><p>On the horizon: AI Copilot, marketing, automation and finance. These capabilities are planned and are not available in this preview.</p></div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-col items-start justify-between gap-7 rounded-2xl border bg-primary/[0.04] px-7 py-10 sm:p-12 md:flex-row md:items-center">
            <div><p className="mb-3 text-xs font-semibold tracking-[0.18em] text-primary uppercase">Take a look around</p><h2 className="text-3xl font-semibold tracking-tight">Your next workspace is taking shape.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Explore the interface, discover the structure, and see where EstateOS is headed.</p></div>
            <Link href="/workspace/dashboard" className={cn(buttonVariants({ className: "h-12 gap-3 px-5" }))}>Open workspace <ArrowRight className="size-4" aria-hidden="true" /></Link>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card/40">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-5 px-5 py-8 sm:flex-row sm:items-center sm:px-8">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3"><Link href="/" aria-label="EstateOS home"><Brand compact /></Link><span className="text-xs text-muted-foreground">A new perspective on real estate CRM.</span></div>
          <div className="flex flex-wrap gap-5 text-xs text-muted-foreground"><span>Identity foundation · CRM features planned</span><Link href="/login" className="hover:text-foreground">Log in</Link><Link href="/signup" className="hover:text-foreground">Sign up</Link></div>
        </div>
      </footer>
    </div>
  );
}
