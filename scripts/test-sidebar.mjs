import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = join(root, ".tmp");
mkdirSync(temporaryRoot, { recursive: true });
const fixture = mkdtempSync(join(temporaryRoot, "sidebar-ui-"));
const browsers = process.env.ESTATEOS_TEST_BROWSER ? [process.env.ESTATEOS_TEST_BROWSER] : [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(existsSync);
if (!browsers.length) throw new Error("Install Chrome/Edge, or set ESTATEOS_TEST_BROWSER to a Chromium executable.");

function stop(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }); } catch { /* Already stopped. */ }
  } else { child.kill("SIGTERM"); }
}
function write(name, content) {
  const target = join(fixture, name);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

// Isolated loopback UI fixture using the real shell/dashboard. It does not load
// .env.local, verify or fake sessions, call Firebase, or expose production routes.
write("package.json", '{"name":"estateos-sidebar-ui-test","private":true}');
write("next.config.mjs", `export default {turbopack:{root:${JSON.stringify(root)},rules:{'*.css':{loaders:['@tailwindcss/turbopack'],as:'*.css'}}}};`);
write("tsconfig.json", JSON.stringify({ compilerOptions: { target: "ES2022", lib: ["dom", "dom.iterable", "esnext"], strict: true, noEmit: true, module: "esnext", moduleResolution: "bundler", jsx: "react-jsx", esModuleInterop: true, skipLibCheck: true, baseUrl: "../..", paths: { "@/*": ["src/*"] }, plugins: [{ name: "next" }] }, include: ["**/*.ts", "**/*.tsx", ".next/dev/types/**/*.ts"], exclude: ["node_modules"] }));
// Never add a test-only Tailwind source scan: that can conceal missing app CSS.
// Optionally replay the CSS served by an already running local app, without
// borrowing its browser profile, authentication cookies or private pages.
let stylesheet = '@import "../../../src/app/globals.css";';
if (process.env.ESTATEOS_TEST_APP_URL) {
  const app = new URL(process.env.ESTATEOS_TEST_APP_URL);
  if (app.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(app.hostname) || app.username || app.password || app.pathname !== "/" || app.search || app.hash) throw new Error("ESTATEOS_TEST_APP_URL must be a loopback HTTP origin.");
  const response = await fetch(app, { redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("The local app's public homepage could not be loaded.");
  const html = await response.text();
  const paths = [...html.matchAll(/href="([^"]+\.css(?:\?[^"]*)?)"/g)].map(match => new URL(match[1].replaceAll("&amp;", "&"), app));
  if (!paths.length || paths.some(path => path.origin !== app.origin || !path.pathname.startsWith("/_next/"))) throw new Error("Expected same-origin Next.js stylesheets on the public homepage.");
  stylesheet = (await Promise.all(paths.map(async path => {
    const css = await fetch(path, { redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!css.ok) throw new Error("The local app's generated stylesheet could not be loaded.");
    return css.text();
  }))).join("\n");
  console.log("Using the running app's generated CSS from " + app.origin);
}
write("app/style.css", stylesheet);
write("app/layout.tsx", `import {Providers} from '@/components/providers';import './style.css';export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>}`);
write("app/workspace/dashboard/page.tsx", `'use client';
import {useEffect,useState} from 'react';
import {WorkspaceShell} from '@/components/layout/workspace-shell';
import {Dashboard} from '@/modules/dashboard/components/dashboard';
import type {CompanyChoice} from '@/modules/organizations/types';
const choices:CompanyChoice[]=[{id:'10000000-0000-4000-8000-000000000001',name:'UI Test Company A',slug:'ui-a',role:'OWNER'},{id:'20000000-0000-4000-8000-000000000001',name:'UI Test Company B',slug:'ui-b',role:'OWNER'}];
export default function Fixture(){const [index,setIndex]=useState(0);const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);const company=choices[index];return <><button id="fixture-company-switch" data-fixture-ready={ready} style={{position:'fixed',bottom:8,right:8,zIndex:100}} onClick={()=>setIndex(i=>1-i)}>Switch UI fixture</button><WorkspaceShell workspace={{companies:[company],activeCompany:company,hasPendingInvitations:false}} user={{name:'UI Test User',email:'ui@example.test'}}><Dashboard companyName={company.name}/></WorkspaceShell></>}`);

const reservation = createServer();
await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
let server;
let worker;
let log = "";
try {
  server = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: fixture, windowsHide: true, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", data => { log = (log + data).slice(-8000); });
  server.stderr.on("data", data => { log = (log + data).slice(-8000); });
  const url = `http://127.0.0.1:${port}/workspace/dashboard`;
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error("UI fixture server exited: " + log);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch { /* Still compiling. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("The local UI fixture did not start: " + log);
  for (const [index, browser] of browsers.entries()) {
    worker = spawn(process.execPath, [join(root, "tests/sidebar-browser.test.mjs"), url, browser, join(fixture, "browser-" + index)], { cwd: root, windowsHide: true, stdio: "inherit" });
    const code = await new Promise((resolve, reject) => { worker.once("error", reject); worker.once("exit", resolve); });
    if (code !== 0) throw new Error("Sidebar browser regression failed.");
  }
} finally {
  stop(worker);
  stop(server);
  // Verify the absolute cleanup target is the unique directory created here.
  const target = resolve(fixture);
  const scoped = relative(temporaryRoot, target);
  if (scoped && !scoped.startsWith("..") && !isAbsolute(scoped) && dirname(target) === resolve(temporaryRoot)) {
    rmSync(target, { recursive: true, force: true, maxRetries: 15, retryDelay: 200 });
  }
}
