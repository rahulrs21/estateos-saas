"use client";

import type { CSSProperties, ReactNode } from "react";
import { Info } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { WorkspaceSidebar } from "@/components/layout/workspace-sidebar";
import { WorkspaceHeader } from "@/components/layout/workspace-header";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider style={{ "--sidebar-width": "15.5rem", "--sidebar-width-icon": "3.5rem" } as CSSProperties}>
      <WorkspaceSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceHeader />
        <div className="flex items-start gap-2 border-b bg-card/60 px-5 py-3 text-xs leading-5 text-muted-foreground sm:px-8" role="note">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <p>Your identity is verified. Agency membership, permissions and CRM data are not connected yet. Business features remain unavailable.</p>
        </div>
        <main id="main-content" tabIndex={-1} className="w-full min-w-0 flex-1 px-4 py-7 outline-none sm:px-7 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-2 px-4 pb-5 text-[11px] text-muted-foreground sm:px-8">
          <p>EstateOS <span aria-hidden="true">·</span> Built around your agency</p><p>Identity foundation <span aria-hidden="true">/</span> Agency setup pending</p>
        </footer>
      </div>
    </SidebarProvider>
  );
}
