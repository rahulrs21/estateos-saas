import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireCompanyWorkspace } from "../server/workspace";
import { getTeamPage } from "../server/team-service";
import { WorkspaceError } from "../server/errors";
import { TeamSettings } from "./team-settings";

type Params = Promise<Record<string, string | string[] | undefined>>;
async function Content({ searchParams, invitations }: { searchParams: Params; invitations: boolean }) {
  await requireCompanyWorkspace();
  const params = await searchParams;
  const input = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined));
  let result: Awaited<ReturnType<typeof getTeamPage>> | undefined;
  let failure: WorkspaceError | undefined;
  try { result = await getTeamPage(input, invitations); }
  catch (error) {
    if (error instanceof WorkspaceError && error.code === "SQL_CONNECT_NOT_CONFIGURED") redirect("/setup/database");
    if (!(error instanceof WorkspaceError) || ![400, 403].includes(error.status)) throw error;
    failure = error;
  }
  if (failure) return <section className="mx-auto max-w-xl space-y-4 py-10"><h1 className="text-2xl font-semibold">{failure.status === 403 ? "Team management requires administrator access" : "Check your team filters"}</h1><p className="text-sm leading-6 text-muted-foreground">{failure.status === 403 ? "An owner or administrator manages team memberships and invitations for this company." : "Use a valid search, status and page number."}</p><Link href={failure.status === 403 ? "/workspace/dashboard" : invitations ? "/settings/team/invitations" : "/settings/team"} className="inline-block rounded text-sm font-medium text-primary">{failure.status === 403 ? "Return to dashboard" : "Reset filters"}</Link></section>;
  return <TeamSettings result={result!} />;
}
export function TeamPage(props: { searchParams: Params; invitations?: boolean }) {
  return <Suspense fallback={<PageSkeleton />}><Content searchParams={props.searchParams} invitations={props.invitations ?? false} /></Suspense>;
}
