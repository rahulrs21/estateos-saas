import { redirect } from "next/navigation";

/** The communication hub moved to /communications (Phase 6F). */
export default function LegacyCommunicationsPage() {
  redirect("/communications");
}
