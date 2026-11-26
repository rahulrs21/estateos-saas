"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useLiveClock } from "@/components/layout/use-live-clock";
import { DASHBOARD_RANGES, DASHBOARD_TIME_ZONE, greetingFor, zonedHour, type DashboardRange } from "../dashboard-model";
import palmVillas from "../assets/banner/palm-villas-skyline.jpg";
import villaWhitePool from "../assets/banner/villa-white-pool.jpg";
import villaModernPool from "../assets/banner/villa-modern-pool.jpg";
import villaPalms from "../assets/banner/villa-palms.jpg";

/* Finished UAE homes and waterfront living (Unsplash License; credits in ../assets/README.md). */
const SLIDES: Array<{src: StaticImageData; label: string; position: string}> = [
  {src: palmVillas, label: "Waterfront villas below the Dubai skyline", position: "50% 55%"},
  {src: villaWhitePool, label: "Modern white villa with a pool", position: "50% 60%"},
  {src: villaModernPool, label: "Contemporary villa with pool and garden", position: "50% 45%"},
  {src: villaPalms, label: "Villa among palm trees", position: "60% 40%"},
];
const SLIDE_MS = 6500;
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const longDate = new Intl.DateTimeFormat("en-AE", {timeZone: DASHBOARD_TIME_ZONE, weekday: "short", day: "numeric", month: "short", year: "numeric"});

/* The photos fade into the page on the left and at the bottom, so the banner has no hard edge. */
const photoMask: CSSProperties = {
  maskImage: "linear-gradient(to right, transparent 0%, #000 34%), linear-gradient(to top, transparent 0%, #000 26%)",
  WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 34%), linear-gradient(to top, transparent 0%, #000 26%)",
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
};

/**
 * Greeting, today's date (Dubai) and the reporting period, on a curved panel
 * over a slow crossfading slideshow of UAE homes. Each photo settles from a
 * gentle zoom. With "reduce motion" the slideshow stays on the first photo
 * (the dots still switch it). The greeting follows the live clock.
 */
export function GreetingBanner({firstName, range, serverNow}: {firstName: string | null; range: DashboardRange; serverNow: string}) {
  const now = useLiveClock() ?? new Date(serverNow);
  const greeting = greetingFor(zonedHour(now));
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const timer = setInterval(() => setActive(index => (index + 1) % SLIDES.length), SLIDE_MS);
    return () => clearInterval(timer);
  }, [reduce, active]);

  return <section aria-labelledby="dashboard-greeting" className="relative isolate min-h-[232px] overflow-hidden rounded-2xl bg-background">
    {/* Slideshow. */}
    <div aria-hidden="true" className="absolute inset-y-0 right-0 -z-30 w-full md:w-[66%]" style={photoMask}>
      {SLIDES.map((slide, index) => <motion.div key={slide.label} className="absolute inset-0" initial={false}
        animate={{opacity: index === active ? 1 : 0}} transition={{duration: 1.4, ease: "easeInOut"}}>
        <motion.div className="absolute inset-0" initial={false}
          animate={{scale: index === active ? 1 : 1.08}} transition={{duration: index === active ? SLIDE_MS / 1000 + 1.4 : 0.01, ease: EASE_OUT}}>
          <Image src={slide.src} alt="" fill priority={index === 0} sizes="(min-width: 768px) 66vw, 100vw" placeholder="blur"
            className="object-cover dark:brightness-[0.68] dark:saturate-[0.9]" style={{objectPosition: slide.position}} />
        </motion.div>
      </motion.div>)}
    </div>

    {/* Curved welcome panel (wide screens) and a soft tint over the photos (phones). */}
    <svg aria-hidden="true" className="absolute inset-0 -z-20 hidden size-full md:block" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="greeting-panel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--card)" stopOpacity="0.97" />
          <stop offset="70%" stopColor="var(--banner-from)" stopOpacity="0.94" />
          <stop offset="100%" stopColor="var(--banner-from)" stopOpacity="0.82" />
        </linearGradient>
        <filter id="greeting-panel-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>
      {/* Soft shadow along the curve, then the glass panel and its edge. */}
      <path d="M52 0 C 45 24, 48 70, 36 100" fill="none" stroke="var(--primary)" strokeOpacity="0.22" strokeWidth="10" vectorEffect="non-scaling-stroke" filter="url(#greeting-panel-glow)" />
      <path d="M0 0 H52 C 45 24, 48 70, 36 100 H0 Z" fill="url(#greeting-panel)" />
      <path d="M52 0 C 45 24, 48 70, 36 100" fill="none" stroke="var(--primary)" strokeOpacity="0.35" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
    <div aria-hidden="true" className="absolute inset-0 -z-20 md:hidden" style={{background: "linear-gradient(90deg, color-mix(in oklab, var(--background) 92%, transparent) 0%, color-mix(in oklab, var(--background) 74%, transparent) 70%, color-mix(in oklab, var(--background) 45%, transparent) 100%)"}} />
    <div aria-hidden="true" className="absolute -top-24 -left-24 -z-10 size-80 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_70%)]" />

    <div className="relative max-w-xl px-5 py-8 sm:px-8 sm:py-10">
      <motion.h1 id="dashboard-greeting" className="flex items-center gap-2 text-[26px] font-semibold tracking-tight sm:text-[32px]"
        initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} transition={{duration: 0.55, delay: 0.1, ease: EASE_OUT}}>
        <span>{greeting}{firstName ? `, ${firstName}` : ""}!</span>
        <motion.span aria-hidden="true" className="inline-block origin-[70%_80%]"
          initial={{rotate: 0}} animate={{rotate: [0, 16, -8, 16, -4, 10, 0]}} transition={{duration: 1.6, delay: 0.7, ease: "easeInOut"}}>👋</motion.span>
      </motion.h1>
      <motion.p className="mt-2 text-[15px] text-muted-foreground" initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} transition={{duration: 0.55, delay: 0.2, ease: EASE_OUT}}>
        Here&apos;s what&apos;s happening with your real estate business today.
      </motion.p>
      <motion.div className="mt-6 flex flex-wrap items-center gap-2" initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} transition={{duration: 0.55, delay: 0.3, ease: EASE_OUT}}>
        <span className="inline-flex h-9 items-center gap-2 rounded-full border bg-card px-3.5 text-xs font-medium shadow-xs">
          <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden="true" />{longDate.format(now)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-full bg-card px-3.5 text-xs shadow-xs" aria-label={`Reporting period: last ${DASHBOARD_RANGES[range].label}`} />}>
            Last {DASHBOARD_RANGES[range].label}<ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-40">
            {(Object.keys(DASHBOARD_RANGES) as DashboardRange[]).map(key => <DropdownMenuItem key={key} render={<Link href={`/workspace/dashboard?range=${key}`} scroll={false} />}>
              <span className="flex-1">Last {DASHBOARD_RANGES[key].label}</span>{key === range && <Check className="size-3.5 text-primary" aria-hidden="true" />}
            </DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>
    </div>

    {/* Slide picker. */}
    <div className="absolute right-4 bottom-4 flex gap-1.5" role="group" aria-label="Banner photos">
      {SLIDES.map((slide, index) => <button key={slide.label} type="button" onClick={() => setActive(index)} aria-label={`Show photo: ${slide.label}`} aria-pressed={index === active}
        className={cn("h-1.5 rounded-full bg-white/60 shadow-sm transition-all duration-300 hover:bg-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none", index === active ? "w-6 bg-white" : "w-1.5")} />)}
    </div>
  </section>;
}
