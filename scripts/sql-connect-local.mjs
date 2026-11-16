import { readFile } from "node:fs/promises";
import { initializeApp } from "firebase-admin/app";
import { getDataConnect } from "firebase-admin/data-connect";
import * as exampleSdk from "@dataconnect/admin-generated";
import * as messagingSdk from "@dataconnect/admin-generated-messaging";
import { operationNames, routedDataConnect } from "../src/lib/firebase/connector-routing.mjs";
import { assertResetAllowed } from "./local-db-lib.mjs";

const { connectorConfig } = exampleSdk;
/** Both connectors' generated functions and enums in one object, for the untyped tests and tooling. */
export const sdk = { ...messagingSdk, ...exampleSdk };

/** One handle that runs each operation on its own connector ("example" or "messaging"), as the app does. */
export function routedLocalHandle(app, messagingApp) {
  return routedDataConnect(getDataConnect(connectorConfig, app), [
    { names: operationNames(messagingSdk), dc: getDataConnect(messagingSdk.connectorConfig, messagingApp) },
  ]);
}

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
  // firebase-admin keeps one SQL Connect handle per app and service, so the second connector needs its own app.
  const messagingApp = initializeApp({ projectId }, `estateos-local-${process.pid}-messaging`);
  return { app, apps: [app, messagingApp], dc: routedLocalHandle(app, messagingApp) };
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
  await dc.executeGraphql(source, { operationName: "ResetEstateOSWebsites" });
  await dc.executeGraphql(source, { operationName: "ResetEstateOS" });
  await dc.executeGraphql(source, { operationName: "SeedEstateOS" });
}
