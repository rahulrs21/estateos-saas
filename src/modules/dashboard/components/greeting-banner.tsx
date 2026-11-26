"use client";

import Link from "next/link";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { clockDate, useLiveClock } from "@/components/layout/use-live-clock";
import { DASHBOARD_RANGES, DASHBOARD_TIME_ZONE, greetingFor, zonedHour, type DashboardRange } from "../dashboard-model";
import { Skyline } from "./skyline";

const longDate = new Intl.DateTimeFormat("en-AE", {timeZone: DASHBOARD_TIME_ZONE, weekday: "short", day: "numeric", month: "short", year: "numeric"});

/**
 * Greeting, today's date (Dubai) and the reporting period, over a drawn
 * skyline. The greeting follows the live clock, so it changes from morning to
 * afternoon without a reload. Server rendering uses the request time.
 */
export function GreetingBanner({firstName, range, serverNow}: {firstName: string | null; range: DashboardRange; serverNow: string}) {
  const now = useLiveClock() ?? new Date(serverNow);
  const greeting = greetingFor(zonedHour(now));

  return <section aria-labelledby="dashboard-greeting" className="relative isolate overflow-hidden rounded-2xl border bg-gradient-to-r from-(--banner-from) to-(--banner-to) px-5 py-6 sm:px-7 sm:py-7">
    <Skyline className="pointer-events-none absolute right-0 bottom-0 -z-10 h-[78%] w-auto max-w-[70%] sm:max-w-[60%]" />
    <div className="max-w-xl">
      <h1 id="dashboard-greeting" className="text-2xl font-semibold tracking-tight sm:text-[28px]">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Here&apos;s what&apos;s happening with your real estate business today.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex h-8 items-center gap-2 rounded-lg border bg-card/80 px-3 text-xs font-medium backdrop-blur-sm" title={clockDate.format(now)}>
          <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden="true" />{longDate.format(now)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8 gap-1.5 bg-card/80 text-xs backdrop-blur-sm" aria-label={`Reporting period: last ${DASHBOARD_RANGES[range].label}`} />}>
            Last {DASHBOARD_RANGES[range].label}<ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-40">
            {(Object.keys(DASHBOARD_RANGES) as DashboardRange[]).map(key => <DropdownMenuItem key={key} render={<Link href={`/workspace/dashboard?range=${key}`} scroll={false} />}>
              <span className="flex-1">Last {DASHBOARD_RANGES[key].label}</span>{key === range && <Check className="size-3.5 text-primary" aria-hidden="true" />}
            </DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </section>;
}
