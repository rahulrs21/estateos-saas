import { spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Real Next routes in an isolated source copy; never loads .env.local or stops the user's dev server. */
export async function startAuthHttpServer() {
  mkdirSync(join(root, ".tmp"), { recursive: true });
  const directory = mkdtempSync(join(root, ".tmp/auth-http-"));
  cpSync(join(root, "src"), join(directory, "src"), { recursive: true });
  cpSync(join(root, "package.json"), join(directory, "package.json"));
  cpSync(join(root, "tsconfig.json"), join(directory, "tsconfig.json"));
  symlinkSync(join(root, "node_modules"), join(directory, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  // These tests verify HTTP/session boundaries, not CSS or visual appearance.
  writeFileSync(join(directory, "src/app/globals.css"), "/* HTTP test fixture: visual styles are outside this suite. */\n");
  const reservation = createServer();
  await new Promise((resolveReady, reject) => { reservation.once("error", reject); reservation.listen(0, "127.0.0.1", resolveReady); });
  const port = reservation.address().port;
  await new Promise(resolveClosed => reservation.close(resolveClosed));
  const origin = `http://127.0.0.1:${port}`;
  writeFileSync(join(directory, "server.cjs"), `
    const next = require('next');
    const { createServer } = require('node:http');
    const app = next({dev:true,webpack:true,dir:process.cwd(),hostname:'127.0.0.1',port:${port},conf:{cacheComponents:true,partialPrefetching:true}});
    const handle = app.getRequestHandler();
    app.prepare().then(() => createServer((req,res) => handle(req,res)).listen(${port},'127.0.0.1'));
  `);
  const env = { ...process.env, NODE_ENV: "development", APP_ORIGIN: origin, FIREBASE_PROJECT_ID: "demo-estateos", FIREBASE_ADMIN_PROJECT_ID: "", FIREBASE_CLIENT_EMAIL: "", FIREBASE_ADMIN_CLIENT_EMAIL: "", FIREBASE_PRIVATE_KEY: "", FIREBASE_ADMIN_PRIVATE_KEY: "", GOOGLE_APPLICATION_CREDENTIALS: "", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:19099", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-estateos", NEXT_PUBLIC_FIREBASE_API_KEY: "local-emulator-only", NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:local-only", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-estateos.firebaseapp.com" };
  delete env.DATA_CONNECT_EMULATOR_HOST;
  const child = spawn(process.execPath, [join(directory, "server.cjs")], { cwd: directory, env, stdio: "ignore", windowsHide: true });
  let failure;
  child.once("error", error => { failure = error; });
  const stop = async () => {
    if (child.exitCode === null && !child.killed) {
      child.kill();
      await Promise.race([new Promise(resolveExited => child.once("exit", resolveExited)), pause(5000)]);
    }
    // Retain the ignored copy for failure inspection; no credential files were copied.
  };
  try {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (failure || child.exitCode !== null) throw new Error("The isolated Next auth server could not start");
      try {
        const response = await fetch(origin + "/api/auth/csrf", { signal: AbortSignal.timeout(2000) });
        if (response.ok) return { origin, stop };
      } catch { /* Wait for local compilation. */ }
      await pause(250);
    }
    throw new Error("Timed out starting the isolated Next auth server");
  } catch (error) { await stop(); throw error; }
}
