import { deleteApp } from "firebase-admin/app";
import { localDataConnect, seedLocalDatabase } from "./sql-connect-local.mjs";

const { app, dc } = localDataConnect();
try {
  await seedLocalDatabase(dc);
  console.log("EstateOS fixtures loaded into the local demo-estateos emulator.");
} finally {
  await deleteApp(app);
}
