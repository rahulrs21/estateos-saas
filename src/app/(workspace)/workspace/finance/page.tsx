import type { Metadata } from "next";
import { ModulePreview } from "@/modules/workspace/components/module-preview";

export const metadata: Metadata = { title: "Finance" };

export default function FinancePage() {
  return <ModulePreview slug="finance" />;
}
