"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { WorkspaceSidebar } from "@/components/layout/workspace-sidebar";
import { WorkspaceHeader, type WorkspaceHeaderProps } from "@/components/layout/workspace-header";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import type { CompanyWorkspace } from "@/modules/organizations/types";

interface WorkspaceShellProps extends Omit<WorkspaceHeaderProps, "company"> {
  children: ReactNode;
  workspace: CompanyWorkspace;
}

export function WorkspaceShell({ children, user, workspace }: WorkspaceShellProps) {
  return (
    <SidebarProvider key={workspace.activeCompany?.id ?? "workspace"} defaultOpen style={{ "--sidebar-width": "15.5rem", "--sidebar-width-icon": "3.5rem" } as CSSProperties}>
      <WorkspaceSidebar workspace={workspace} />
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceHeader user={user} company={workspace.activeCompany} />
        <div className="hidden items-start gap-2 border-b bg-card/60 px-4 py-2.5 text-xs leading-5 text-muted-foreground md:flex lg:px-5" role="note">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <p>{workspace.activeCompany?.name} workspace · {workspace.activeCompany?.role.toLowerCase()}. Start from the <Link href="/workspace/dashboard" className="rounded font-medium text-primary underline underline-offset-2">dashboard</Link> or your <Link href="/workspace/leads" className="rounded font-medium text-primary underline underline-offset-2">leads</Link>.</p>
        </div>
        {/* Page gutters are set here once for every module; pages add no outer padding of their own. */}
        <main id="main-content" tabIndex={-1} className="w-full min-w-0 flex-1 px-3 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom))] outline-none sm:px-4 md:py-5 lg:px-5">
          <div className="mx-auto w-full max-w-[1920px]">{children}</div>
        </main>
        <footer className="hidden flex-wrap items-center justify-between gap-2 px-4 pb-4 text-[11px] text-muted-foreground md:flex lg:px-5">
          <p>EstateOS <span aria-hidden="true">·</span> Built around your agency</p><p className="truncate">{workspace.activeCompany?.name}</p>
        </footer>
        <MobileTabBar />
      </div>
    </SidebarProvider>
  );
}
