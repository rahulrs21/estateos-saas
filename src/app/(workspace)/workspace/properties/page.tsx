import type { Metadata } from "next";
import { ModulePreview } from "@/modules/workspace/components/module-preview";

export const metadata: Metadata = { title: "Properties" };

export default function PropertiesPage() {
  return <ModulePreview slug="properties" />;
}
