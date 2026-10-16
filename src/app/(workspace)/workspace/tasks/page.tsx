import type { Metadata } from "next";
import { ModulePreview } from "@/modules/workspace/components/module-preview";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return <ModulePreview slug="tasks" />;
}
