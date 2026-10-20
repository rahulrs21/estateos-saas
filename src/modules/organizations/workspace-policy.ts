import { canonicalUuid } from "./server/identifiers";
import type { CompanyChoice, CompanyWorkspace } from "./types";

interface MembershipChoice {
  organizationId: string;
  userProfileUid?: string | null;
  status: string;
  role: string;
  organization: { id: string; name: string; slug: string };
}

/** Defense in depth: selection and claims never manufacture membership. */
export function resolveCompanyWorkspace(uid: string, selectedId: string | null | undefined, rows: MembershipChoice[], hasPendingInvitations = false): CompanyWorkspace {
  const companies: CompanyChoice[] = rows.filter(row =>
    row.userProfileUid === uid && row.status === "ACTIVE" &&
    ["OWNER", "ADMIN", "MANAGER", "AGENT"].includes(row.role) &&
    canonicalUuid(row.organizationId) === canonicalUuid(row.organization.id),
  ).map(row => ({
    id: canonicalUuid(row.organizationId), name: row.organization.name, slug: row.organization.slug,
    role: row.role as CompanyChoice["role"],
  }));
  const activeCompany = companies.find(company => selectedId && company.id === canonicalUuid(selectedId)) ?? null;
  return { companies, activeCompany, hasPendingInvitations };
}

export function companyWorkspaceDestination(workspace: CompanyWorkspace): string | null {
  if (workspace.activeCompany) return null;
  if (workspace.companies.length) return "/onboarding/company?select=1";
  return workspace.hasPendingInvitations ? "/invite/accept" : "/onboarding/company";
}

/** Company registration is an explicit intent, never a requirement for invitees. */
export function companyOnboardingState(workspace: CompanyWorkspace, createAnother: boolean) {
  if (createAnother) return { view: "create", redirect: null } as const;
  if (workspace.activeCompany) return { view: "choose", redirect: "/workspace/dashboard" } as const;
  if (workspace.companies.length) return { view: "select", redirect: null } as const;
  if (workspace.hasPendingInvitations) return { view: "choose", redirect: "/invite/accept" } as const;
  return { view: "choose", redirect: null } as const;
}
