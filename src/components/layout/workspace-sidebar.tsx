"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MotionConfig, motion } from "motion/react";
import { Building2, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { isNavigationItemActive, navigationGroups, type NavigationItem } from "@/config/navigation";
import { Brand } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";
import type { CompanyWorkspace } from "@/modules/organizations/types";
import { WorkspaceSwitcher } from "@/modules/organizations/components/workspace-switcher";
import { PendingApprovalsBadge } from "@/modules/automations/components/pending-approvals-badge";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";

/*
 * Collapsed ("icon") mode: a 56px rail. Groups lose their side padding so each
 * 36px button sits centred, group labels give way to thin dividers, and the
 * list scrolls without a visible scrollbar (soft fades at the edges instead).
 * A teal bar marks the current page and slides between items on navigation.
 */

const footerItems = navigationGroups.flatMap(group => group.items).filter(item => item.placement === "footer");

/** One navigation entry; the teal bar (shared layoutId) slides to whichever entry is active. */
function NavItem({item, active, pathname, onNavigate}: {item: NavigationItem; active: boolean; pathname: string; onNavigate: () => void}) {
  return (
    <SidebarMenuItem>
      {active && <motion.span layoutId="sidebar-active-indicator" aria-hidden="true"
        className="absolute inset-y-2 -left-3 w-[3px] rounded-r-full bg-primary group-data-[collapsible=icon]:-left-2"
        transition={{type: "spring", stiffness: 520, damping: 42}} />}
      <SidebarMenuButton render={<Link href={item.href} />} isActive={active} aria-current={active ? "page" : undefined} aria-label={item.title} tooltip={item.title} onClick={onNavigate}
        className={[
          "h-9 gap-3 rounded-lg text-[13px] text-sidebar-foreground/75 transition-[width,height,padding,background-color,color] duration-200",
          "hover:text-sidebar-foreground data-active:text-sidebar-foreground [&_svg]:transition-colors data-active:[&_svg]:text-primary",
          "[&>span]:transition-opacity [&>span]:duration-200",
          "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-[9px]! group-data-[collapsible=icon]:[&_svg]:size-[18px] group-data-[collapsible=icon]:[&>span]:opacity-0",
        ].join(" ")}>
        <item.icon aria-hidden="true" /><span>{item.title}</span>{item.badge === "approvals" && <PendingApprovalsBadge refreshKey={pathname} />}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function WorkspaceSidebar({ workspace }: { workspace: CompanyWorkspace }) {
  const pathname = usePathname();
  const { sidebarId, state, isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <MotionConfig reducedMotion="user">
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className={`h-[76px] justify-center px-4 group-data-[collapsible=icon]:px-2`}>
        <div className="flex items-center justify-between gap-1">
          {collapsed ? <Button variant="ghost" size="icon-lg" onClick={toggleSidebar} aria-label="Expand sidebar" title="Expand sidebar" aria-controls={`${sidebarId}-desktop`} aria-expanded={false} className="mx-auto text-muted-foreground hover:text-foreground"><PanelLeftOpen aria-hidden="true" /></Button> : <Link href="/" aria-label="EstateOS homepage" className="rounded-lg"><Brand /></Link>}
          {!collapsed && <Button variant="ghost" size="icon-sm" onClick={isMobile ? () => setOpenMobile(false) : toggleSidebar} aria-label={isMobile ? "Close navigation" : "Collapse sidebar"} aria-controls={`${sidebarId}-${isMobile ? "mobile" : "desktop"}`} aria-expanded={true} className="text-muted-foreground hover:text-foreground">
            {isMobile ? <X aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </Button>}
        </div>
      </SidebarHeader>
      <div className={`mx-4 mb-3 flex items-center gap-2.5 rounded-xl border bg-background p-2.5 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:p-0`}>
        {collapsed && <Link href="/settings/company" aria-label="Company settings" title={workspace.activeCompany?.name} className="flex size-full items-center justify-center rounded-lg text-primary hover:bg-sidebar-accent"><Building2 className="size-[18px] shrink-0" aria-hidden="true" /></Link>}
        <div className={`min-w-0 group-data-[collapsible=icon]:hidden`}>
          <WorkspaceSwitcher companies={workspace.companies} activeId={workspace.activeCompany?.id} compact />
        </div>
      </div>
      <SidebarContent className={`no-scrollbar scroll-fade px-2 pt-1 pb-3 group-data-[collapsible=icon]:overflow-y-auto`}>
        <nav aria-label="Workspace navigation">
          {navigationGroups.map((group) => (
            <SidebarGroup key={group.label} className={`px-1 py-1 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:not-first:mt-1 group-data-[collapsible=icon]:not-first:border-t group-data-[collapsible=icon]:not-first:border-sidebar-border group-data-[collapsible=icon]:not-first:pt-2`}>
              <SidebarGroupLabel className={`h-7 text-[10px] font-semibold tracking-[0.12em] uppercase group-data-[collapsible=icon]:-mt-7`}>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {group.items.filter(item => item.placement !== "footer").map(item =>
                    <NavItem key={item.href} item={item} active={isNavigationItemActive(pathname, item.href)} pathname={pathname} onNavigate={() => setOpenMobile(false)} />)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      {/* Settings is pinned here, below the scrolling list, so it is always one click away. */}
      <SidebarFooter className="border-t px-3 py-2 group-data-[collapsible=icon]:px-2">
        <SidebarMenu>
          {footerItems.map(item =>
            <NavItem key={item.href} item={item} active={pathname.startsWith("/settings")} pathname={pathname} onNavigate={() => setOpenMobile(false)} />)}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
    </MotionConfig>
  );
}
