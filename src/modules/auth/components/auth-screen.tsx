import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Layers3,
  LockKeyhole,
} from "lucide-react";

import { Brand } from "@/components/shared/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthForm } from "@/modules/auth/components/auth-form";
import type { AuthFormMode } from "@/modules/auth/validation";

const copy = {
  login: { title: "Welcome back.", description: "Log in with your verified email address to open your EstateOS workspace." },
  signup: { title: "A new chapter starts here.", description: "Create your EstateOS account. We’ll email you a link to verify your address before you can sign in." },
  reset: { title: "Let’s get you back in.", description: "Enter your account email and we’ll send instructions to reset your password." },
  verify: { title: "Verify your email.", description: "Follow the verification link in your inbox, then log in. To request another email, confirm your account credentials below." },
};

export function AuthScreen({ mode }: { mode: AuthFormMode }) {
  const isSignup = mode === "signup";

  return (
    <div className="grid min-h-svh lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="relative hidden flex-col overflow-hidden bg-[#113e35] p-12 text-white lg:flex xl:p-16" aria-label="About EstateOS">
        <Link href="/" className="w-fit [--foreground:#ffffff] [--primary:#a7f3d0] [--primary-foreground:#113e35]" aria-label="EstateOS home"><Brand /></Link>
        <div className="relative z-10 my-auto py-16">
          <span className="mb-7 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-emerald-100/80">Made for the way agencies work</span>
          <h2 className="max-w-lg text-5xl leading-[1.15] font-medium tracking-tight xl:text-6xl">Great relationships.<br />New possibilities.<br /><span className="text-emerald-200">One EstateOS.</span></h2>
          <p className="mt-7 max-w-sm text-base leading-7 text-emerald-50/65">A connected workspace vision for the people shaping UAE real estate.</p>
          <div className="mt-12 flex gap-4 rounded-xl border border-white/10 bg-white/5 p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-200"><Layers3 className="size-5" aria-hidden="true" /></span>
            <div><p className="text-sm font-medium">A foundation for what comes next</p><p className="mt-1.5 max-w-xs text-xs leading-6 text-emerald-50/60">Your account is the first step. Agency membership and business tools will follow in a future phase.</p></div>
          </div>
        </div>
        <p className="relative z-10 text-xs text-emerald-50/60">EstateOS · Your agency, connected</p>
        <div className="pointer-events-none absolute -right-36 -bottom-44 size-[32rem] rounded-full border border-emerald-100/10 p-12" aria-hidden="true"><div className="size-full rounded-full border border-emerald-100/10 p-12"><div className="size-full rounded-full border border-emerald-100/10" /></div></div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 p-5 sm:p-8">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" /> Back to home</Link>
          <ThemeToggle />
        </header>
        <main id="main-content" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-8 sm:px-4 sm:py-12">
          <Link href="/" className="mb-10 w-fit lg:hidden" aria-label="EstateOS home"><Brand /></Link>
          <span className="mb-6 flex size-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary">{isSignup ? <Building2 className="size-6" aria-hidden="true" /> : <LockKeyhole className="size-6" aria-hidden="true" />}</span>
          <h1 className="text-3xl font-semibold tracking-tight">{copy[mode].title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy[mode].description}</p>
          <AuthForm mode={mode} />
          {(mode === "login" || isSignup) && <p className="mt-8 text-center text-sm text-muted-foreground">{isSignup ? "Already have an account?" : "New to EstateOS?"}{" "}<Link href={isSignup ? "/login" : "/signup"} className="font-medium text-primary underline-offset-4 hover:underline">{isSignup ? "Log in" : "Create an account"}</Link></p>}
        </main>
        <footer className="px-6 py-6 text-center text-xs leading-5 text-muted-foreground">Designed for UAE real estate agencies.<br className="sm:hidden" /> Agency setup and business features are not connected yet.</footer>
      </div>
    </div>
  );
}
