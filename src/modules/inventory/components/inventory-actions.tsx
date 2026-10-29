"use client";

import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { leadRequest } from "@/modules/leads/client";

export function ArchiveDeveloperButton({id, organizationId, hasProjects}: {id: string; organizationId: string; hasProjects: boolean}) {
  const router = useRouter();
  async function archive() {
    if (hasProjects) return;
    if (!window.confirm("Archive this developer? The archived record will no longer appear in active developer lists.")) return;
    try {
      await leadRequest(`/api/inventory/developers/${id}/archive`, "POST", {}, organizationId);
      toast.success("Developer archived.");
      router.push("/developers");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "The developer could not be archived."); }
  }
  return <Button variant="destructive" disabled={hasProjects} onClick={archive} title={hasProjects ? "Archive or move active projects first." : undefined}><Archive aria-hidden="true" />Archive</Button>;
}
