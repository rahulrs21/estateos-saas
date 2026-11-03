import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import twilio from "twilio";
import { localDataConnect } from "../scripts/sql-connect-local.mjs";
import { fixture as f } from "./fixtures/sql-connect-fixtures.mjs";

// Phase 6F communication hub against the real app, real sessions and real SQL Connect authorization.
// Run through `npm run test:communications:e2e`. Synthetic, fictional customers and numbers on isolated
// emulators; no provider is configured and no real call is placed.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = process.env.ESTATEOS_E2E_WORKSPACE;
const executable = process.env.ESTATEOS_TEST_BROWSER;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!workspace || !executable || !authHost?.startsWith("127.0.0.1:") || process.env.GCLOUD_PROJECT !== "demo-estateos-test") {
  throw new Error("Run npm run test:communications:e2e; this script needs the isolated emulators it starts.");
}
writeFileSync(join(workspace, "tests-started"), new Date().toISOString());
const screens = join(workspace, "screens");
mkdirSync(screens, {recursive: true});
const pause = ms => new Promise(done => setTimeout(done, ms));
const password = "e2e-only-" + randomUUID();
let checks = 0;
/** A test-only provider credential, generated per run and given to the isolated test server only. */
const providerToken = randomBytes(24).toString("hex");
/** A test-only worker secret and bucket for the isolated test server (recordings and the retention sweep). */
const workerSecret = randomBytes(36).toString("base64url");
const BUCKET = "demo-estateos-test.appspot.com";
const pass = message => { checks++; console.log(`✔ ${message}`); };

// ---------------------------------------------------------------- fixtures
const {app: sqlApp, dc} = localDataConnect();
const seed = readFileSync(join(root, "dataconnect", "seed_data.gql"), "utf8");
if (process.env.DATA_CONNECT_EMULATOR_HOST !== "127.0.0.1:19999") throw new Error("Refusing to reset an unexpected SQL Connect emulator.");
await dc.executeGraphql(seed, {operationName: "ResetEstateOSWebsites"});
await dc.executeGraphql(seed, {operationName: "ResetEstateOS"});
await dc.executeGraphql(seed, {operationName: "SeedEstateOS"});
const authApp = initializeApp({projectId: "demo-estateos-test"}, "communications-e2e-auth");
for (const uid of ["owner-a", "admin-a", "manager-a", "agent-a", "owner-b"]) {
  await getAuth(authApp).createUser({uid, email: `${uid}@example.test`, password, emailVerified: true});
}
async function idToken(uid) {
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({email: `${uid}@example.test`, password, returnSecureToken: true}),
  });
  const body = await response.json();
  if (!body.idToken) throw new Error("Auth emulator sign-in failed for " + uid);
  return body.idToken;
}
const sql = async (query, variables = {}) => (await dc.executeGraphql(query, {variables})).data;

// ---------------------------------------------------------------- app server
const reservation = createServer();
await new Promise(done => reservation.listen(0, "127.0.0.1", done));
const port = reservation.address().port;
await new Promise(done => reservation.close(done));
const origin = `http://127.0.0.1:${port}`;
let serverLog = "";
function startNext() {
  const child = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env, NEXT_TELEMETRY_DISABLED: "1", NODE_ENV: "test", __NEXT_PROCESSED_ENV: "true",
      ESTATEOS_NEXT_DIST_DIR: ".tmp/ai-e2e/next", ESTATEOS_TSCONFIG_PATH: ".tmp/ai-e2e/tsconfig.json",
      APP_ORIGIN: origin, FIREBASE_PROJECT_ID: "demo-estateos-test", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-estateos-test",
      NEXT_PUBLIC_FIREBASE_API_KEY: "demo-key", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "127.0.0.1", NEXT_PUBLIC_FIREBASE_APP_ID: "demo-app",
      RATE_LIMIT_BACKEND: "sql-connect", ESTATEOS_AI_ENABLED: "true",
      // Well-formed but invalid, so Anthropic itself rejects any call.
      ANTHROPIC_API_KEY: `sk-ant-api03-e2e-invalid-${"x".repeat(40)}`, ANTHROPIC_MODEL: "claude-sonnet-5-5", AI_E2E_ANTHROPIC_API_KEY: "",
      COMMS_E2E_TWILIO_TOKEN: providerToken, AUTOMATION_WORKER_SECRET: workerSecret, FIREBASE_STORAGE_BUCKET: BUCKET,
    },
  });
  child.stdout.on("data", data => { serverLog = (serverLog + data).slice(-30000); });
  child.stderr.on("data", data => { serverLog = (serverLog + data).slice(-30000); });
  return child;
}
const server = startNext();
function stop(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") { try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {stdio: "ignore", windowsHide: true}); } catch { /* stopped */ } }
  else child.kill("SIGKILL");
}
async function serverReady() {
  for (let attempt = 0; ; attempt++) {
    if (server.exitCode !== null) throw new Error("Next.js exited: " + serverLog);
    try { if ((await fetch(origin + "/api/auth/csrf", {signal: AbortSignal.timeout(5000)})).ok) return; } catch { /* compiling */ }
    if (attempt > 300) throw new Error("Next.js did not start: " + serverLog);
    await pause(500);
  }
}

// ---------------------------------------------------------------- browser (CDP)
const profile = join(workspace, "browser-profile");
mkdirSync(profile, {recursive: true});
const browser = spawn(executable, ["--headless=new", "--disable-gpu", "--no-proxy-server", "--no-first-run", "--disable-default-apps",
  "--disable-background-networking", "--disable-component-update", "--remote-debugging-port=0", "--user-data-dir=" + profile, "about:blank"], {windowsHide: true, stdio: "ignore"});
let socket, sequence = 0, currentPath = "";
const requests = new Map();
const exceptions = [];
function command(method, params = {}, timeout = 60000) {
  return new Promise((resolveCommand, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { requests.delete(id); reject(new Error("Browser timeout: " + method)); }, timeout);
    requests.set(id, {resolve: value => { clearTimeout(timer); resolveCommand(value); }, reject: error => { clearTimeout(timer); reject(error); }});
    socket.send(JSON.stringify({id, method, params}));
  });
}
async function evaluate(expression, timeout = 60000) {
  const result = await command("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true}, timeout);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression, description, attempts = 600) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { if (await evaluate(expression)) return; } catch { /* navigating */ }
    await pause(200);
  }
  const text = await evaluate("document.body?.innerText ?? ''").catch(() => "");
  throw new Error(`Timed out waiting for ${description}: ${text.slice(0, 1500)}\n--- browser errors ---\n${exceptions.slice(-6).join("\n").slice(0, 3000)}\n--- server ---\n${serverLog.slice(-3000)}`);
}
async function load(path, ready, viewport = {width: 1440, height: 1000, mobile: false}) {
  await command("Emulation.setDeviceMetricsOverride", {width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile});
  currentPath = path;
  await command("Page.navigate", {url: origin + path});
  await waitFor(`document.readyState === "complete"`, `navigation to ${path}`);
  if (ready) await waitFor(ready, `${path} content`);
  await pause(500);
}
async function screenshot(label) {
  const result = await command("Page.captureScreenshot", {format: "png"});
  writeFileSync(join(screens, `${label}.png`), Buffer.from(result.data, "base64"));
}
async function clickText(label, selector = "button,a") {
  await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim().startsWith(${JSON.stringify(label)})&&!e.disabled);if(!e)throw Error('Missing control: '+${JSON.stringify(label)});e.scrollIntoView({block:'center'});e.click();})()`);
}
/** Sets a field in the open dialog the way a person would (React sees the input/change event). */
async function setField(name, value) {
  await evaluate(`(()=>{const d=document.querySelector('[role=dialog]');const e=d&&d.querySelector('[name=${JSON.stringify(name)}]');if(!e)throw Error('Missing field: ${name}');
    if(e.type==='checkbox'){if(e.checked!==${JSON.stringify(Boolean(value))})e.click();return;}
    const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await pause(100);
}
async function api(path, init = {}) {
  return evaluate(`(async()=>{const init=${JSON.stringify(init)};
    if(init.method&&init.method!=='GET'){const c=await (await fetch('/api/auth/csrf')).json();init.headers={'Content-Type':'application/json',...(init.headers||{}),'X-CSRF-Token':c.csrfToken};}
    const r=await fetch(${JSON.stringify(path)},init);let body=null;const text=await r.text();try{body=JSON.parse(text)}catch{body=text}
    return {status:r.status,body};})()`, 240000);
}
async function signIn(uid) {
  await command("Network.clearBrowserCookies");
  await load("/api/auth/session");
  const token = await idToken(uid);
  const result = await evaluate(`(async()=>{const c=await (await fetch('/api/auth/csrf')).json();
    const r=await fetch('/api/auth/session',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':c.csrfToken},body:JSON.stringify({idToken:${JSON.stringify(token)}})});
    return {status:r.status,body:await r.json()};})()`);
  assert.equal(result.status, 200, `session for ${uid}: ${JSON.stringify(result.body)}`);
  await load("/onboarding/company?select=1", "[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Open workspace')) || document.body.innerText.includes('Signed in as')");
  if (!await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Open workspace'))")) return;
  await evaluate(`(()=>{const s=document.querySelector('form select');if(s&&!s.value){const o=[...s.options].find(o=>o.value);Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,o.value);s.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
  await pause(300);
  await clickText("Open workspace", "button");
  await waitFor("!location.pathname.startsWith('/onboarding')", "the selected workspace");
}

const callRows = async leadId => (await sql(`query C($org: UUID!, $lead: UUID!) { callRecords(where: {organizationId: {eq: $org}, leadId: {eq: $lead}}) { id source callStatus outcome followUpId durationSeconds notes } }`, {org: f.orgA, lead: leadId})).callRecords;
const suppressionRows = async number => (await sql(`query S($org: UUID!, $n: String!) { communicationSuppressions(where: {organizationId: {eq: $org}, normalizedNumber: {eq: $n}, withdrawnAt: {isNull: true}}) { id scope reason source } }`, {org: f.orgA, n: number})).communicationSuppressions;
/** Yesterday at a fixed Dubai time: always in the past, inside calling hours and the 30-day logging window. */
const yesterdayDubai = (time) => {
  const date = new Date(Date.now() + 4 * 3600_000 - 86_400_000).toISOString().slice(0, 10);
  return {input: `${date}T${time}`, iso: new Date(`${date}T${time}:00+04:00`).toISOString()};
};
const tomorrowDubaiInput = () => new Date(Date.now() + 4 * 3600_000 + 86_400_000).toISOString().slice(0, 11) + "10:00";

let failure;
try {
  await serverReady();
  let devtoolsPort;
  for (let attempt = 0; attempt < 150 && !devtoolsPort; attempt++) {
    try { devtoolsPort = Number(readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]) || undefined; } catch { /* starting */ }
    if (!devtoolsPort) await pause(100);
  }
  if (!devtoolsPort) throw new Error("The isolated test browser did not start.");
  const target = await (await fetch(`http://127.0.0.1:${devtoolsPort}/json/new?about:blank`, {method: "PUT"})).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, reject) => { socket.addEventListener("open", done, {once: true}); socket.addEventListener("error", reject, {once: true}); });
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const pending = requests.get(message.id);
      if (!pending) return;
      requests.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error))); else pending.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") exceptions.push(`${currentPath}: ${(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text).split("\n")[0]}`);
  });
  await command("Page.enable"); await command("Runtime.enable"); await command("Network.enable");
  const post = (path, body = {}, organizationId = f.orgA, method = "POST") => api(path, {method, headers: {"X-EstateOS-Organization": organizationId}, body: JSON.stringify(body)});

  // ------------------------------------------------------------ gates
  await load("/api/auth/csrf");
  assert.equal((await api(`/api/communications/leads/${f.leadA}/calls`)).status, 401);
  assert.equal((await api("/api/communications/settings")).status, 401);
  assert.equal((await post("/api/communications/calls", {})).status, 401);
  pass("Unauthenticated call history, settings and logging are rejected");

  // ------------------------------------------------------------ OWNER: a fictional lead with a number, assigned to the agent
  await signIn("owner-a");
  const leadName = "E2E Caller " + randomUUID().slice(0, 6);
  const NUMBER = "+971501230000";
  const created = await post("/api/leads", {fullName: leadName, phone: "050 123 0000", assignedMembershipId: f.memberAgentA});
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const lead = (await sql(`query L($org: UUID!, $name: String!) { leads(where: {organizationId: {eq: $org}, fullName: {eq: $name}}) { id contactId } }`, {org: f.orgA, name: leadName})).leads[0];
  const settingsAsOwner = await api("/api/communications/settings");
  assert.equal(settingsAsOwner.status, 200);
  assert.equal(settingsAsOwner.body.data.rules.telemarketingEnabled, false, "marketing calls are off by default");
  assert.equal(settingsAsOwner.body.data.rules.recordingEnabled, false, "recording is off by default");
  const badSettings = await post("/api/communications/settings", {...settingsAsOwner.body.data.rules, expectedRevision: 0, liveCallingAttestedAt: undefined, liveCallingAttestationVersion: undefined, telemarketingEnabled: true, telemarketingApprovalReference: null}, f.orgA, "PUT");
  assert.equal(badSettings.status, 400);
  assert.match(badSettings.body.error.message, /TDRA telemarketing approval reference/);
  pass("Communication settings default to no marketing and no recording; enabling marketing calls needs the TDRA approval reference");

  // ------------------------------------------------------------ AGENT: the call panel on the lead
  await signIn("agent-a");
  await load(`/leads/${lead.id}`, "document.querySelector('#calls') && document.querySelector('#calls').innerText.includes('+971 50 123 0000')");
  const panel = () => evaluate("document.querySelector('#calls').innerText");
  assert.ok(await evaluate("[...document.querySelectorAll('#calls button')].find(b=>b.textContent.trim()==='Call').disabled"), "live dialling is disabled");
  assert.match(await panel(), /No calling provider is connected/);
  assert.match(await panel(), /No calls recorded yet/);
  assert.match(await panel(), /Calls are not recorded\./);
  await evaluate("document.querySelector('#calls').scrollIntoView({block: 'start'})"); await pause(300);
  await screenshot("lead-call-panel-empty");
  pass("The lead's call panel shows the number on record, explains why live calling is disabled and has no fake history");

  await clickText("Log a call", "#calls button");
  await waitFor("document.querySelector('[role=dialog]')?.innerText.includes('Log a call')", "the log call dialog");
  const started = yesterdayDubai("10:30");
  await setField("startedAt", started.input);
  await setField("minutes", 4);
  await setField("seconds", 20);
  await setField("outcome", "INTERESTED");
  await setField("notes", "Synthetic call: wants a two-bedroom apartment, asked for a viewing next week.");
  await setField("followUpRequired", true);
  await waitFor("!!document.querySelector('[role=dialog] [name=followUpAt]')", "the follow-up fields");
  await setField("followUpAt", tomorrowDubaiInput());
  await setField("followUpTitle", "Send viewing options");
  await screenshot("log-call-dialog");
  await clickText("Save call", "[role=dialog] button");
  await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('#calls').innerText.includes('Logged manually')", "the logged call in the history");
  let rows = await callRows(lead.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, "MANUAL");
  assert.equal(rows[0].callStatus, "COMPLETED");
  assert.equal(rows[0].durationSeconds, 260);
  assert.ok(rows[0].followUpId, "the follow-up was scheduled and linked");
  const text = await panel();
  assert.match(text, /Interested/);
  assert.match(text, /4 min 20 s/);
  assert.match(text, /Follow-up: Send viewing options/);
  assert.match(text, /Last answered call: /);
  await load(`/leads/${lead.id}`, "document.querySelector('#calls')?.innerText.includes('Logged manually')");
  assert.match(await evaluate("document.querySelector('#follow-up-history').innerText"), /Send viewing options/, "the follow-up is a normal lead follow-up");
  assert.match(await evaluate("document.querySelector('#timeline').innerText"), /Lead activity|Call/);
  await evaluate("document.querySelector('#calls').scrollIntoView({block: 'start'})"); await pause(300);
  await screenshot("lead-call-panel");
  pass("An agent logs an answered call from the lead with outcome, notes and a follow-up; it is saved once and still there after a reload");

  // ------------------------------------------------------------ idempotency and compliance warnings (API, as the agent)
  const requestId = randomUUID();
  const missed = {requestId, leadId: lead.id, direction: "OUTBOUND", callType: "MARKETING", callStatus: "NO_ANSWER", startedAt: yesterdayDubai("11:00").iso, durationSeconds: 0};
  const first = await post("/api/communications/calls", missed);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.ok(first.body.data.issues.some(issue => issue.code === "TELEMARKETING_NOT_ENABLED"), JSON.stringify(first.body.data.issues));
  assert.equal(first.body.data.call.answered, false);
  const again = await post("/api/communications/calls", missed);
  assert.equal(again.status, 201);
  assert.equal(again.body.data.duplicate, true);
  assert.equal((await callRows(lead.id)).length, 2, "the repeated submit did not log a second call");
  const outcomeOnMissed = await post("/api/communications/calls", {...missed, requestId: randomUUID(), callType: "FOLLOW_UP", outcome: "INTERESTED"});
  assert.equal(outcomeOnMissed.status, 400);
  assert.match(outcomeOnMissed.body.error.message, /only for a call the customer answered/);
  pass("A repeated submission logs the call once; a marketing call without TDRA approval is saved with a warning; unanswered calls cannot carry an outcome");

  const dnc = await post("/api/communications/calls", {requestId: randomUUID(), leadId: lead.id, direction: "INBOUND", callType: "INBOUND_ENQUIRY", callStatus: "COMPLETED", outcome: "DO_NOT_CALL_REQUESTED", startedAt: yesterdayDubai("15:00").iso, durationSeconds: 45});
  assert.equal(dnc.status, 201, JSON.stringify(dnc.body));
  const suppressions = await suppressionRows(NUMBER);
  assert.equal(suppressions.length, 1);
  assert.equal(suppressions[0].reason, "OPT_OUT");
  await load(`/leads/${lead.id}`, "document.querySelector('#calls')?.innerText.includes('Do not call')");
  // After the opt-out was recorded (an opt-out never flags calls made before it).
  const afterOptOut = await post("/api/communications/calls", {requestId: randomUUID(), leadId: lead.id, direction: "OUTBOUND", callType: "FOLLOW_UP", callStatus: "NO_ANSWER", startedAt: new Date(Date.now() + 60_000).toISOString(), durationSeconds: 0});
  assert.ok(afterOptOut.body.data.issues.some(issue => issue.code === "NUMBER_SUPPRESSED"), "a later call to an opted-out number is flagged");
  pass("A do-not-call outcome adds the number to the do-not-call list, the panel shows it and later calls are flagged");

  // ------------------------------------------------------------ editing
  const callId = rows[0].id;
  const detail = await api(`/api/communications/calls/${callId}`);
  assert.equal(detail.status, 200);
  const edited = await post(`/api/communications/calls/${callId}`, {expectedRevision: detail.body.data.revision, outcome: "VIEWING_REQUESTED", notes: "Updated synthetic notes", followUpRequired: true}, f.orgA, "PUT");
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  assert.equal(edited.body.data.outcome, "VIEWING_REQUESTED");
  const stale = await post(`/api/communications/calls/${callId}`, {expectedRevision: detail.body.data.revision, outcome: "NO_DECISION", notes: null, followUpRequired: false}, f.orgA, "PUT");
  assert.equal(stale.status, 409, "a stale edit is refused");
  pass("The agent edits the outcome and notes of their call; a stale edit is refused");

  // ------------------------------------------------------------ permissions
  assert.equal((await post("/api/communications/settings", {...settingsAsOwner.body.data.rules, expectedRevision: 0}, f.orgA, "PUT")).status, 403, "agents cannot change settings");
  assert.equal((await api("/api/communications/suppressions")).status, 403, "agents cannot list the do-not-call list");
  await signIn("manager-a");
  assert.equal((await api(`/api/communications/leads/${lead.id}/calls`)).status, 403, "a manager without the lead cannot read its calls");
  assert.equal((await api(`/api/communications/calls/${callId}`)).status, 404);
  assert.equal((await post(`/api/communications/calls/${callId}`, {expectedRevision: 2, outcome: null, notes: null, followUpRequired: false}, f.orgA, "PUT")).status, 404);
  await signIn("owner-b");
  assert.equal((await api(`/api/communications/leads/${lead.id}/calls`)).status, 403, "another company cannot read the calls");
  assert.equal((await api(`/api/communications/calls/${callId}`)).status, 404, "a guessed call ID from another company is not found");
  const forged = await post("/api/communications/calls", {requestId: randomUUID(), leadId: lead.id, direction: "OUTBOUND", callType: "FOLLOW_UP", callStatus: "NO_ANSWER", startedAt: new Date(Date.now() - 60_000).toISOString(), durationSeconds: 0});
  assert.equal(forged.status, 409, "a forged company header is refused before anything is written");
  assert.equal((await callRows(lead.id)).length, 4);
  pass("Managers without the lead, other companies and guessed IDs cannot read or change calls; a forged company header writes nothing");

  // ------------------------------------------------------------ OWNER: contact page and do-not-call list
  await signIn("owner-a");
  await load(`/contacts/${lead.contactId}`, "document.querySelector('#calls')?.innerText.includes('Logged manually')");
  assert.match(await evaluate("document.querySelector('#calls').innerText"), new RegExp(`Lead: ${leadName}`));
  const list = await api("/api/communications/suppressions");
  assert.equal(list.status, 200);
  assert.ok(list.body.data.active.some(item => item.normalizedNumber === NUMBER && item.source === "CALL_OUTCOME"));
  const withdrawn = await post(`/api/communications/suppressions/${suppressions[0].id}/withdraw`, {reason: "Customer asked to be contacted again (synthetic)"});
  assert.equal(withdrawn.status, 200, JSON.stringify(withdrawn.body));
  assert.equal((await suppressionRows(NUMBER)).length, 0);
  await load(`/contacts/${lead.contactId}`, "document.querySelector('#calls') && !document.querySelector('#calls').innerText.includes('Do not call')");
  await load(`/leads/${lead.id}`, "document.querySelector('#calls')?.innerText.includes('Logged manually')", {width: 390, height: 844, mobile: true});
  await evaluate("document.querySelector('#calls').scrollIntoView({block: 'start'})"); await pause(300);
  await screenshot("lead-call-panel-mobile");
  pass("The contact page shows calls from its leads; an owner withdraws the opt-out with a reason and the badge disappears; the panel works on a phone");

  // ------------------------------------------------------------ 6F.2: provider connection, line, signed webhooks, live-call gate, hub
  const ACCOUNT = "AC" + "e".repeat(32);
  await load("/communications/settings", "document.body.innerText.includes('Calling providers') && document.body.innerText.includes('No provider is connected')");
  await clickText("Add connection", "button");
  await waitFor("document.querySelector('[role=dialog]')?.innerText.includes('Add a provider connection')", "the connection dialog");
  await setField("providerType", "TWILIO");
  await setField("displayName", "E2E Twilio");
  await setField("externalAccountId", ACCOUNT);
  await setField("secretRef", "COMMS_E2E_TWILIO_TOKEN");
  await clickText("Add connection", "[role=dialog] button");
  await waitFor("!document.querySelector('[role=dialog]') && document.body.innerText.includes('E2E Twilio') && document.body.innerText.includes('Secret set on server')", "the saved connection");
  assert.match(await evaluate("document.body.innerText"), /Not verified/);
  assert.doesNotMatch(await evaluate("document.body.innerText"), new RegExp(providerToken), "the credential never reaches the page");
  const providerView = (await api("/api/communications/providers")).body.data;
  assert.ok(!JSON.stringify(providerView).includes(providerToken), "the credential is never returned by the API");
  const connection = providerView.connections.find(row => row.displayName === "E2E Twilio");
  assert.equal(connection.webhookUrl, `${origin}/api/communications/webhooks/twilio/${connection.id}`);
  await screenshot("communication-settings");
  const missing = await post("/api/communications/providers", {providerType: "TWILIO", displayName: "Not set yet", externalAccountId: ACCOUNT, secretRef: "COMMS_E2E_NOT_SET"});
  assert.equal(missing.status, 201);
  const check = await post(`/api/communications/providers/${missing.body.data.id}/verify`, {expectedRevision: 1});
  assert.equal(check.status, 400);
  assert.match(check.body.error.message, /COMMS_E2E_NOT_SET is not set/);
  const pasted = await post("/api/communications/providers", {providerType: "TWILIO", displayName: "Pasted secret", externalAccountId: ACCOUNT, secretRef: providerToken});
  assert.equal(pasted.status, 400, "a pasted credential is refused as a secret name");
  pass("An owner adds a provider connection with a secret name only; the credential never reaches the browser; checking a connection without its server secret is refused without contacting the provider");

  const LINE = "+97143330000";
  const line = await post("/api/communications/lines", {providerConnectionId: connection.id, phoneNumber: "+971 4 333 0000", displayName: "Sales", linePurpose: "SALES", assignedMembershipId: f.memberAgentA, forwardToNumber: "+971 50 999 0000"});
  assert.equal(line.status, 201, JSON.stringify(line.body));
  const lineRevision = async () => (await api("/api/communications/providers")).body.data.lines.find(row => row.id === line.body.data.id || hexEq(row.id, line.body.data.id)).revision;
  const hexEq = (a, b) => String(a).replaceAll("-", "").toLowerCase() === String(b).replaceAll("-", "").toLowerCase();
  assert.equal((await post(`/api/communications/lines/${line.body.data.id}/active`, {expectedRevision: await lineRevision(), active: true})).status, 400, "an unconfirmed line cannot be activated");
  assert.equal((await post(`/api/communications/lines/${line.body.data.id}/registration`, {expectedRevision: await lineRevision()})).status, 200);
  assert.equal((await post(`/api/communications/lines/${line.body.data.id}/active`, {expectedRevision: await lineRevision(), active: true})).status, 200);
  pass("A company line is activated only after an owner confirms it is registered to the company");

  // Signed provider callbacks, exactly as Twilio sends them (form-encoded, X-Twilio-Signature).
  const hook = `${origin}/api/communications/webhooks/twilio/${connection.id}`;
  const deliver = async (params, {token = providerToken, url = hook, signature} = {}) => {
    const body = new URLSearchParams(params).toString();
    const response = await fetch(url, {method: "POST", body, headers: {"Content-Type": "application/x-www-form-urlencoded", "X-Twilio-Signature": signature ?? twilio.getExpectedTwilioSignature(token, url, params)}});
    return {status: response.status, text: await response.text()};
  };
  const CALL = "CA" + "1".repeat(32);
  const event = (CallStatus, extra = {}) => ({CallSid: CALL, AccountSid: ACCOUNT, From: NUMBER, To: LINE, Direction: "inbound", CallStatus, Timestamp: new Date().toUTCString(), ...extra});
  const ringing = await deliver(event("ringing"));
  assert.equal(ringing.status, 200, ringing.text);
  assert.match(ringing.text, /<Response\/>/);
  assert.equal((await deliver(event("ringing"))).status, 200, "a retried delivery is accepted");
  assert.equal((await deliver(event("completed", {CallDuration: "75"}))).status, 200);
  assert.equal((await deliver(event("in-progress"))).status, 200, "a late event is accepted but changes nothing");
  const providerCalls = (await sql(`query P($org: UUID!) { callRecords(where: {organizationId: {eq: $org}, source: {eq: PROVIDER}}) { id leadId contactId callStatus durationSeconds answeredAt direction agentMembershipId } }`, {org: f.orgA})).callRecords;
  assert.equal(providerCalls.length, 1);
  const inboundCall = providerCalls[0];
  assert.equal(inboundCall.callStatus, "COMPLETED");
  assert.equal(inboundCall.durationSeconds, 75);
  assert.ok(inboundCall.answeredAt);
  assert.ok(hexEq(inboundCall.leadId, lead.id), "the caller was matched to the lead on record");
  const events = (await sql(`query E($org: UUID!, $call: UUID!) { callProviderEvents(where: {organizationId: {eq: $org}, callId: {eq: $call}}, orderBy: [{receivedAt: ASC}]) { eventKey result } }`, {org: f.orgA, call: inboundCall.id})).callProviderEvents;
  assert.deepEqual(events.map(row => row.result), ["APPLIED", "APPLIED", "FINAL"], "the duplicate was dropped before recording; the late event was ignored");
  pass("Signed provider events create the incoming call on the lead, apply once each, and ignore retries and late events");

  assert.equal((await deliver(event("completed"), {signature: "forged-signature"})).status, 401);
  assert.equal((await deliver(event("busy", {CallSid: "CA" + "2".repeat(32)}), {token: "wrong-token-0000000000"})).status, 401);
  const unsigned = await fetch(hook, {method: "POST", body: new URLSearchParams(event("busy")).toString(), headers: {"Content-Type": "application/x-www-form-urlencoded"}});
  assert.equal(unsigned.status, 401);
  assert.equal((await deliver(event("busy", {CallSid: "CA" + "3".repeat(32), AccountSid: "AC" + "f".repeat(32)}))).status, 403, "another provider account");
  const elsewhere = `${origin}/api/communications/webhooks/twilio/${randomUUID()}`;
  assert.equal((await deliver(event("busy"), {url: elsewhere})).status, 404, "an unknown connection");
  assert.equal((await deliver(event("busy"), {url: `${origin}/api/communications/webhooks/pbx/${connection.id}`})).status, 404, "no webhooks for providers without a verified contract");
  assert.equal((await sql(`query C($org: UUID!) { callRecords(where: {organizationId: {eq: $org}, source: {eq: PROVIDER}}) { id } }`, {org: f.orgA})).callRecords.length, 1, "refused requests changed nothing");
  const MISSED = "CA" + "4".repeat(32);
  await deliver({...event("ringing"), CallSid: MISSED});
  await deliver({...event("no-answer"), CallSid: MISSED});
  pass("Forged, unsigned, wrong-key, wrong-account and unknown-connection webhooks are refused and change nothing");

  // Live calling is refused with every reason while the provider is unverified and nothing is confirmed.
  await signIn("agent-a");
  const dial = await post("/api/communications/calls/dial", {requestId: randomUUID(), leadId: lead.id, callType: "FOLLOW_UP"});
  assert.equal(dial.status, 200, JSON.stringify(dial.body));
  assert.equal(dial.body.data.started, false);
  const codes = dial.body.data.reasons.map(reason => reason.code);
  for (const code of ["NO_VERIFIED_PROVIDER", "NOT_ATTESTED", "PUBLIC_ORIGIN_MISSING"]) assert.ok(codes.includes(code), `${code} in ${codes}`);
  await load(`/leads/${lead.id}`, "document.querySelector('#calls')?.innerText.includes('Incoming · Answered')");
  assert.ok(await evaluate("[...document.querySelectorAll('#calls button')].find(b=>b.textContent.trim()==='Call').disabled"));
  assert.match(await evaluate("document.querySelector('#calls').innerText"), /No calling provider is connected and verified/);
  assert.equal((await api("/api/communications/providers")).status, 403, "agents cannot see provider connections");
  await load("/communications/settings", "document.body.innerText.includes('Only owners and administrators can change them')");
  assert.ok(await evaluate("[...document.querySelectorAll('input[name=timeZone]')].every(input => input.disabled)"));
  pass("Live calling is refused with its reasons; the agent sees the provider call on the lead and the rules read-only");

  // The hub, from stored records only.
  await signIn("owner-a");
  await load("/communications", "document.body.innerText.includes('Outgoing attempts') && document.body.innerText.includes('Missed calls')");
  const dashboard = (await api("/api/communications/dashboard")).body.data;
  assert.equal(dashboard.totals.missed, 1);
  assert.equal(dashboard.totals.incomingAnswered, 2, "the provider call and the logged incoming call");
  assert.ok(dashboard.byAgent.length >= 1);
  await screenshot("communications-dashboard");
  await load("/communications/calls", "document.body.innerText.includes('calls')");
  await evaluate(`(()=>{const s=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='INBOUND'));Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'INBOUND');s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await waitFor("document.body.innerText.includes('3 calls') && ![...document.querySelectorAll('ol[aria-label=Calls] h3')].some(h=>h.textContent.startsWith('Outgoing'))", "the incoming calls only");
  await screenshot("communications-calls");
  await load(`/communications/calls/${inboundCall.id}`, "document.body.innerText.includes('Provider events')");
  const detailText = await evaluate("document.body.innerText");
  assert.match(detailText, /Reported by E2E Twilio/);
  assert.match(detailText, /Ignored: the call had already ended/);
  assert.match(detailText, /\+971 4 333 0000|\+97143330000/);
  await screenshot("communications-call-detail");
  pass("The dashboard counts missed and answered calls from stored records; the list filters by direction; the call page shows the provider's events");

  // ------------------------------------------------------------ 6F.3: consent, recordings and transcripts
  await load("/communications/settings", "!!document.querySelector('input[name=recordingEnabled]')");
  await evaluate(`(()=>{const set=(name,value)=>{const e=document.querySelector('[name='+name+']');if(e.type==='checkbox'){if(e.checked!==value)e.click();return;}
    const proto=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));};
    set('recordingEnabled',true);set('recordingNoticeText','This call may be recorded and transcribed for quality and record keeping (synthetic).');set('recordingLegalBasis','Customer consent (synthetic test)');})()`);
  await clickText("Save calling rules", "button");
  await waitFor("document.body.innerText.includes('Last saved') && document.querySelector('input[name=recordingEnabled]')?.checked", "the saved rules");
  assert.equal((await api("/api/communications/settings")).body.data.rules.recordingEnabled, true);
  pass("An owner enables recordings with the notice read to callers and the legal basis");

  const recordedCall = rows[0].id;
  await signIn("agent-a");
  await load(`/communications/calls/${recordedCall}`, "document.body.innerText.includes('Notice and consent')");
  assert.match(await evaluate("document.body.innerText"), /No notice or consent recorded for this call/);
  assert.ok(!await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Add recording'))"), "no upload before consent");
  await clickText("Record notice or consent", "button");
  await waitFor("document.querySelector('[role=dialog]')?.innerText.includes('Record notice or consent')", "the consent dialog");
  await setField("status", "GIVEN");
  await clickText("Save", "[role=dialog] button");
  await waitFor("document.body.innerText.includes('Agreed to recording') && [...document.querySelectorAll('button')].some(b=>b.textContent.includes('Add recording'))", "the saved consent");
  const consentId = (await api(`/api/communications/calls/${recordedCall}/media`)).body.data.consents[0].id;

  // Synthetic recordings, built in the page and sent the way the panel sends files.
  const uploadAudio = (kind, seconds, consent = consentId, callId = recordedCall) => evaluate(`(async()=>{
    let bytes;
    if (${JSON.stringify(kind)} === 'png') bytes = new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,...new Array(200).fill(0)]);
    else { const rate=8000, size=${seconds}*rate*2; bytes=new Uint8Array(44+size); const v=new DataView(bytes.buffer); const t=(a,s)=>[...s].forEach((c,i)=>v.setUint8(a+i,c.charCodeAt(0)));
      t(0,'RIFF');v.setUint32(4,36+size,true);t(8,'WAVE');t(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);t(36,'data');v.setUint32(40,size,true); }
    const c=await (await fetch('/api/auth/csrf')).json();
    const r=await fetch('/api/communications/calls/${callId}/recordings',{method:'POST',body:bytes,headers:{'X-CSRF-Token':c.csrfToken,'X-EstateOS-Organization':'${f.orgA}','X-Consent-Evidence':'${consent}','Content-Type':'audio/wav'}});
    return {status:r.status,body:await r.json().catch(()=>null)};})()`, 120000);
  assert.equal((await uploadAudio("png", 0)).status, 415, "a file that is not audio is refused by its contents");
  const tooLong = await uploadAudio("wav", 400);
  assert.equal(tooLong.status, 400, "a recording much longer than the call is refused");
  const uploaded = await uploadAudio("wav", 120);
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
  assert.equal(uploaded.body.data.durationSeconds, 120);
  const recordingId = uploaded.body.data.id;
  const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n<v Agent>Good morning, this is a synthetic call.\n\n00:00:05.000 --> 00:00:09.000\n<v Customer>I would like a two-bedroom apartment near the marina.\n";
  const transcript = await post(`/api/communications/calls/${recordedCall}/transcripts`, {consentEvidenceId: consentId, sourceName: "Synthetic transcription service", content: vtt});
  assert.equal(transcript.status, 201, JSON.stringify(transcript.body));
  assert.equal(transcript.body.data.language, "en");
  await load(`/communications/calls/${recordedCall}`, "!!document.querySelector('audio') && document.body.innerText.includes('English (detected)')");
  const audio = await evaluate(`(async()=>{const r=await fetch(document.querySelector('audio').src);const b=await r.arrayBuffer();return {status:r.status,type:r.headers.get('content-type'),cache:r.headers.get('cache-control'),bytes:b.byteLength};})()`);
  assert.deepEqual(audio, {status: 200, type: "audio/wav", cache: "private, no-store", bytes: 44 + 120 * 8000 * 2});
  await clickText("Read", "button");
  await waitFor("document.querySelector('[aria-label=Transcript]')?.innerText.includes('two-bedroom apartment near the marina')", "the transcript");
  assert.match(await evaluate("document.querySelector('[aria-label=Transcript]').innerText"), /0:05\s*Customer:/);
  await screenshot("call-recording-transcript");
  const accessAudit = (await sql(`query A($org: UUID!, $id: UUID!) { auditLogs(where: {organizationId: {eq: $org}, targetId: {eq: $id}, action: {eq: CALL_MEDIA_ACCESSED}}) { actorUid } }`, {org: f.orgA, id: recordingId})).auditLogs;
  assert.ok(accessAudit.some(row => row.actorUid === "agent-a"), "listening to the recording is audited");
  pass("With consent recorded, the agent adds a recording (checked by content and length) and a transcript; both are served privately, and access is audited");

  await signIn("manager-a");
  assert.equal((await api(`/api/communications/recordings/${recordingId}/content`)).status, 404);
  assert.equal((await api(`/api/communications/calls/${recordedCall}/media`)).status, 404);
  await signIn("owner-b");
  assert.equal((await api(`/api/communications/recordings/${recordingId}/content`)).status, 404, "another company cannot fetch the recording by its ID");
  assert.equal((await api(`/api/communications/transcripts/${transcript.body.data.id}/content`)).status, 404);
  pass("Managers without the lead and other companies cannot open recordings or transcripts, even with their IDs");

  // Withdrawal deletes the recording, the transcript and their files.
  await signIn("agent-a");
  const stored = (await sql(`query R($org: UUID!, $id: UUID!) { callRecording(key: {organizationId: $org, id: $id}) { storagePath } }`, {org: f.orgA, id: recordingId})).callRecording.storagePath;
  const bucket = getStorage(authApp).bucket(BUCKET);
  assert.equal((await bucket.file(stored).exists())[0], true);
  const consentWithdrawal = await post(`/api/communications/consents/${consentId}/withdraw`, {note: "Customer asked to delete the recording (synthetic)"});
  assert.equal(consentWithdrawal.status, 200, JSON.stringify(consentWithdrawal.body));
  assert.equal((await api(`/api/communications/recordings/${recordingId}/content`)).status, 404);
  assert.equal((await bucket.file(stored).exists())[0], false, "the file is removed from storage");
  const afterWithdrawal = (await api(`/api/communications/calls/${recordedCall}/media`)).body.data;
  assert.equal(afterWithdrawal.recordings.length + afterWithdrawal.transcripts.length, 0);
  assert.equal(afterWithdrawal.canUpload, false, "no new uploads without current consent");
  pass("Withdrawing consent deletes the call's recording and transcript and removes the files");

  // Retention: the worker tick removes media past its retention date.
  await post(`/api/communications/calls/${recordedCall}/consents`, {status: "NOTICE_GIVEN", method: "ANNOUNCEMENT", note: null});
  const nextConsent = (await api(`/api/communications/calls/${recordedCall}/media`)).body.data.consents.find(item => item.status === "NOTICE_GIVEN").id;
  const short = await uploadAudio("wav", 5, nextConsent);
  assert.equal(short.status, 201);
  const shortPath = (await sql(`query R($org: UUID!, $id: UUID!) { callRecording(key: {organizationId: $org, id: $id}) { storagePath } }`, {org: f.orgA, id: short.body.data.id})).callRecording.storagePath;
  await dc.executeGraphql(`mutation Past($org: UUID!, $id: UUID!) { callRecording_update(key: {organizationId: $org, id: $id}, data: {retentionUntil_expr: "request.time - duration('60s')"}) }`, {variables: {org: f.orgA, id: short.body.data.id}});
  const tick = await fetch(origin + "/api/internal/automations/tick", {method: "POST", headers: {Authorization: `Bearer ${workerSecret}`}, signal: AbortSignal.timeout(120000)});
  const tickBody = await tick.json();
  assert.equal(tick.status, 200, JSON.stringify(tickBody));
  assert.ok(tickBody.data.communications.expired >= 1 && tickBody.data.communications.filesRemoved >= 1, JSON.stringify(tickBody.data.communications));
  assert.equal((await api(`/api/communications/recordings/${short.body.data.id}/content`)).status, 404);
  assert.equal((await bucket.file(shortPath).exists())[0], false);
  pass("The worker removes recordings past the company's retention period, with their files");

  assert.deepEqual(exceptions.filter(message => !/ResizeObserver/.test(message)), [], "no uncaught browser exceptions");
  console.log(`\n${checks} communication end-to-end checks passed.`);
} catch (error) {
  failure = error;
} finally {
  try { socket?.close(); } catch { /* closed */ }
  stop(browser); stop(server);
  await deleteApp(authApp).catch(() => {}); await deleteApp(sqlApp).catch(() => {});
}
if (failure) { console.error(failure); console.error(`--- Next.js server log (tail) ---
${serverLog.slice(-6000)}`); process.exit(1); }
process.exit(0);
