import type { Metadata } from "next";
import { TeamPage } from "@/modules/organizations/components/team-page";
export const metadata: Metadata = { title: "Team members" };
export default function TeamMembersPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <TeamPage {...props} />;
}
