import type { Metadata } from "next";
import { TeamPage } from "@/modules/organizations/components/team-page";
export const metadata: Metadata = { title: "Team invitations" };
export default function TeamInvitationsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <TeamPage {...props} invitations />;
}
