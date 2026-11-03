import { redirect } from "next/navigation";

/** The automation area moved to /automations. */
export default function AutomationPage() {
  redirect("/automations");
}
