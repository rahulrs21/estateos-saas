import "server-only";

import * as exampleSdk from "@dataconnect/admin-generated";
import * as messagingSdk from "@dataconnect/admin-generated-messaging";
import { getDataConnect, type DataConnect } from "firebase-admin/data-connect";
import { getFirebaseAdminApp, getFirebaseAdminMessagingApp } from "./admin";
import { operationNames, routedDataConnect } from "./connector-routing.mjs";

/** The operations the "messaging" connector holds (inbox, WhatsApp, email, calls). */
const MESSAGING_OPERATIONS = operationNames(messagingSdk as unknown as Record<string, unknown>);

/**
 * The server's SQL Connect handle: operations of the "messaging" connector run there, everything else on "example"
 * (src/lib/firebase/connector-routing.mjs). Every server module uses this one handle, so callers never choose a
 * connector themselves.
 */
export function sqlConnectHandle(): DataConnect {
  const example = getDataConnect(exampleSdk.connectorConfig, getFirebaseAdminApp());
  const messaging = getDataConnect(messagingSdk.connectorConfig, getFirebaseAdminMessagingApp());
  return routedDataConnect(example, [{names: MESSAGING_OPERATIONS, dc: messaging}]);
}
