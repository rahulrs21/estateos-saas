import Link from "next/link";
import { Suspense } from "react";
import { MapPinOff } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { requireSession } from "@/modules/auth/server/session";

async function AuthenticatedWorkspaceNotFound() {
  await requireSession();
  return <section aria-labelledby="workspace-not-found"><h1 id="workspace-not-found" className="sr-only">Page not found</h1><EmptyState icon={MapPinOff} title="This workspace page doesn’t exist" description="Choose a module from the navigation, or return to the dashboard." className="min-h-[60vh]"><Link href="/workspace/dashboard" className={buttonVariants({ size: "lg" })}>Back to dashboard</Link></EmptyState></section>;
}

export default function WorkspaceNotFound() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AuthenticatedWorkspaceNotFound />
    </Suspense>
  );
}
