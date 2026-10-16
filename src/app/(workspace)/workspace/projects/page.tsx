import type { Metadata } from "next";
import { ModulePreview } from "@/modules/workspace/components/module-preview";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return <ModulePreview slug="projects" />;
}
