"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import robot from "../assets/copilot-robot.png";

/** A four-point sparkle that twinkles; decorative. */
function Sparkle({className, delay, size = 18}: {className: string; delay: number; size?: number}) {
  return <motion.svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" focusable="false"
    animate={{scale: [0.7, 1.1, 0.7], opacity: [0.5, 1, 0.5]}} transition={{duration: 2.4, delay, repeat: Infinity, ease: "easeInOut"}}>
    <path d="M12 0 C 13 7, 17 11, 24 12 C 17 13, 13 17, 12 24 C 11 17, 7 13, 0 12 C 7 11, 11 7, 12 0 Z" fill="#f4ffd6" />
  </motion.svg>;
}

/* The robot image's own background is the card's green, so its edges fade into the card. */
const robotMask = "radial-gradient(ellipse 58% 60% at 58% 50%, #000 52%, transparent 100%)";

/**
 * Entry point to the AI tools, as in the approved design: a green gradient
 * card with sparkles, the waving Copilot robot (src/modules/dashboard/assets,
 * from the design mockup) and a "Try AI Copilot" button. It links to AI
 * Copilot; nothing runs from here.
 */
export function CopilotCard() {
  return <section aria-labelledby="copilot-card-title" className="relative isolate flex h-full min-h-80 flex-col overflow-hidden rounded-xl bg-gradient-to-br from-[#3cc96f] via-[#0ea266] to-[#078a5c] p-5 text-white shadow-sm">
    <div aria-hidden="true" className="absolute -bottom-24 -left-20 -z-10 size-72 rounded-full bg-[radial-gradient(circle,rgba(4,80,55,0.35),transparent_65%)]" />
    <Sparkle className="absolute top-7 left-6" delay={0} size={22} />
    <Sparkle className="absolute top-16 left-[3.25rem]" delay={0.8} size={14} />
    <motion.div aria-hidden="true" className="pointer-events-none absolute top-0 right-0 -z-10 w-[62%] max-w-60"
      style={{maskImage: robotMask, WebkitMaskImage: robotMask}} animate={{y: [0, -5, 0]}} transition={{duration: 4, repeat: Infinity, ease: "easeInOut"}}>
      <Image src={robot} alt="" sizes="240px" className="h-auto w-full" priority={false} />
    </motion.div>
    <div className="mt-auto pt-40">
      <h2 id="copilot-card-title" className="text-xl font-semibold tracking-tight">Let AI work for you</h2>
      <p className="mt-1.5 text-sm leading-6 text-white/90">Generate landing pages, write emails and get smart insights.</p>
      <Link href="/ai-copilot" className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#0a3d2c] shadow-sm transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none">
        Try AI Copilot<ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  </section>;
}
