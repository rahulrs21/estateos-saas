import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Properties" };

export default function PropertiesPage() {
  redirect("/properties");
}
