import { readFile } from "node:fs/promises";
import { initializeApp } from "firebase-admin/app";
import { getDataConnect } from "firebase-admin/data-connect";
import { connectorConfig } from "@dataconnect/admin-generated";

export const LOCAL_PROJECT_ID = "demo-estateos";

/** Test/seed tooling only. Never load .env.local or fall back to a hosted service. */
export function localDataConnect() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Local SQL Connect tooling cannot run in production.");
  }
  const host = process.env.DATA_CONNECT_EMULATOR_HOST;
  if (!host || !/^127\.0\.0\.1:\d+$/.test(host)) {
    throw new Error("Set DATA_CONNECT_EMULATOR_HOST to the loopback emulator (127.0.0.1:PORT).");
  }
  for (const key of ["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT"]) {
    if (process.env[key] && process.env[key] !== LOCAL_PROJECT_ID) {
      throw new Error(`${key} must be ${LOCAL_PROJECT_ID} for local seeding and tests.`);
    }
  }
  const app = initializeApp({ projectId: LOCAL_PROJECT_ID }, `estateos-local-${process.pid}`);
  return { app, dc: getDataConnect(connectorConfig, app) };
}

export async function seedLocalDatabase(dc) {
  // Seed operations intentionally live outside the deployable connector. Only
  // this guarded local harness executes them with privileged emulator access.
  const source = await readFile(new URL("../dataconnect/seed_data.gql", import.meta.url), "utf8");
  await dc.executeGraphql(source, { operationName: "ResetEstateOS" });
  await dc.executeGraphql(source, { operationName: "SeedEstateOS" });
}
