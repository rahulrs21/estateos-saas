"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { WorkspaceSidebar } from "@/components/layout/workspace-sidebar";
import { WorkspaceHeader, type WorkspaceHeaderProps } from "@/components/layout/workspace-header";
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
        <div className="flex items-start gap-2 border-b bg-card/60 px-5 py-3 text-xs leading-5 text-muted-foreground sm:px-8" role="note">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <p>{workspace.activeCompany?.name} workspace · {workspace.activeCompany?.role.toLowerCase()}. <Link href="/workspace/dashboard" className="rounded font-medium text-primary underline underline-offset-2">Dashboard</Link> and <Link href="/workspace/leads" className="rounded font-medium text-primary underline underline-offset-2">leads</Link> are available. Dashboard analytics are not connected yet.</p>
        </div>
        <main id="main-content" tabIndex={-1} className="w-full min-w-0 flex-1 px-4 py-7 outline-none sm:px-7 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-2 px-4 pb-5 text-[11px] text-muted-foreground sm:px-8">
          <p>EstateOS <span aria-hidden="true">·</span> Built around your agency</p><p className="truncate">{workspace.activeCompany?.name}</p>
        </footer>
      </div>
    </SidebarProvider>
  );
}
