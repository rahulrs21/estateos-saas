import Link from "next/link";
import { ArrowRight, Bot, FileText, MessageSquareText, Wand2 } from "lucide-react";

/**
 * Entry point to AI Copilot, styled as the dashboard's one accent card. It is
 * a link to the existing module; nothing runs from here.
 */
export function CopilotCard() {
  return <section aria-labelledby="copilot-card-title" className="relative isolate flex h-full flex-col overflow-hidden rounded-xl bg-gradient-to-br from-[#0b7f6b] to-[#065a4b] p-5 text-white shadow-xs dark:from-[#115c50] dark:to-[#0b3b34]">
    {/* Icon composition in place of an illustration: three tools Copilot can help with. */}
    <div className="pointer-events-none absolute -top-3 -right-3 -z-10 grid size-40 rotate-6 grid-cols-2 gap-2 opacity-20" aria-hidden="true">
      {[Bot, Wand2, FileText, MessageSquareText].map((Icon, index) => <span key={index} className="flex items-center justify-center rounded-2xl border border-white/30 bg-white/10"><Icon className="size-7" /></span>)}
    </div>
    <span className="flex size-10 items-center justify-center rounded-xl bg-white/15" aria-hidden="true"><Bot className="size-5" /></span>
    <h2 id="copilot-card-title" className="mt-auto pt-10 text-lg font-semibold">Let AI work for you</h2>
    <p className="mt-1 text-sm leading-6 text-white/80">Ask questions about your leads and inventory, draft listings and emails, and get next-step suggestions.</p>
    <Link href="/ai-copilot" className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-[#065a4b] transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none">
      Try AI Copilot<ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  </section>;
}
