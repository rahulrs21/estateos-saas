import type { Metadata } from "next";
import { ModulePreview } from "@/modules/workspace/components/module-preview";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return <ModulePreview slug="reports" />;
}
