"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import robot from "../assets/copilot-robot.png";

/** A four-point sparkle that twinkles; decorative. */
function Sparkle({className, delay, size = 18}: {className: string; delay: number; size?: number}) {
  return <motion.svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" focusable="false"
    animate={{scale: [0.7, 1.1, 0.7], opacity: [0.55, 1, 0.55]}} transition={{duration: 2.4, delay, repeat: Infinity, ease: "easeInOut"}}>
    <path d="M12 0 C 13 7, 17 11, 24 12 C 17 13, 13 17, 12 24 C 11 17, 7 13, 0 12 C 7 11, 11 7, 12 0 Z" fill="#f4ffd6" />
  </motion.svg>;
}

/* Fades the robot image's edges into the card: generously at the top, right and bottom, and only a sliver on the
   left so the waving hand stays whole. */
const robotMask = "linear-gradient(to top, transparent 0%, #000 24%), linear-gradient(to left, transparent 0%, #000 14%), linear-gradient(to bottom, transparent 0%, #000 10%), linear-gradient(to right, transparent 0%, #000 6%)";
const robotMaskStyle = {maskImage: robotMask, WebkitMaskImage: robotMask, maskComposite: "intersect", WebkitMaskComposite: "source-in"} as const;

/**
 * Entry point to the AI tools, laid out as in the approved design: a green
 * gradient card, sparkles at top-left, the waving Copilot robot filling the
 * upper part (src/modules/dashboard/assets, from the design mockup) and the
 * message with a "Try AI Copilot" button underneath. Links to AI Copilot.
 */
export function CopilotCard() {
  return <section aria-labelledby="copilot-card-title" className="relative isolate flex h-full min-h-80 flex-col overflow-hidden rounded-xl bg-gradient-to-br from-[#3cc96f] via-[#0ea266] to-[#078a5c] p-5 text-white shadow-sm">
    <div aria-hidden="true" className="absolute -bottom-24 -left-20 -z-10 size-72 rounded-full bg-[radial-gradient(circle,rgba(4,80,55,0.35),transparent_65%)]" />
    <Sparkle className="absolute top-8 left-6" delay={0} size={22} />
    <Sparkle className="absolute top-[4.25rem] left-12" delay={0.8} size={14} />

    {/* Robot: takes the space above the text, centred there however tall the card grows. */}
    <div aria-hidden="true" className="pointer-events-none -mx-5 -mt-5 flex min-h-40 flex-1 items-center justify-end">
      <motion.div className="w-[78%] max-w-72" style={robotMaskStyle}
        animate={{y: [0, -5, 0]}} transition={{duration: 4, repeat: Infinity, ease: "easeInOut"}}>
        <Image src={robot} alt="" sizes="288px" className="h-auto w-full" />
      </motion.div>
    </div>

    <div className="-mt-2">
      <h2 id="copilot-card-title" className="text-xl font-semibold tracking-tight">Let AI work for you</h2>
      <p className="mt-1.5 max-w-64 text-sm leading-6 text-white/90">Generate landing pages, write emails and get smart insights.</p>
      <Link href="/ai-copilot" className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#0a3d2c] shadow-sm transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none">
        Try AI Copilot<ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  </section>;
}
