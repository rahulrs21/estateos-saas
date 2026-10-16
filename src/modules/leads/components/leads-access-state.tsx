import Link from "next/link";
import { Building2, CircleAlert, LockKeyhole } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { WorkspaceError } from "@/modules/organizations/server/errors";

export function LeadsAccessState({ error }: { error: WorkspaceError }) {
  const needsOrganization = error.code === "PROFILE_REQUIRED" || error.code === "ORGANIZATION_REQUIRED";
  const unavailable = error.status === 503;
  const title = needsOrganization ? "An active organization is required" : unavailable ? "Lead data is unavailable" : error.status === 400 ? "Check your search or link" : "This lead is unavailable";
  return <div className="space-y-6">
    <PageHeader title="Leads" eyebrow="Your pipeline" description="Build relationships, keep the next step clear, and move opportunities forward." />
    <Card className="py-6 ring-border"><EmptyState icon={needsOrganization ? Building2 : unavailable ? CircleAlert : LockKeyhole} title={title} description={error.message} className="min-h-80">
      <Link href={needsOrganization ? "/workspace/settings" : "/workspace/leads"} className={buttonVariants({ variant: "outline", size: "lg" })}>{needsOrganization ? "View workspace settings" : error.status === 503 ? "Try again" : "Back to leads"}</Link>
    </EmptyState></Card>
    {needsOrganization && <p className="text-xs leading-6 text-muted-foreground">Your profile and active membership must be configured before you can use leads. Organization onboarding is not connected to this screen yet.</p>}
  </div>;
}
