import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireSession } from "@/modules/auth/server/session";

async function AuthenticatedWorkspaceRedirect() {
  await requireSession();
  return redirect("/workspace/dashboard");
}

export default function WorkspaceIndex() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AuthenticatedWorkspaceRedirect />
    </Suspense>
  );
}
