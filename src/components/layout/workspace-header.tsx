"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, PanelLeft } from "lucide-react";
import { isNavigationItemActive, navigationGroups } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { AccountMenu } from "@/components/layout/account-menu";
import { clockDate, clockTime, useLiveClock } from "@/components/layout/use-live-clock";
import { NotificationBell } from "@/modules/leads/distribution/components/notification-bell";
import type { CompanyChoice } from "@/modules/organizations/types";

export interface WorkspaceHeaderProps {
  user?: { name?: string | null; email: string } | null;
  company?: CompanyChoice | null;
}

export function WorkspaceHeader({ user, company }: WorkspaceHeaderProps) {
  const pathname = usePathname();
  const { toggleSidebar, sidebarId, open, isMobile, openMobile } = useSidebar();
  const current = navigationGroups.flatMap((group) => group.items).find((item) => isNavigationItemActive(pathname, item.href));
  const pageTitle = pathname === "/settings/company" ? "Company settings" : pathname === "/settings/team/invitations" ? "Invitations" : pathname === "/settings/team" ? "Team members" : pathname === "/settings/lead-distribution" ? "Lead distribution" : current?.title ?? "Workspace";
  const toggleLabel = isMobile
    ? (openMobile ? "Close navigation" : "Open navigation")
    : (open ? "Collapse sidebar" : "Expand sidebar");

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-card/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-card/85 md:static md:h-[76px] md:bg-card md:px-4 lg:px-5 md:backdrop-blur-none">
      <div className="flex min-w-0 items-center gap-1.5 md:gap-3">
        <Button variant="ghost" size="icon-lg" data-sidebar-toggle onClick={toggleSidebar} aria-label={toggleLabel} title={toggleLabel} aria-controls={`${sidebarId}-${isMobile ? "mobile" : "desktop"}`} aria-expanded={isMobile ? openMobile : open}>
          <PanelLeft className="size-[18px]" aria-hidden="true" />
        </Button>
        <div className="hidden h-5 border-l md:block" aria-hidden="true" />
        {/* Phones: the page title, with the company under it. */}
        <div className="min-w-0 md:hidden">
          <p className="truncate text-[15px] leading-5 font-semibold">{pageTitle}</p>
          <Link href="/workspace/dashboard" className="block truncate text-[11px] leading-4 text-muted-foreground">{company?.name ?? "Workspace"}</Link>
        </div>
        <nav aria-label="Breadcrumb" className="hidden min-w-0 text-sm md:block">
          <ol className="flex items-center gap-2">
            <li className="max-w-32 truncate text-muted-foreground sm:max-w-60"><Link href="/workspace/dashboard" title={company?.name} className="rounded hover:text-primary">{company?.name ?? "Workspace"}</Link></li>
            <li className="hidden sm:block"><ChevronRight className="size-3 text-muted-foreground" aria-hidden="true" /></li>
            <li className="hidden truncate font-medium sm:block" aria-current="page">{pageTitle}</li>
          </ol>
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-1 md:gap-3">
        <LiveClock />
        {company?.id && <NotificationBell organizationId={company.id} />}
        {user && <AccountMenu user={user} company={company} />}
      </div>
    </header>
  );
}

/** Dubai date and time, ticking every second (wide screens; the account menu shows it on smaller ones). */
function LiveClock() {
  const now = useLiveClock();
  return <div className="hidden items-center gap-2 border-r pr-3 text-right leading-tight lg:flex" aria-hidden="true">
    <span className="min-w-[88px] text-[11px] text-muted-foreground">{now ? clockDate.format(now) : " "}</span>
    <span className="min-w-[84px] font-mono text-[13px] font-medium tabular-nums">{now ? clockTime.format(now) : " "}<span className="ml-1 font-sans text-[10px] font-normal text-muted-foreground">GST</span></span>
  </div>;
}
