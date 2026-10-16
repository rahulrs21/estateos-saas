"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, PanelLeft, ShieldCheck } from "lucide-react";
import { navigationGroups } from "@/config/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { LogoutButton } from "@/modules/auth/components/logout-button";

export interface WorkspaceHeaderProps {
  user?: { name?: string | null; email: string } | null;
}

export function WorkspaceHeader({ user }: WorkspaceHeaderProps) {
  const pathname = usePathname();
  const { toggleSidebar, open, isMobile, openMobile } = useSidebar();
  const current = navigationGroups.flatMap((group) => group.items).find((item) => item.href === pathname);
  const identity = user?.name?.trim() || user?.email;

  return (
    <header className="flex h-[76px] shrink-0 items-center justify-between gap-2 border-b bg-card px-4 sm:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon-lg" onClick={toggleSidebar} aria-label={isMobile ? "Open navigation" : open ? "Collapse sidebar" : "Expand sidebar"} aria-expanded={isMobile ? openMobile : open}>
          <PanelLeft className="size-[18px]" aria-hidden="true" />
        </Button>
        <div className="h-5 border-l" aria-hidden="true" />
        <nav aria-label="Breadcrumb" className="min-w-0 text-sm">
          <ol className="flex items-center gap-2">
            <li className="hidden text-muted-foreground sm:block"><Link href="/workspace/dashboard" className="rounded hover:text-primary">Workspace</Link></li>
            <li className="hidden sm:block"><ChevronRight className="size-3 text-muted-foreground" aria-hidden="true" /></li>
            <li className="truncate font-medium" aria-current="page">{current?.title ?? "Workspace"}</li>
          </ol>
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        {identity && <span title={`Signed in as ${identity}`} className="inline-flex max-w-28 items-center gap-1.5 rounded-full border border-primary/20 bg-secondary px-2.5 py-1 text-[11px] font-medium text-primary sm:max-w-64"><ShieldCheck className="size-3 shrink-0" aria-hidden="true" /><span className="truncate"><span className="sr-only sm:not-sr-only">Signed in as </span>{identity}</span></span>}
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
