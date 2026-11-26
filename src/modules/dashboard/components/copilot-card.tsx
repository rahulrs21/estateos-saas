"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import robot from "../assets/copilot-robot.jpg";

/* The robot photo fades out toward the text and at its sides, into the card's near-black base (its own studio background). */
const robotMask = "linear-gradient(to bottom, #000 52%, transparent 96%), linear-gradient(to right, transparent 0%, #000 10%, #000 90%, transparent 100%)";
const robotMaskStyle = {maskImage: robotMask, WebkitMaskImage: robotMask, maskComposite: "intersect", WebkitMaskComposite: "source-in"} as const;

/**
 * Entry point to the AI tools: the EstateOS robot (src/modules/dashboard/assets)
 * on a dark card whose near-black base matches the photo's studio background,
 * deepening to emerald under the message, with a soft green glow behind the
 * head that echoes the robot's status lights. Links to AI Copilot; nothing
 * runs from here. The robot drifts very slightly; still under reduced motion.
 */
export function CopilotCard() {
  return <section aria-labelledby="copilot-card-title" className="relative isolate flex h-full min-h-96 flex-col overflow-hidden rounded-xl bg-[linear-gradient(180deg,#040406_0%,#040406_52%,#052a1f_100%)] p-5 text-white shadow-sm ring-1 ring-white/5">
    <div aria-hidden="true" className="absolute top-6 left-1/2 -z-20 size-64 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(62,224,122,0.22),transparent_65%)]" />
    <motion.div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10" style={robotMaskStyle}
      animate={{y: [0, -4, 0]}} transition={{duration: 5, repeat: Infinity, ease: "easeInOut"}}>
      <Image src={robot} alt="" sizes="(min-width: 1280px) 340px, (min-width: 1024px) 50vw, 100vw" placeholder="blur" className="h-auto w-full" />
    </motion.div>

    <div className="mt-auto pt-48">
      <p className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-sm">
        <span className="size-1.5 rounded-full bg-[#3ee07a] shadow-[0_0_8px_#3ee07a]" aria-hidden="true" />EstateOS AI
      </p>
      <h2 id="copilot-card-title" className="mt-3 text-xl font-semibold tracking-tight">Let AI work for you</h2>
      <p className="mt-1.5 text-sm leading-6 text-white/75">Generate landing pages, write emails and get smart insights.</p>
      <Link href="/ai-copilot" className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#3ee07a] px-4 text-sm font-semibold text-[#03150d] shadow-[0_0_24px_rgba(62,224,122,0.35)] transition-colors hover:bg-[#5ce892] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none">
        Try AI Copilot<ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  </section>;
}
