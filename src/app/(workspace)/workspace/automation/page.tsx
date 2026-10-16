import type { Metadata } from "next";
import { ModulePreview } from "@/modules/workspace/components/module-preview";

export const metadata: Metadata = { title: "Automation" };

export default function AutomationPage() {
  return <ModulePreview slug="automation" />;
}
