import {
  BarChart3, Bot, BriefcaseBusiness, Building2, CalendarCheck2, ContactRound,
  FolderKanban, Handshake, House, LayoutDashboard, Megaphone, MessagesSquare,
  Settings2, UsersRound, WalletCards, Workflow, type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
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
      { title: "Leads", href: "/workspace/leads", icon: UsersRound, description: "Capture inquiries, assign ownership, and manage your pipeline." },
      { title: "Contacts", href: "/workspace/contacts", icon: ContactRound, description: "Keep your client and partner relationships in one place." },
      { title: "Agents", href: "/workspace/agents", icon: BriefcaseBusiness, description: "Organize your agency's agents, branches, and responsibilities." },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { title: "Developers", href: "/workspace/developers", icon: Building2, description: "Manage developer relationships and their project portfolios." },
      { title: "Projects", href: "/workspace/projects", icon: FolderKanban, description: "Bring project details, inventory, and sales materials together." },
      { title: "Properties", href: "/workspace/properties", icon: House, description: "Manage property inventory, availability, and listing information." },
      { title: "Deals", href: "/workspace/deals", icon: Handshake, description: "Follow opportunities from first conversation to a completed deal." },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Tasks", href: "/workspace/tasks", icon: CalendarCheck2, description: "Coordinate follow-ups, viewings, and your team's daily work." },
      { title: "Marketing", href: "/workspace/marketing", icon: Megaphone, description: "Plan campaigns and understand where your inquiries come from." },
      { title: "Communications", href: "/workspace/communications", icon: MessagesSquare, description: "Bring client conversations and communication history together." },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { title: "AI Copilot", href: "/workspace/ai-copilot", icon: Bot, description: "Get permission-aware assistance with your agency's CRM work." },
      { title: "Automation", href: "/workspace/automation", icon: Workflow, description: "Coordinate repeatable workflows with explicit rules and oversight." },
    ],
  },
  {
    label: "Business",
    items: [
      { title: "Finance", href: "/workspace/finance", icon: WalletCards, description: "Track deal finances, commission rules, and payment records." },
      { title: "Reports", href: "/workspace/reports", icon: BarChart3, description: "Understand agency performance with authorized, reliable reporting." },
      { title: "Settings", href: "/workspace/settings", icon: Settings2, description: "Manage your organization, memberships, permissions, and preferences." },
    ],
  },
];

export const workspaceModules = navigationGroups
  .flatMap((group) => group.items)
  .filter((item) => item.href !== "/workspace/dashboard");
