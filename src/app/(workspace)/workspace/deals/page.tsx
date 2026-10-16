import type { Metadata } from "next";
import { ModulePreview } from "@/modules/workspace/components/module-preview";

export const metadata: Metadata = { title: "Deals" };

export default function DealsPage() {
  return <ModulePreview slug="deals" />;
}
