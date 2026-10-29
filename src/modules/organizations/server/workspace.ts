import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getMyProfile } from "@dataconnect/admin-generated";
import { requireSession } from "@/lib/auth/session";
import { requireSqlConnectRequest, executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { listMyOrganizations } from "./service";
import { WorkspaceError } from "./errors";
import { getPendingCompanyInvitations } from "./pending-invitations";
import { companyWorkspaceDestination, resolveCompanyWorkspace } from "../workspace-policy";

/** Request-render deduplication only; no cross-user or shared private cache. */
export const getCompanyWorkspace = cache(async () => {
  await requireSession();
  const request = await requireSqlConnectRequest();
  try {
    const [profile, choices] = await Promise.all([
      executeWorkspaceOperation(() => getMyProfile(request.dc, request.options), "GetMyProfile"),
      listMyOrganizations(),
    ]);
    // Invitation discovery is needed only when no company is already available.
    // It never substitutes for the ACTIVE membership checks protecting data.
    const pending = choices.memberships.length === 0 ? await getPendingCompanyInvitations() : null;
    return resolveCompanyWorkspace(request.user.uid, profile.userProfile?.activeOrganizationId, choices.memberships, Boolean(pending?.invitations.length));
  } catch (error: unknown) {
    // A missing connector is an installation problem, never an empty membership
    // result. The setup page verifies identity without querying tenant data.
    if (error instanceof WorkspaceError && error.code === "SQL_CONNECT_NOT_CONFIGURED") {
      redirect("/setup/database");
    }
    throw error;
  }
});

export async function requireCompanyWorkspace() {
  const workspace = await getCompanyWorkspace();
  const destination = companyWorkspaceDestination(workspace);
  if (destination) redirect(destination);
  if (!workspace.activeCompany) redirect("/onboarding/company");
  return { ...workspace, activeCompany: workspace.activeCompany };
}
