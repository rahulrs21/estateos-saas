import {
  Gauge, Globe,
  BarChart3, Bot, BriefcaseBusiness, Building2, CalendarCheck2, ContactRound,
  FolderKanban, Handshake, House, Inbox, LayoutDashboard, Megaphone, MessagesSquare,
  Settings2, ShieldCheck, UsersRound, WalletCards, Wand2, Workflow, type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /** A live count shown next to the item (loaded on the client; hidden when the member cannot see it). */
  badge?: "approvals";
  /** "footer": shown pinned at the bottom of the sidebar instead of in its group. */
  placement?: "footer";
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", href: "/workspace/dashboard", icon: LayoutDashboard, description: "A clear view of your agency's work and priorities." },
      { title: "Leads", href: "/leads", icon: UsersRound, description: "Capture inquiries, assign ownership, and manage your pipeline." },
      { title: "Contacts", href: "/contacts", icon: ContactRound, description: "Keep your client and partner relationships in one place." },
      { title: "Agents", href: "/workspace/agents", icon: BriefcaseBusiness, description: "Organize your agency's agents, branches, and responsibilities." },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { title: "Developers", href: "/developers", icon: Building2, description: "Manage developer relationships and their project portfolios." },
      { title: "Projects", href: "/projects", icon: FolderKanban, description: "Bring project details, inventory, and sales materials together." },
      { title: "Properties", href: "/properties", icon: House, description: "Manage company property inventory and availability." },
      { title: "Listings", href: "/listings", icon: Megaphone, description: "Prepare separate property marketing listings for review." },
      { title: "Deals", href: "/workspace/deals", icon: Handshake, description: "Follow opportunities from first conversation to a completed deal." },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Tasks", href: "/workspace/tasks", icon: CalendarCheck2, description: "Your open follow-ups and work tasks, including those workflows create." },
      { title: "Websites", href: "/websites", icon: Globe, description: "Build landing pages from CRM records, with Claude, review and publishing." },
      { title: "Marketing", href: "/workspace/marketing", icon: Megaphone, description: "Plan campaigns and understand where your inquiries come from." },
      { title: "Inbox", href: "/inbox", icon: Inbox, description: "Customer conversations from WhatsApp, email and website enquiries in one place." },
      { title: "Communications", href: "/communications", icon: MessagesSquare, description: "Calls with customers, call history and the calling rules your company follows." },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { title: "AI Copilot", href: "/ai-copilot", icon: Bot, description: "Ask permission-aware questions about your agency's CRM data." },
      { title: "AI Sales", href: "/ai-sales", icon: Gauge, description: "Lead priorities, follow-up gaps and pipeline metrics from your CRM records." },
      { title: "AI Content Studio", href: "/ai-content", icon: Wand2, description: "Draft marketing and sales content from verified CRM records." },
      { title: "Automation", href: "/automations", icon: Workflow, description: "Approved workflows for assignments, tasks and reminders, with human oversight." },
      { title: "Approvals", href: "/approvals", icon: ShieldCheck, description: "Decide workflow steps that need a person's approval, such as lead reassignments.", badge: "approvals" },
    ],
  },
  {
    label: "Business",
    items: [
      { title: "Finance", href: "/workspace/finance", icon: WalletCards, description: "Track deal finances, commission rules, and payment records." },
      { title: "Reports", href: "/workspace/reports", icon: BarChart3, description: "Understand agency performance with authorized, reliable reporting." },
      { title: "Settings", href: "/settings/company", icon: Settings2, description: "Manage your company profile and active workspace.", placement: "footer" },
    ],
  },
];

export const workspaceModules = navigationGroups
  .flatMap((group) => group.items)
  .filter((item) => item.href !== "/workspace/dashboard");

/** Keep the existing workspace lead URLs active alongside the canonical route. */
export function isNavigationItemActive(pathname: string, href: string) {
  const path = pathname.replace(/^\/workspace\/leads(?=\/|$)/, "/leads");
  return path === href || path.startsWith(`${href}/`);
}
