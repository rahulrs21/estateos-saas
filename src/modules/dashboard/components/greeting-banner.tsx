"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLiveClock } from "@/components/layout/use-live-clock";
import { DASHBOARD_RANGES, DASHBOARD_TIME_ZONE, greetingFor, zonedHour, type DashboardRange } from "../dashboard-model";
import skyline from "../assets/dubai-skyline.jpg";

const longDate = new Intl.DateTimeFormat("en-AE", {timeZone: DASHBOARD_TIME_ZONE, weekday: "short", day: "numeric", month: "short", year: "numeric"});
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/* The photo fades into the banner colour on the left so the greeting always
   sits on a calm, readable surface; on phones it runs behind a stronger tint. */
const wideFade = "linear-gradient(90deg, var(--banner-from) 0%, var(--banner-from) 34%, color-mix(in oklab, var(--banner-from) 72%, transparent) 50%, color-mix(in oklab, var(--banner-from) 18%, transparent) 70%, transparent 86%)";
const narrowFade = "linear-gradient(90deg, color-mix(in oklab, var(--banner-from) 94%, transparent) 0%, color-mix(in oklab, var(--banner-from) 82%, transparent) 60%, color-mix(in oklab, var(--banner-from) 55%, transparent) 100%)";

/**
 * Greeting, today's date (Dubai) and the reporting period over a photo of the
 * Burj Khalifa and Downtown Dubai (../assets, Unsplash License). The
 * photo fades in and settles from a slow zoom, then drifts very slightly; with
 * "reduce motion" it simply appears. The greeting follows the live clock.
 */
export function GreetingBanner({firstName, range, serverNow}: {firstName: string | null; range: DashboardRange; serverNow: string}) {
  const now = useLiveClock() ?? new Date(serverNow);
  const greeting = greetingFor(zonedHour(now));

  return <section aria-labelledby="dashboard-greeting" className="relative isolate min-h-[188px] overflow-hidden rounded-2xl border bg-(--banner-from) shadow-xs">
    <motion.div aria-hidden="true" className="absolute inset-y-0 right-0 -z-20 w-full md:w-[70%]"
      initial={{opacity: 0, scale: 1.12}} animate={{opacity: 1, scale: 1}} transition={{opacity: {duration: 0.9, ease: "easeOut"}, scale: {duration: 2.4, ease: EASE_OUT}}}>
      <motion.div className="relative size-full" animate={{scale: [1, 1.035, 1]}} transition={{duration: 26, ease: "easeInOut", repeat: Infinity, delay: 2.4}}>
        <Image src={skyline} alt="" fill priority sizes="(min-width: 768px) 70vw, 100vw" placeholder="blur"
          className="object-cover object-[50%_28%] dark:brightness-[0.62] dark:saturate-[0.85]" />
      </motion.div>
    </motion.div>
    <div aria-hidden="true" className="absolute inset-0 -z-10 hidden md:block" style={{background: wideFade}} />
    <div aria-hidden="true" className="absolute inset-0 -z-10 md:hidden" style={{background: narrowFade}} />

    <div className="max-w-xl px-5 py-7 sm:px-8 sm:py-8">
      <motion.h1 id="dashboard-greeting" className="text-2xl font-semibold tracking-tight sm:text-[28px]"
        initial={{opacity: 0, y: 8}} animate={{opacity: 1, y: 0}} transition={{duration: 0.5, delay: 0.15, ease: EASE_OUT}}>
        {greeting}{firstName ? `, ${firstName}` : ""}
      </motion.h1>
      <motion.p className="mt-1.5 text-sm text-muted-foreground" initial={{opacity: 0, y: 8}} animate={{opacity: 1, y: 0}} transition={{duration: 0.5, delay: 0.25, ease: EASE_OUT}}>
        Here&apos;s what&apos;s happening with your real estate business today.
      </motion.p>
      <motion.div className="mt-5 flex flex-wrap items-center gap-2" initial={{opacity: 0, y: 8}} animate={{opacity: 1, y: 0}} transition={{duration: 0.5, delay: 0.35, ease: EASE_OUT}}>
        <span className="inline-flex h-8 items-center gap-2 rounded-lg border bg-card/90 px-3 text-xs font-medium shadow-xs backdrop-blur-sm">
          <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden="true" />{longDate.format(now)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8 gap-1.5 bg-card/90 text-xs shadow-xs backdrop-blur-sm" aria-label={`Reporting period: last ${DASHBOARD_RANGES[range].label}`} />}>
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
  </section>;
}
