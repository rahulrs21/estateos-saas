import type { Metadata } from "next";
import { ModulePreview } from "@/modules/workspace/components/module-preview";

export const metadata: Metadata = { title: "Marketing" };

export default function MarketingPage() {
  return <ModulePreview slug="marketing" />;
}
