import Link from "next/link";
import { Building2, CircleAlert, LockKeyhole } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { WorkspaceError } from "@/modules/organizations/server/errors";

export function LeadsAccessState({ error, scope = "resource" }: { error: WorkspaceError; scope?: "list" | "detail" | "resource" }) {
  const needsOrganization = error.code === "PROFILE_REQUIRED" || error.code === "ORGANIZATION_REQUIRED";
  const unavailable = error.status === 503;
  const title = needsOrganization
    ? "An active organization is required"
    : error.status === 401
      ? "Sign in to continue"
      : error.status === 403
        ? "You don't have access to these leads"
        : unavailable
          ? "Lead data couldn't be loaded"
          : error.status === 400
            ? "Check your search or link"
            : error.status === 404 && scope === "detail"
              ? "This lead is unavailable"
              : scope === "list"
                ? "We couldn't load your leads"
                : "This lead couldn't be loaded";
  return <div className="space-y-6">
    <PageHeader title="Leads" eyebrow="Your pipeline" description="Build relationships, keep the next step clear, and move opportunities forward." />
    <Card className="py-6 ring-border"><EmptyState icon={needsOrganization ? Building2 : unavailable ? CircleAlert : LockKeyhole} title={title} description={error.message} className="min-h-80">
      <Link href={needsOrganization ? "/onboarding/company" : scope === "detail" ? "/leads" : "/workspace/dashboard"} className={buttonVariants({ variant: "outline", size: "lg" })}>{needsOrganization ? "Choose or create a workspace" : unavailable ? "Return to workspace" : scope === "detail" ? "Back to leads" : "Back to dashboard"}</Link>
    </EmptyState></Card>
    {needsOrganization && <p className="text-xs leading-6 text-muted-foreground">Choose a company where you have an active membership before opening its leads.</p>}
  </div>;
}
