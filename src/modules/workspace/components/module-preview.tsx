import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { workspaceModules } from "@/config/navigation";
import { requireSession } from "@/lib/auth/session";

type Capability = { title: string; description: string };

const capabilities: Record<string, Capability[]> = {
  leads: [
    { title: "Lead workspace", description: "Validated inquiries with source, stage, ownership, and an auditable history." },
    { title: "Distribution rules", description: "Organization-scoped assignment with branch and agent permissions." },
    { title: "Sales pipeline", description: "Clear stages and follow-up priorities backed by real lead records." },
  ],
  contacts: [
    { title: "Client directory", description: "Structured profiles for buyers, sellers, landlords, and tenants." },
    { title: "Relationship history", description: "Authorized access to related inquiries, viewings, and conversations." },
    { title: "Contact preferences", description: "Communication preferences and consent stored with each relationship." },
  ],
  agents: [
    { title: "Team directory", description: "Agent profiles tied to verified organization memberships." },
    { title: "Branch structure", description: "Clear team responsibilities across your agency's branches." },
    { title: "Access management", description: "Server-enforced roles and record visibility for each team member." },
  ],
  developers: [
    { title: "Developer directory", description: "Agency-managed developer profiles and relationship contacts." },
    { title: "Project connections", description: "A clear relationship between developers and their project portfolios." },
    { title: "Sales resources", description: "Permission-controlled access to approved documents and materials." },
  ],
  projects: [
    { title: "Project workspace", description: "Location, delivery milestones, and project details in one place." },
    { title: "Inventory overview", description: "Project-linked units and availability backed by verified property data." },
    { title: "Project materials", description: "Organized brochures and assets with controlled storage access." },
  ],
  properties: [
    { title: "Property inventory", description: "Structured listings for sale and rent with ownership and availability." },
    { title: "Media and documents", description: "Property images and documents protected by organization access rules." },
    { title: "Portal feeds", description: "Future reviewed publishing workflows with external portal integrations." },
  ],
  deals: [
    { title: "Opportunity pipeline", description: "Track deal stages and relationships to clients and properties." },
    { title: "Deal milestones", description: "Coordinate viewings, offers, approvals, and completion milestones." },
    { title: "Audit history", description: "A reliable record of sensitive updates and ownership changes." },
  ],
  tasks: [
    { title: "Follow-up planning", description: "Due dates and priorities linked to your team's CRM records." },
    { title: "Viewing coordination", description: "Assigned activities with clear responsibility and completion status." },
    { title: "Notifications", description: "Relevant reminders with user preferences and delivery controls." },
  ],
  marketing: [
    { title: "Campaign planning", description: "Manage campaign details and connect future lead sources." },
    { title: "Websites and landing pages", description: "Future agency website and landing page publishing workflows." },
    { title: "Advertising connections", description: "Future consent-aware integrations with reviewed credentials and permissions." },
  ],
  communications: [
    { title: "Shared conversation history", description: "Client communication linked to authorized contacts and leads." },
    { title: "Channel connections", description: "Future WhatsApp, email, calling, and video provider integrations." },
    { title: "Consent and delivery", description: "Communication preferences, provider status, and auditable delivery events." },
  ],
  automation: [
    { title: "Workflow rules", description: "Explicit triggers and conditions for repeatable agency processes." },
    { title: "Controlled execution", description: "Permission checks, retries, and safeguards for each automated action." },
    { title: "Run history", description: "Visible execution results and audit records for operational oversight." },
  ],
  finance: [
    { title: "Deal finances", description: "Authorized access to financial records linked to completed deals." },
    { title: "Commission rules", description: "Validated calculations and approval workflows for agent commissions." },
    { title: "Financial reporting", description: "Reconciled records and controlled exports for your finance team." },
  ],
  reports: [
    { title: "Agency performance", description: "Real lead, pipeline, and team metrics with clear definitions." },
    { title: "Scoped reporting", description: "Reports constrained by organization, branch, role, and record permissions." },
    { title: "Reviewed exports", description: "Controlled report exports with traceability for sensitive data." },
  ],
  settings: [
    { title: "Organization settings", description: "Verified company and branch administration with an audit trail." },
    { title: "Memberships and roles", description: "Invitations and access policies enforced by server authorization." },
    { title: "Workspace preferences", description: "Organization preferences and future integration configuration." },
  ],
};

function getModule(slug: string) {
  return workspaceModules.find((item) => item.href === `/workspace/${slug}`);
}

// This boundary travels with each destination page. The workspace layout's
// boundary stays mounted during sibling navigation and cannot catch this read.
export function ModulePreview({ slug }: { slug: string }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AuthenticatedModulePreview slug={slug} />
    </Suspense>
  );
}

async function AuthenticatedModulePreview({ slug }: { slug: string }) {
  await requireSession();
  const moduleInfo = getModule(slug);

  if (!moduleInfo) notFound();

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Workspace preview" title={moduleInfo.title} description={moduleInfo.description}>
        <Badge variant="outline" className="h-7 px-3">Not connected</Badge>
      </PageHeader>

      <Card className="min-h-80 justify-center">
        <EmptyState
          icon={moduleInfo.icon}
          title={`${moduleInfo.title} is not connected yet`}
          description="You are signed in. Agency membership, permissions, and business data must be connected before this module can be used."
        >
          <Link
            href="/workspace/dashboard"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </Link>
        </EmptyState>
      </Card>

      <section aria-labelledby="planned-capabilities" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="planned-capabilities" className="text-base font-semibold tracking-tight">Planned capabilities</h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            On the roadmap <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {capabilities[slug]?.map((capability) => (
            <Card key={capability.title} className="bg-card/70">
              <CardHeader className="gap-2">
                <CardTitle className="text-sm">{capability.title}</CardTitle>
                <CardDescription className="leading-relaxed">{capability.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
