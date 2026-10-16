"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth, initializeAuth, inMemoryPersistence, signOut, type Auth } from "firebase/auth";

let clientAuth: Auth | undefined;

export function getFirebaseClientAuth(): Auth {
  if (clientAuth) return clientAuth;

  // Explicit accesses are required for Next.js to inline public configuration.
  // Service-account credentials must never be added to this configuration.
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (Object.values(config).some((value) => !value?.trim())) {
    throw new Error("AUTH_CONFIGURATION_MISSING");
  }

  const existing = getApps().find((app) => app.name === "estateos-web");
  clientAuth = existing
    ? getAuth(existing)
    : initializeAuth(initializeApp(config, "estateos-web"), { persistence: inMemoryPersistence });
  clientAuth.languageCode = "en";
  return clientAuth;
}

/** Logout must not need public configuration when no browser auth was initialized. */
export async function clearFirebaseClientAuth(): Promise<void> {
  if (clientAuth) await signOut(clientAuth);
}
