import "server-only";

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { readFirebaseAdminConfiguration } from "@/modules/auth/server/configuration-policy";

const ADMIN_APP_NAME = "estateos-admin";
/**
 * The same credentials under a second app name, for the "messaging" SQL Connect connector. firebase-admin keeps one
 * SQL Connect handle per app and service (whatever the connector), so each connector needs its own app
 * (src/lib/firebase/sql-connect-handle.ts).
 */
const MESSAGING_APP_NAME = "estateos-admin-messaging";

/** Never import this module into a Client Component. Credentials stay on the server. */
export function getFirebaseAdminApp() {
  return adminApp(ADMIN_APP_NAME);
}

/** The admin app for the "messaging" SQL Connect connector only. */
export function getFirebaseAdminMessagingApp() {
  return adminApp(MESSAGING_APP_NAME);
}

function adminApp(name: string) {
  if (process.env.NODE_ENV === "production" && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error("The authentication emulator cannot be used in production.");
  }
  const existingApp = getApps().find((app) => app.name === name);
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

  return initializeApp({ projectId, credential, storageBucket: process.env.FIREBASE_STORAGE_BUCKET }, name);
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminStorageBucket() {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (!bucketName) throw new Error("FIREBASE_STORAGE_BUCKET is required for private inventory media.");
  return getStorage(getFirebaseAdminApp()).bucket(bucketName);
}
