import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { authCookies } from "./config";
import { classifyAuthConfigurationError } from "./configuration-error";
import { authServiceUnavailable, verifyAuthenticationSession } from "./session-core";

/** React cache only deduplicates within one server render, never across users. */
export const getSession = cache(async () => {
  const cookie = (await cookies()).get(authCookies().session.name)?.value;
  if (!cookie) return null;
  try {
    return await verifyAuthenticationSession(cookie, getFirebaseAdminAuth());
  } catch (error) {
    // Fail closed; configuration/service failures must never authenticate a visitor.
    throw classifyAuthConfigurationError(error) ?? authServiceUnavailable();
  }
});

/** Every protected page and operation must call this, not only a parent layout. */
export async function requireSession() {
  await connection();
  const user = await getSession();
  if (!user) redirect("/login?next=%2Fworkspace%2Fdashboard");
  return user;
}
