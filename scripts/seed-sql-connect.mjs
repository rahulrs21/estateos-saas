import { deleteApp } from "firebase-admin/app";
import { localDataConnect, seedLocalDatabase } from "./sql-connect-local.mjs";

const { apps, dc } = localDataConnect();
try {
  await seedLocalDatabase(dc);
  console.log("EstateOS fixtures loaded into the local demo-estateos emulator.");
} finally {
  for (const app of apps) await deleteApp(app);
}
