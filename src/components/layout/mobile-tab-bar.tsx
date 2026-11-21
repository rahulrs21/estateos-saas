"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck2, Inbox, LayoutDashboard, Menu, UsersRound, type LucideIcon } from "lucide-react";
import { isNavigationItemActive } from "@/config/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const TABS: { title: string; href: string; icon: LucideIcon }[] = [
  { title: "Dashboard", href: "/workspace/dashboard", icon: LayoutDashboard },
  { title: "Leads", href: "/leads", icon: UsersRound },
  { title: "Inbox", href: "/inbox", icon: Inbox },
  { title: "Tasks", href: "/workspace/tasks", icon: CalendarCheck2 },
];

/** Phones only: the most used sections, fixed at the bottom; "More" opens the full navigation. */
export function MobileTabBar() {
  const pathname = usePathname();
  const { openMobile, setOpenMobile } = useSidebar();
  const anyActive = TABS.some(tab => isNavigationItemActive(pathname, tab.href));

  return <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-card/85 md:hidden">
    <ul className="mx-auto grid h-14 max-w-lg grid-cols-5">
      {TABS.map(tab => {
        const active = isNavigationItemActive(pathname, tab.href);
        return <li key={tab.href}>
          <Link href={tab.href} aria-current={active ? "page" : undefined}
            className={cn("relative flex h-full flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors", active ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
            {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" aria-hidden="true" />}
            <tab.icon className="size-5" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />{tab.title}
          </Link>
        </li>;
      })}
      <li>
        <button type="button" onClick={() => setOpenMobile(!openMobile)} aria-expanded={openMobile} aria-label="More navigation"
          className={cn("relative flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors", openMobile || !anyActive ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
          {!anyActive && !openMobile && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" aria-hidden="true" />}
          <Menu className="size-5" strokeWidth={1.8} aria-hidden="true" />More
        </button>
      </li>
    </ul>
  </nav>;
}
