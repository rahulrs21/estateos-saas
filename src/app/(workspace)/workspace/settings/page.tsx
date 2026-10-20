import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { redirect } from "next/navigation";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Settings" };

async function CompanySettingsRedirect() {
  await requireCompanyWorkspace();
  return redirect("/settings/company");
}

export default function SettingsPage() {
  return <Suspense fallback={<PageSkeleton />}>
    <CompanySettingsRedirect />
  </Suspense>;
}
