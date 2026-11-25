import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireSession } from "@/lib/auth/session";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { robots: { index: false, follow: false } };

async function AuthenticatedWorkspace({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const workspace = await requireCompanyWorkspace();
  // Data services still repeat membership/record checks at every operation.
  return <WorkspaceShell user={{ name: user.name, email: user.email }} workspace={workspace}>{children}</WorkspaceShell>;
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<main id="main-content" className="w-full px-3 py-3 sm:px-4 md:py-5 lg:px-5"><PageSkeleton /></main>}>
    <AuthenticatedWorkspace>{children}</AuthenticatedWorkspace>
  </Suspense>;
}
