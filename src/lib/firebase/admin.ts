import "server-only";

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFirebaseAdminConfiguration } from "@/modules/auth/server/configuration-policy";

const ADMIN_APP_NAME = "estateos-admin";

/** Never import this module into a Client Component. Credentials stay on the server. */
export function getFirebaseAdminApp() {
  if (process.env.NODE_ENV === "production" && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error("The authentication emulator cannot be used in production.");
  }
  const existingApp = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existingApp) return existingApp;

  const { projectId, credentials } = readFirebaseAdminConfiguration({
    projectId: process.env.FIREBASE_PROJECT_ID,
    adminProjectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    publicProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    adminClientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    adminPrivateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  });
  const credential = credentials ? cert(credentials) : applicationDefault();

  return initializeApp({ projectId, credential }, ADMIN_APP_NAME);
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}
