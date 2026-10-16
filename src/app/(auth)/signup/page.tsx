import type { Metadata } from "next";

import { AuthScreen } from "@/modules/auth/components/auth-screen";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create an EstateOS account with email verification.",
};

export default function SignupPage() {
  return <AuthScreen mode="signup" />;
}
