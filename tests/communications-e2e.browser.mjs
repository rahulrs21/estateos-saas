import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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
