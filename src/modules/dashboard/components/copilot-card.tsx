import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CopilotRobot } from "./copilot-robot";

/**
 * Entry point to AI Copilot, styled as the dashboard's one accent card. It is
 * a link to the existing module; nothing runs from here.
 */
export function CopilotCard() {
  return <section aria-labelledby="copilot-card-title" className="relative isolate flex h-full min-h-80 flex-col overflow-hidden rounded-xl bg-gradient-to-br from-[#0d8a74] via-[#0a7462] to-[#05503f] p-5 text-white shadow-xs dark:from-[#127060] dark:via-[#0e5a4d] dark:to-[#093a32]">
    {/* Soft light behind the robot, so it reads as standing in the card rather than pasted on. */}
    <div aria-hidden="true" className="absolute -top-10 -right-10 -z-10 size-64 rounded-full bg-[radial-gradient(circle,rgba(127,240,214,0.35),transparent_65%)]" />
    <CopilotRobot className="pointer-events-none absolute top-2 right-0 -z-10 h-48 w-auto sm:h-52" />
    <p className="text-[11px] font-semibold tracking-[0.14em] text-white/70 uppercase">AI Copilot</p>
    <div className="mt-auto pt-40">
      <h2 id="copilot-card-title" className="text-lg font-semibold">Let AI work for you</h2>
      <p className="mt-1 text-sm leading-6 text-white/80">Ask questions about your leads and inventory, draft listings and emails, and get next-step suggestions.</p>
      <Link href="/ai-copilot" className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-[#05503f] transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none">
        Try AI Copilot<ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  </section>;
}
