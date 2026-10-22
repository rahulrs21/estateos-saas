import Link from "next/link";
import { Building2, CircleAlert, LockKeyhole } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { WorkspaceError } from "@/modules/organizations/server/errors";

export function ContactsAccessState({ error, detail = false }: { error: WorkspaceError; detail?: boolean }) {
  const needsOrganization = error.code === "PROFILE_REQUIRED" || error.code === "ORGANIZATION_REQUIRED";
  const title = needsOrganization
    ? "An active organization is required"
    : error.status === 401
      ? "Sign in to continue"
      : error.status === 403
        ? "You don't have access to these contacts"
        : error.status === 404 && detail
          ? "This contact is unavailable"
          : error.status === 400
            ? "Check your search or link"
            : error.status === 503
              ? "Contact data couldn't be loaded"
              : "We couldn't load contacts";
  const href = needsOrganization ? "/onboarding/company" : detail ? "/contacts" : "/workspace/dashboard";
  return <div className="space-y-6">
    <PageHeader title="Contacts" eyebrow="Your relationships" description="Keep customer information organized within your company workspace." />
    <Card className="py-6 ring-border"><EmptyState icon={needsOrganization ? Building2 : error.status === 503 ? CircleAlert : LockKeyhole} title={title} description={error.message} className="min-h-80">
      <Link href={href} className={buttonVariants({ variant: "outline", size: "lg" })}>{needsOrganization ? "Choose or create a workspace" : detail ? "Back to contacts" : "Back to dashboard"}</Link>
    </EmptyState></Card>
  </div>;
}
