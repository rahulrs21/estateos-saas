import type { Metadata } from "next";

import { AuthScreen } from "@/modules/auth/components/auth-screen";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to EstateOS using your verified email address.",
};

export default function LoginPage() {
  return <AuthScreen mode="login" />;
}
