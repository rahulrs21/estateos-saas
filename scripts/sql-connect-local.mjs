import { readFile } from "node:fs/promises";
import { initializeApp } from "firebase-admin/app";
import { getDataConnect } from "firebase-admin/data-connect";
import { connectorConfig } from "@dataconnect/admin-generated";
import { assertResetAllowed } from "./local-db-lib.mjs";

export const LOCAL_PROJECT_ID = "demo-estateos";
export const SQL_TEST_PROJECT_ID = "demo-estateos-test";

function localProjectIdFromEnvironment() {
  const projectIds = [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT].filter(Boolean);
  if (projectIds.some((projectId) => ![LOCAL_PROJECT_ID, SQL_TEST_PROJECT_ID].includes(projectId))) {
    throw new Error(`Local SQL tooling accepts only ${LOCAL_PROJECT_ID} or ${SQL_TEST_PROJECT_ID}.`);
  }
  if (new Set(projectIds).size > 1) throw new Error("Conflicting local SQL project IDs are not allowed.");
  return projectIds[0] ?? LOCAL_PROJECT_ID;
}

/** Test/seed tooling only. Never load .env.local or fall back to a hosted service. */
export function localDataConnect() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Local SQL Connect tooling cannot run in production.");
  }
  const host = process.env.DATA_CONNECT_EMULATOR_HOST;
  if (!host || !/^127\.0\.0\.1:\d+$/.test(host)) {
    throw new Error("Set DATA_CONNECT_EMULATOR_HOST to the loopback emulator (127.0.0.1:PORT).");
  }
  const projectId = localProjectIdFromEnvironment();
  const app = initializeApp({ projectId }, `estateos-local-${process.pid}`);
  return { app, dc: getDataConnect(connectorConfig, app) };
}

export async function seedLocalDatabase(dc) {
  // Seed operations intentionally live outside the deployable connector. Only
  // this guarded local harness executes them with privileged emulator access.
  // ResetEstateOS deletes every row: refuse the dev:local database unless confirmed.
  assertResetAllowed({
    host: process.env.DATA_CONNECT_EMULATOR_HOST,
    projectId: localProjectIdFromEnvironment(),
    confirmation: process.env.ESTATEOS_CONFIRM_LOCAL_RESET,
  });
  const source = await readFile(new URL("../dataconnect/seed_data.gql", import.meta.url), "utf8");
  await dc.executeGraphql(source, { operationName: "ResetEstateOS" });
  await dc.executeGraphql(source, { operationName: "SeedEstateOS" });
}
