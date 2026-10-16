import type { Metadata } from "next";
import { ModulePreview } from "@/modules/workspace/components/module-preview";

export const metadata: Metadata = { title: "Agents" };

export default function AgentsPage() {
  return <ModulePreview slug="agents" />;
}
