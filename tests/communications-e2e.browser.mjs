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
/** AI_E2E_LIVE=1 (set by scripts/test-ai-e2e.mjs with the key from .env.local) runs only the live-Claude checks. */
const live = process.env.AI_E2E_LIVE === "1" && Boolean(process.env.AI_E2E_ANTHROPIC_API_KEY);
const LIVE_DONE = Symbol("live checks finished");
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
      // Well-formed but invalid unless live: Anthropic itself rejects any call.
      ANTHROPIC_API_KEY: live ? process.env.AI_E2E_ANTHROPIC_API_KEY : `sk-ant-api03-e2e-invalid-${"x".repeat(40)}`, ANTHROPIC_MODEL: live ? process.env.AI_E2E_ANTHROPIC_MODEL || "claude-sonnet-5-5" : "claude-sonnet-5-5", AI_E2E_ANTHROPIC_API_KEY: "",
      COMMS_E2E_TWILIO_TOKEN: providerToken, AUTOMATION_WORKER_SECRET: workerSecret, FIREBASE_STORAGE_BUCKET: BUCKET,
      // The developer simulator (local emulators and a demo project only).
      ESTATEOS_DEV_TOOLS: "1",
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

  if (live) {
    // ---------------------------------------------------------- LIVE Claude: summaries of a synthetic, consented transcript
    await signIn("owner-a");
    const rules = (await api("/api/communications/settings")).body.data;
    const enabled = await post("/api/communications/settings", {...rules.rules, expectedRevision: rules.revision, liveCallingAttestedAt: undefined, liveCallingAttestationVersion: undefined,
      recordingEnabled: true, recordingNoticeText: "This call may be recorded and transcribed for quality and record keeping (synthetic).", recordingLegalBasis: "Customer consent (synthetic test)", aiAnalysisEnabled: true}, f.orgA, "PUT");
    assert.equal(enabled.status, 200, JSON.stringify(enabled.body));
    const liveLead = await post("/api/leads", {fullName: "Live Claude Test " + randomUUID().slice(0, 6), phone: "050 123 0999", assignedMembershipId: f.memberAgentA});
    assert.equal(liveLead.status, 201, JSON.stringify(liveLead.body));
    const liveLeadId = liveLead.body.data.lead.id;
    await signIn("agent-a");
    const liveCall = await post("/api/communications/calls", {requestId: randomUUID(), leadId: liveLeadId, direction: "OUTBOUND", callType: "FOLLOW_UP", callStatus: "COMPLETED", outcome: "INTERESTED",
      startedAt: new Date(Date.now() - 600_000).toISOString(), durationSeconds: 240, notes: "Customer interested in Marina two-bedroom units; wants floor plans. Budget not discussed."});
    assert.equal(liveCall.status, 201, JSON.stringify(liveCall.body));
    const liveCallId = liveCall.body.data.call.id;
    assert.equal((await post(`/api/communications/calls/${liveCallId}/consents`, {status: "GIVEN", method: "VERBAL_ON_CALL", note: "Synthetic consent"})).status, 201);
    const consent = (await api(`/api/communications/calls/${liveCallId}/media`)).body.data.consents[0].id;
    // Fictional conversation. The budget is deliberately NOT stated, so a correct summary must not give one.
    const liveVtt = ["WEBVTT", "",
      "00:00:01.000 --> 00:00:06.000", "<v Agent>Good afternoon, thank you for your enquiry about the Marina apartments.", "",
      "00:00:07.000 --> 00:00:14.000", "<v Customer>Yes, I am looking for a two-bedroom apartment in Dubai Marina for my family.", "",
      "00:00:15.000 --> 00:00:21.000", "<v Customer>I have not decided on a budget yet, I need to speak to my bank first.", "",
      "00:00:22.000 --> 00:00:28.000", "<v Customer>A balcony with a sea view would be nice, and we want to move in by June.", "",
      "00:00:29.000 --> 00:00:35.000", "<v Agent>I will email you the floor plans today and we can arrange a viewing on Saturday morning.", "",
      "00:00:36.000 --> 00:00:40.000", "<v Customer>Saturday works. Please also send the payment plan.", ""].join("\n");
    const liveTranscript = await post(`/api/communications/calls/${liveCallId}/transcripts`, {consentEvidenceId: consent, sourceName: "Synthetic transcript (live Claude test)", content: liveVtt});
    assert.equal(liveTranscript.status, 201, JSON.stringify(liveTranscript.body));
    const generated = await post(`/api/communications/calls/${liveCallId}/summaries`, {source: "TRANSCRIPT"});
    assert.equal(generated.status, 201, JSON.stringify(generated.body));
    const stored = (await api(`/api/communications/calls/${liveCallId}/summaries`)).body.data.summaries[0];
    const summary = stored.summary;
    const items = [summary.reasonForCall, summary.budget, ...summary.requirements, ...summary.locations, ...summary.preferences, ...summary.questions, ...summary.agreements, ...summary.nextSteps].filter(Boolean);
    const text = JSON.stringify(summary).toLowerCase();
    console.log("LIVE SUMMARY " + JSON.stringify({overallConfidence: summary.overallConfidence, unverified: stored.unverifiedCount, budget: summary.budget, requirements: summary.requirements.map(item => item.text),
      locations: summary.locations.map(item => item.text), agreements: summary.agreements.map(item => item.text), nextSteps: summary.nextSteps.map(item => item.text), suggestions: stored.suggestions.map(item => item.kind)}));
    assert.equal(summary.budget, null, "no budget is invented when none was stated");
    assert.match(text, /two-bedroom|2-bedroom|two bedroom|2 bedroom/, "the stated requirement is captured");
    assert.match(text, /marina/);
    assert.ok(items.length >= 3, "the summary has substance");
    const verified = items.filter(item => item.verified).length;
    assert.ok(verified / items.length >= 0.8, `most points quote the transcript (${verified}/${items.length})`);
    assert.ok(stored.suggestions.length >= 1 && stored.suggestions.every(item => item.status === "PENDING"), "suggestions wait for a person");
    const liveUsage = (await sql(`query U($org: UUID!) { aiUsageRecords(where: {organizationId: {eq: $org}, contentType: {eq: "CALL_SUMMARY"}, status: {eq: SUCCEEDED}}) { inputTokens outputTokens estimatedCostUsd model } }`, {org: f.orgA})).aiUsageRecords;
    assert.ok(liveUsage.length === 1 && liveUsage[0].inputTokens > 0 && liveUsage[0].outputTokens > 0, JSON.stringify(liveUsage));
    console.log("LIVE USAGE " + JSON.stringify(liveUsage[0]));
    pass("live Claude: a summary of a synthetic consented transcript quotes it, captures the stated needs, invents no budget and leaves suggestions for a person");

    const notesSummary = await post(`/api/communications/calls/${liveCallId}/summaries`, {source: "NOTES"});
    assert.equal(notesSummary.status, 201, JSON.stringify(notesSummary.body));
    const fromNotes = (await api(`/api/communications/calls/${liveCallId}/summaries`)).body.data.summaries.find(row => row.sourceKind === "NOTES").summary;
    console.log("LIVE NOTES SUMMARY " + JSON.stringify({budget: fromNotes.budget, requirements: fromNotes.requirements.map(item => item.text), limitations: fromNotes.limitations}));
    assert.equal(fromNotes.budget, null, "the notes say the budget was not discussed");
    pass("live Claude: a summary of the agent's short notes stays within them and reports no budget");

    // One live voice-assistant turn (test mode; no approved facts, so it may only qualify the caller or hand over).
    await signIn("owner-a");
    const voiceSaved = await post("/api/communications/voice-assistant", {expectedRevision: 0, status: "TEST_ONLY", assistantName: "Live Test Assistant",
      disclosureText: "Hello, you are speaking with an AI virtual assistant for our agency.", greeting: "How can I help you today?", questions: ["Are you looking to buy or rent?"],
      handoffMessage: "A colleague will call you back shortly.", projectIds: [], listingIds: [], maxTurns: 4, maxSessionMinutes: 5, maxReplyTokens: 2000}, f.orgA, "PUT");
    assert.equal(voiceSaved.status, 200, JSON.stringify(voiceSaved.body));
    const session = await post("/api/communications/voice-assistant/sessions");
    assert.equal(session.status, 201, JSON.stringify(session.body));
    const sessionPath = `/api/communications/voice-assistant/sessions/${session.body.data.id}`;
    const opened = (await api(sessionPath)).body.data;
    const turn = await post(`${sessionPath}/turns`, {utterance: "Hi, I would like to buy a two-bedroom apartment. What prices do you have?", turnId: randomUUID(), expectedRevision: opened.revision});
    assert.equal(turn.status, 200, JSON.stringify(turn.body));
    const afterTurn = (await api(sessionPath)).body.data;
    const reply = afterTurn.turns.at(-1);
    console.log("LIVE VOICE " + JSON.stringify({kind: reply.kind, text: reply.text, checks: reply.checks ?? [], status: afterTurn.status, error: turn.body.data.error ?? null}));
    assert.equal(afterTurn.turns[0].kind, "DISCLOSURE");
    assert.notEqual(reply.kind, "FALLBACK", "Claude answered (the request was accepted)");
    assert.ok(!/AED\s*[\d,.]+|\d[\d,.]*\s*(million|k\b)/i.test(reply.text), "no price is stated without approved facts");
    pass("live Claude: the voice assistant answers a test caller after the AI disclosure without inventing prices");
    throw LIVE_DONE;
  }

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

  // Concurrent callbacks: the same and conflicting deliveries at once still give one call, one final status and one workflow event.
  const RACE = "CA" + "9".repeat(32);
  const race = (CallStatus, extra = {}) => event(CallStatus, {CallSid: RACE, ...extra});
  const burst = await Promise.all([...Array.from({length: 4}, () => deliver(race("ringing"))), ...Array.from({length: 3}, () => deliver(race("completed", {CallDuration: "42"}))), deliver(race("no-answer"))]);
  // A delivery that lost a race may be asked to retry (5xx), as providers do; none is accepted twice.
  assert.ok(burst.every(result => result.status === 200 || result.status >= 500), JSON.stringify(burst.map(result => result.status)));
  await deliver(race("completed", {CallDuration: "42"})); // the provider's retry
  const raced = (await sql(`query P($org: UUID!, $sid: String!) { callRecords(where: {organizationId: {eq: $org}, providerCallId: {eq: $sid}}) { id callStatus } }`, {org: f.orgA, sid: RACE})).callRecords;
  assert.equal(raced.length, 1, "one call however many deliveries arrive at once");
  assert.ok(["COMPLETED", "NO_ANSWER"].includes(raced[0].callStatus), raced[0].callStatus);
  const raceEvents = (await sql(`query E($org: UUID!, $id: UUID!) { automationEvents(where: {organizationId: {eq: $org}, targetId: {eq: $id}}) { triggerType } }`, {org: f.orgA, id: raced[0].id})).automationEvents.map(row => row.triggerType).sort();
  assert.deepEqual(raceEvents.filter(type => type !== "call.started"), [raced[0].callStatus === "COMPLETED" ? "call.completed" : "call.missed"], "exactly one final workflow event");
  assert.equal(raceEvents.filter(type => type === "call.started").length, 1);
  pass("Concurrent duplicate and conflicting callbacks give one call, one final status and one workflow event");
  // Test cleanup, so the later checks see only the calls they expect.
  await dc.executeGraphql(`mutation D($org: UUID!, $id: UUID!, $sid: String!) { callProviderEvent_deleteMany(where: {organizationId: {eq: $org}, providerCallId: {eq: $sid}}) callRecord_delete(key: {organizationId: $org, id: $id}) }`,
    {variables: {org: f.orgA, id: raced[0].id, sid: RACE}});

  assert.equal((await deliver(event("completed"), {signature: "forged-signature"})).status, 401);
  assert.equal((await deliver(event("busy", {CallSid: "CA" + "2".repeat(32)}), {token: "wrong-token-0000000000"})).status, 401);
  const unsigned = await fetch(hook, {method: "POST", body: new URLSearchParams(event("busy")).toString(), headers: {"Content-Type": "application/x-www-form-urlencoded"}});
  assert.equal(unsigned.status, 401);
  assert.equal((await deliver(event("busy", {CallSid: "CA" + "3".repeat(32), AccountSid: "AC" + "f".repeat(32)}))).status, 403, "another provider account");
  const elsewhere = `${origin}/api/communications/webhooks/twilio/${randomUUID()}`;
  assert.equal((await deliver(event("busy"), {url: elsewhere})).status, 404, "an unknown connection");
  assert.equal((await deliver(event("busy"), {url: `${origin}/api/communications/webhooks/pbx/${connection.id}`})).status, 404, "no webhooks for providers without a verified contract");
  assert.equal((await sql(`query C($org: UUID!) { callRecords(where: {organizationId: {eq: $org}, source: {eq: PROVIDER}, providerCallId: {ne: "${RACE}"}}) { id } }`, {org: f.orgA})).callRecords.length, 1, "refused requests changed nothing");
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
  await waitFor("fetch('/api/communications/settings').then(r=>r.json()).then(b=>b.data.rules.recordingEnabled === true)", "the saved rules");
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

  // ------------------------------------------------------------ 6F.4: Claude call summaries
  const summaries = async () => (await api(`/api/communications/calls/${recordedCall}/summaries`)).body.data;
  const offRequest = await post(`/api/communications/calls/${recordedCall}/summaries`, {source: "NOTES"});
  assert.equal(offRequest.status, 409, "summaries are off until the company enables them");
  await signIn("owner-a");
  await load("/communications/settings", "!!document.querySelector('input[name=aiAnalysisEnabled]')");
  await evaluate("(()=>{const e=document.querySelector('input[name=aiAnalysisEnabled]');if(!e.checked)e.click();})()");
  await clickText("Save calling rules", "button");
  await waitFor("fetch('/api/communications/settings').then(r=>r.json()).then(b=>b.data.rules.aiAnalysisEnabled === true)", "Claude summaries enabled");
  await signIn("agent-a");
  await load(`/communications/calls/${recordedCall}`, "[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Summarise my notes'))");
  await clickText("Summarise my notes", "button");
  await waitFor("!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Summarise my notes') && !b.disabled)", "the failed summary request to finish");
  assert.equal((await summaries()).summaries.length, 0, "a failed Claude request stores nothing");
  const usage = (await sql(`query U($org: UUID!) { aiUsageRecords(where: {organizationId: {eq: $org}, feature: {eq: "CALL_AI"}}) { status errorCode userUid } }`, {org: f.orgA})).aiUsageRecords;
  assert.ok(usage.some(row => row.status === "FAILED" && row.userUid === "agent-a"), "the attempt is recorded against the company's AI usage");
  pass("Claude summaries need the company switch; with Anthropic refusing the key the request fails safely, stores nothing and records the usage");

  // A stored summary (as the server writes it after checking evidence) and the agent's review of it.
  const summaryId = randomUUID();
  const point = (text, basis, verified, quote) => ({text, basis, confidence: verified ? "HIGH" : "LOW", verified, downgraded: !verified && basis === "INFERRED", evidence: [{ref: "N1", quote, verified, at: null}]});
  const checked = {reasonForCall: point("Enquiry about a two-bedroom apartment", "STATED", true, "Updated synthetic notes"), requirements: [], locations: [], budget: null, preferences: [point("Prefers a sea view", "INFERRED", false, "sea view")],
    questions: [], agreements: [], nextSteps: [], suggestions: [], overallConfidence: "MEDIUM", limitations: "Synthetic summary for testing.", unverifiedCount: 1};
  await dc.executeGraphql(`mutation S($org: UUID!, $id: UUID!, $call: UUID!, $json: String!, $s1: UUID!, $s2: UUID!) {
    callAiSummary_insert(data: {organizationId: $org, id: $id, callId: $call, sourceKind: "NOTES", summaryJson: $json, overallConfidence: "MEDIUM", unverifiedCount: 1, model: "synthetic", promptVersion: "call-summary-1", createdByUid: "agent-a"})
    a: callAiSuggestion_insert(data: {organizationId: $org, id: $s1, summaryId: $id, callId: $call, kind: "FOLLOW_UP", title: "Send the floor plans", detail: "The customer asked for floor plans.", basis: "STATED", confidence: "HIGH", verified: true})
    b: callAiSuggestion_insert(data: {organizationId: $org, id: $s2, summaryId: $id, callId: $call, kind: "PROPOSAL_DRAFT", title: "Prepare a proposal", detail: "Proposal for the shortlisted unit.", basis: "INFERRED", confidence: "MEDIUM", verified: true})
  }`, {variables: {org: f.orgA, id: summaryId, call: recordedCall, json: JSON.stringify(checked), s1: randomUUID(), s2: randomUUID()}});
  await load(`/communications/calls/${recordedCall}`, "!!document.querySelector('[aria-label=\"Call summary\"]')");
  const summaryText = await evaluate("document.querySelector('[aria-label=\"Call summary\"]').innerText");
  assert.match(summaryText, /Draft, not reviewed/);
  assert.match(summaryText, /1 unsupported point/);
  assert.match(summaryText, /Not found in the source/);
  assert.match(summaryText, /Said on the call/);
  assert.match(summaryText, /Claude's inference/);
  await evaluate("document.querySelector('[aria-label=\"Call summary\"]').scrollIntoView({block: 'start'})"); await pause(300);
  await screenshot("call-summary");
  const followUpsBefore = (await sql(`query F($org: UUID!, $lead: UUID!) { leadFollowUps(where: {organizationId: {eq: $org}, leadId: {eq: $lead}}) { id title } }`, {org: f.orgA, lead: lead.id})).leadFollowUps.length;
  await clickText("Schedule follow-up", "button");
  await waitFor("document.querySelector('[role=dialog]')?.innerText.includes('Schedule a follow-up')", "the follow-up dialog");
  await clickText("Schedule", "[role=dialog] button");
  await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('[aria-label=\"Call summary\"]').innerText.includes('Accepted')", "the accepted suggestion");
  const followUps = (await sql(`query F($org: UUID!, $lead: UUID!) { leadFollowUps(where: {organizationId: {eq: $org}, leadId: {eq: $lead}}) { id title } }`, {org: f.orgA, lead: lead.id})).leadFollowUps;
  assert.equal(followUps.length, followUpsBefore + 1, "exactly one follow-up");
  assert.ok(followUps.some(row => row.title === "Send the floor plans"));
  const suggestionId = (await summaries()).summaries[0].suggestions.find(item => item.kind === "FOLLOW_UP").id;
  assert.equal((await post(`/api/communications/suggestions/${suggestionId}/decide`, {action: "ACCEPT", followUpAt: new Date(Date.now() + 86_400_000).toISOString()})).status, 409, "a suggestion is accepted once");
  await clickText("Mark reviewed", "button");
  await waitFor("document.querySelector('[aria-label=\"Call summary\"]').innerText.includes('Reviewed')", "the reviewed summary");
  const leadAfter = (await sql(`query L($org: UUID!, $id: UUID!) { lead(key: {organizationId: $org, id: $id}) { budgetMin budgetMax preferredLocation } }`, {org: f.orgA, id: lead.id})).lead;
  assert.deepEqual(leadAfter, {budgetMin: null, budgetMax: null, preferredLocation: null}, "nothing in the summary changed the lead");
  pass("The agent sees which points are supported, accepts a follow-up suggestion once through the lead's follow-ups, marks the summary reviewed, and the lead is unchanged");

  await signIn("manager-a");
  assert.equal((await api(`/api/communications/calls/${recordedCall}/summaries`)).status, 404);
  await signIn("owner-b");
  assert.equal((await api(`/api/communications/calls/${recordedCall}/summaries`)).status, 404);
  assert.equal((await post(`/api/communications/suggestions/${suggestionId}/decide`, {action: "DISMISS"})).status, 409);
  pass("Managers without the lead and other companies cannot read or act on summaries");

  // ------------------------------------------------------------ 6F.5: voice assistant, test mode only
  await signIn("agent-a");
  assert.equal((await api("/api/communications/voice-assistant")).status, 403);
  await signIn("manager-a");
  assert.equal((await api("/api/communications/voice-assistant")).status, 403);
  assert.equal((await post("/api/communications/voice-assistant/sessions")).status, 403);
  await load("/communications/voice-assistant", "document.body.innerText.includes('Only owners and administrators')");
  assert.equal(await evaluate("[...document.querySelectorAll('nav[aria-label=\"Communications sections\"] a')].some(a=>a.textContent.includes('Voice assistant'))"), false);
  pass("Managers and agents cannot configure or test the voice assistant, and do not see it");

  // A fictional active project the assistant may talk about.
  const projectId = randomUUID();
  await dc.executeGraphql(`mutation P($org: UUID!, $dev: UUID!, $id: UUID!) {
    developer_insert(data: {organizationId: $org, id: $dev, name: "Example Developments", slug: "example-developments-e2e", createdByUid: "owner-a", updatedByUid: "owner-a"})
    project_insert(data: {organizationId: $org, id: $id, developerId: $dev, projectName: "Harbour Crest (fictional)", projectCode: "E2E-HC", projectType: RESIDENTIAL, projectStatus: ACTIVE,
      constructionStatus: UNDER_CONSTRUCTION, emirate: DUBAI, community: "Creek Harbour", startingPriceMinor: "120000000", expectedHandoverDate: "2027-12-31", createdByUid: "owner-a", updatedByUid: "owner-a"})
  }`, {variables: {org: f.orgA, dev: randomUUID(), id: projectId}});
  await signIn("owner-a");
  const baseVoice = {expectedRevision: 0, status: "DRAFT", assistantName: "E2E Assistant", greeting: "How can I help?", questions: [], handoffMessage: "A colleague will call you back shortly.",
    projectIds: [], listingIds: [], maxTurns: 6, maxSessionMinutes: 5, maxReplyTokens: 2000};
  assert.equal((await post("/api/communications/voice-assistant", {...baseVoice, disclosureText: "Hello and thank you for calling our agency today."}, f.orgA, "PUT")).status, 400, "an AI disclosure is required");
  assert.equal((await post("/api/communications/voice-assistant", {...baseVoice, disclosureText: "You are speaking with an AI assistant.", status: "LIVE"}, f.orgA, "PUT")).status, 400, "there is no live status");
  await load("/communications/voice-assistant", "!!document.querySelector('input[name=assistantName]')");
  assert.match(await evaluate("document.body.innerText"), /Test mode only/);
  await evaluate(`(()=>{document.querySelector('select[name=status]').value='TEST_ONLY';
    const box=[...document.querySelectorAll('input[name=projectIds]')].find(e=>e.value.replaceAll('-','')===${JSON.stringify(projectId.replaceAll("-", ""))});if(!box)throw Error('project option missing');if(!box.checked)box.click();})()`);
  await clickText("Save", "button");
  await waitFor("fetch('/api/communications/voice-assistant').then(r=>r.json()).then(b=>b.data.config?.status === 'TEST_ONLY' && b.data.config.projectIds.length === 1)", "the saved assistant");
  pass("An owner configures the assistant with a required AI disclosure and an allowed active project; there is no live mode");

  const voiceUsage = async () => (await sql(`query U($org: UUID!) { aiUsageRecords(where: {organizationId: {eq: $org}, feature: {eq: "VOICE_ASSISTANT"}}) { status userUid contentType } }`, {org: f.orgA})).aiUsageRecords;
  const say = async text => {
    await evaluate(`(()=>{const e=document.querySelector('[data-testid=voice-simulator] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(text)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await pause(100);
    await clickText("Say", "[data-testid=voice-simulator] button");
  };
  await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Start test call') && !b.disabled)", "the start button");
  await clickText("Start test call", "button");
  await waitFor("!!document.querySelector('[data-testid=voice-simulator] input')", "the simulator");
  assert.equal(await evaluate("document.querySelector('[data-testid=voice-simulator] li[data-turn-kind]').dataset.turnKind"), "DISCLOSURE", "the AI disclosure comes first");
  assert.match(await evaluate("document.querySelector('[data-testid=voice-simulator]').innerText"), /Harbour Crest \(fictional\)/);
  await say("Can I speak to a real person, please?");
  await waitFor("document.querySelector('[data-testid=voice-session-status]')?.textContent === 'Handed to a person'", "the handoff");
  assert.match(await evaluate("document.querySelector('[data-testid=voice-simulator]').innerText"), /A member of our team will call you back/, "the configured handoff message");
  assert.equal((await voiceUsage()).length, 0, "a request for a person is handled without Claude");
  pass("A test call opens with the AI disclosure, and asking for a person hands over without calling Claude");

  await clickText("Start test call", "button");
  await waitFor("document.querySelector('[data-testid=voice-session-status]')?.textContent === 'In progress'", "a second test call");
  await say("What is the starting price at Harbour Crest?");
  await waitFor("document.querySelector('[data-testid=voice-session-status]')?.textContent === 'Handed to a person' && !document.querySelector('[data-testid=voice-replying]')", "the fallback handoff");
  const fallbackText = await evaluate("document.querySelector('[data-testid=voice-simulator]').innerText");
  assert.match(fallbackText, /Fallback: Claude unavailable/);
  assert.match(fallbackText, /Claude could not answer/);
  assert.ok((await voiceUsage()).some(row => row.status === "FAILED" && row.userUid === "owner-a" && row.contentType === "VOICE_TEST_TURN"), "the attempt is recorded as AI usage");
  await evaluate("document.querySelector('[data-testid=voice-simulator]').scrollIntoView({block: 'start'})"); await pause(300);
  await screenshot("voice-assistant-simulator");
  pass("With Anthropic refusing the key, the assistant hands the caller to a person and the usage is recorded");

  // Interrupting a reply in progress (state set as the server leaves it while Claude answers).
  const third = await post("/api/communications/voice-assistant/sessions");
  assert.equal(third.status, 201, JSON.stringify(third.body));
  const sessionId = third.body.data.id;
  const sessionView = async () => (await api(`/api/communications/voice-assistant/sessions/${sessionId}`)).body.data;
  assert.equal((await post(`/api/communications/voice-assistant/sessions/${sessionId}/interrupt`, {turnId: randomUUID()})).status, 409, "nothing to interrupt");
  const pendingTurn = randomUUID();
  const before = await sessionView();
  const pendingTurns = [...before.turns, {id: pendingTurn, role: "CALLER", kind: "UTTERANCE", text: "Tell me about the payment plan", at: new Date().toISOString()}];
  await dc.executeGraphql(`mutation T($org: UUID!, $id: UUID!, $turn: UUID!, $turns: String!) { voiceAssistantTestSession_update(key: {organizationId: $org, id: $id}, data: {turnsJson: $turns, callerTurns: 1, pendingTurnId: $turn, pendingSince_expr: "request.time", revision_update: {inc: 1}}) }`,
    {variables: {org: f.orgA, id: sessionId, turn: pendingTurn, turns: JSON.stringify(pendingTurns)}});
  const busy = await sessionView();
  assert.equal(busy.pending, true);
  assert.equal((await post(`/api/communications/voice-assistant/sessions/${sessionId}/turns`, {utterance: "Hello?", turnId: randomUUID(), expectedRevision: busy.revision})).status, 409, "no new turn while a reply is pending");
  assert.equal((await post(`/api/communications/voice-assistant/sessions/${sessionId}/interrupt`, {turnId: pendingTurn})).status, 200);
  const interruptedView = await sessionView();
  assert.equal(interruptedView.pending, false);
  assert.equal(interruptedView.turns.at(-1).kind, "INTERRUPTED");
  assert.equal((await post(`/api/communications/voice-assistant/sessions/${sessionId}/interrupt`, {turnId: pendingTurn})).status, 409, "a reply is interrupted once");
  assert.equal((await post(`/api/communications/voice-assistant/sessions/${sessionId}/end`)).status, 200);
  assert.equal((await post(`/api/communications/voice-assistant/sessions/${sessionId}/turns`, {utterance: "Hello?", turnId: randomUUID(), expectedRevision: (await sessionView()).revision})).status, 409, "an ended test accepts nothing");
  pass("Interrupting discards the pending reply exactly once; ended test calls accept no more turns");

  await signIn("admin-a");
  assert.equal((await api(`/api/communications/voice-assistant/sessions/${sessionId}`)).status, 200, "administrators can review any test call");
  const fourth = await post("/api/communications/voice-assistant/sessions");
  await signIn("owner-a");
  const othersSession = (await api(`/api/communications/voice-assistant/sessions/${fourth.body.data.id}`)).body.data;
  assert.equal((await post(`/api/communications/voice-assistant/sessions/${fourth.body.data.id}/turns`, {utterance: "Hi", turnId: randomUUID(), expectedRevision: othersSession.revision})).status, 403, "only the tester continues their own call");
  await signIn("owner-b");
  assert.equal((await api(`/api/communications/voice-assistant/sessions/${sessionId}`)).status, 404);
  assert.equal((await post("/api/communications/voice-assistant/sessions", {}, f.orgB)).status, 409, "another company without a configuration cannot start tests");
  pass("Test calls stay within the company and are continued only by the person who started them");

  // ------------------------------------------------------------ 6F.6: a missed call starts a workflow (template G)
  const tickNow = async () => {
    const response = await fetch(origin + "/api/internal/automations/tick", {method: "POST", headers: {Authorization: `Bearer ${workerSecret}`}, signal: AbortSignal.timeout(120000)});
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.data.errors, 0, "tick errors: " + serverLog.slice(-2000));
  };
  await signIn("owner-a");
  const workflow = await post("/api/automations", {definition: {schemaVersion: 1, name: "E2E missed call follow-up", description: "Template G", trigger: "call.missed",
    steps: [{id: "call-back", type: "task.create", title: "Call back {{lead.fullName}}", dueMinutes: 30, assignee: "ASSIGNEE"},
      {id: "notify-agent", type: "notification.create", audience: "ASSIGNEE", title: "Missed call", message: "A call from {{lead.fullName}} was missed."}]}});
  assert.equal(workflow.status, 201, JSON.stringify(workflow.body));
  const workflowId = workflow.body.data.id;
  for (const [action, extra] of [["submit"], ["approve", {versionNumber: 1}], ["activate"]]) {
    const revision = (await api(`/api/automations/${workflowId}`)).body.data.workflow.revision;
    const result = await post(`/api/automations/${workflowId}/transition`, {action, expectedRevision: revision, ...extra});
    assert.equal(result.status, 200, `${action}: ${JSON.stringify(result.body)}`);
  }
  await signIn("agent-a");
  const callBacks = async () => (await sql(`query F($org: UUID!, $lead: UUID!) { leadFollowUps(where: {organizationId: {eq: $org}, leadId: {eq: $lead}, title: {startsWith: "Call back"}}) { id } }`, {org: f.orgA, lead: lead.id})).leadFollowUps.length;
  const callBacksBefore = await callBacks();
  const outgoingAttempt = await post("/api/communications/calls", {requestId: randomUUID(), leadId: lead.id, direction: "OUTBOUND", callType: "FOLLOW_UP", callStatus: "NO_ANSWER", startedAt: new Date(Date.now() - 180_000).toISOString(), durationSeconds: 0});
  assert.equal(outgoingAttempt.status, 201, JSON.stringify(outgoingAttempt.body));
  const missedIn = await post("/api/communications/calls", {requestId: randomUUID(), leadId: lead.id, direction: "INBOUND", callType: "INBOUND_ENQUIRY", callStatus: "NO_ANSWER", startedAt: new Date(Date.now() - 120_000).toISOString(), durationSeconds: 0});
  assert.equal(missedIn.status, 201, JSON.stringify(missedIn.body));
  await tickNow(); await tickNow();
  assert.equal(await callBacks(), callBacksBefore + 1, "exactly one call-back task for the missed incoming call, none for the outgoing attempt");
  await tickNow();
  assert.equal(await callBacks(), callBacksBefore + 1, "a further tick changes nothing");
  const missedEvents = (await sql(`query E($org: UUID!) { automationEvents(where: {organizationId: {eq: $org}, triggerType: {eq: "call.missed"}}) { status matchedCount } }`, {org: f.orgA})).automationEvents;
  assert.ok(missedEvents.some(row => row.matchedCount === 1), JSON.stringify(missedEvents));
  pass("A missed incoming call starts the missed-call workflow once (one call-back task); an unanswered outgoing attempt starts nothing");

  // ------------------------------------------------------------ 6F.6: meetings
  assert.equal((await post("/api/communications/meetings", {requestId: randomUUID(), leadId: lead.id, details: {title: "Wrong link", provider: "ZOOM", meetingUrl: "https://meet.google.com/abc-defg-hij",
    startsAt: new Date(Date.now() + 86_400_000).toISOString(), endsAt: new Date(Date.now() + 90_000_000).toISOString()}})).status, 400, "a link must match the provider");
  await load(`/leads/${lead.id}`, "!!document.querySelector('#meetings') && document.querySelector('#meetings').innerText.includes('No meetings yet')");
  await clickText("Schedule meeting", "#meetings button");
  await waitFor("document.querySelector('[role=dialog]')?.innerText.includes('Schedule a meeting') && !!document.querySelector('[role=dialog] [name=startsAt]')?.value", "the meeting dialog");
  await setField("title", "E2E consultation");
  await setField("meetingUrl", "https://meet.google.com/abc-defg-hij");
  await setField("agenda", "Two-bedroom options in Dubai Marina (synthetic).");
  await clickText("Schedule", "[role=dialog] button");
  await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('#meetings').innerText.includes('E2E consultation')", "the scheduled meeting");
  const meetingHref = await evaluate("document.querySelector('#meetings a[href^=\"/communications/meetings/\"]').getAttribute('href')");
  const meetingId = meetingHref.split("/").pop();
  await load(meetingHref, "!!document.querySelector('[data-testid=meeting-status]')");
  const link = await evaluate("(()=>{const a=[...document.querySelectorAll('a')].find(a=>a.textContent.includes('Open in Google Meet'));return a&&{href:a.href,target:a.target,rel:a.rel};})()");
  assert.deepEqual(link, {href: "https://meet.google.com/abc-defg-hij", target: "_blank", rel: "noopener noreferrer"});
  await clickText("Mark as held", "button");
  await waitFor("document.querySelector('[role=dialog]')?.innerText.includes('Meeting held')", "the held dialog");
  await setField("notes", "Customer wants a two-bedroom apartment in Dubai Marina and asked for the payment plan.");
  await clickText("Save", "[role=dialog] button");
  await waitFor("document.querySelector('[data-testid=meeting-status]')?.textContent === 'Held' && !!document.querySelector('[data-testid=meeting-notes]')", "the held meeting");
  const meetingEvents = (await sql(`query E($org: UUID!, $id: UUID!) { automationEvents(where: {organizationId: {eq: $org}, targetId: {eq: $id}}) { triggerType } }`, {org: f.orgA, id: meetingId})).automationEvents.map(row => row.triggerType).sort();
  assert.deepEqual(meetingEvents, ["meeting.completed", "meeting.scheduled"]);
  await clickText("Summarise the notes", "button");
  await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Summarise the notes') && !b.disabled)", "the failed meeting summary");
  assert.equal((await api(`/api/communications/meetings/${meetingId}`)).body.data.summary, null, "a failed Claude request stores nothing");
  const meetingUsage = (await sql(`query U($org: UUID!) { aiUsageRecords(where: {organizationId: {eq: $org}, contentType: {eq: "MEETING_SUMMARY"}}) { status userUid } }`, {org: f.orgA})).aiUsageRecords;
  assert.ok(meetingUsage.some(row => row.status === "FAILED" && row.userUid === "agent-a"));
  await screenshot("meeting-detail");
  assert.equal((await post(`/api/communications/meetings/${meetingId}/status`, {expectedRevision: 1, status: "CANCELLED"})).status, 409, "a held meeting cannot be cancelled");
  await load("/communications/meetings", "document.querySelector('[aria-label=Meetings]')?.innerText.includes('E2E consultation')");
  await signIn("manager-a");
  assert.equal((await api(`/api/communications/meetings/${meetingId}`)).status, 404);
  await signIn("owner-b");
  assert.equal((await api(`/api/communications/meetings/${meetingId}`)).status, 404);
  pass("An agent schedules a meeting from the lead with a checked link, opens it in the provider's app, records it as held once with the workflow events; Claude failure stores nothing; others cannot see it");

  // ------------------------------------------------------------ 6F.6: the call.summarize workflow step
  await signIn("owner-a");
  const summarizer = await post("/api/automations", {definition: {schemaVersion: 1, name: "E2E summarise answered calls", description: "Template H without the wait", trigger: "call.completed",
    conditions: {field: "call.outcome", operator: "eq", value: "CALLBACK_REQUESTED"}, steps: [{id: "summarise", type: "call.summarize"}]}});
  assert.equal(summarizer.status, 201, JSON.stringify(summarizer.body));
  for (const [action, extra] of [["submit"], ["approve", {versionNumber: 1}], ["activate"]]) {
    const revision = (await api(`/api/automations/${summarizer.body.data.id}`)).body.data.workflow.revision;
    assert.equal((await post(`/api/automations/${summarizer.body.data.id}/transition`, {action, expectedRevision: revision, ...extra})).status, 200, action);
  }
  await signIn("agent-a");
  const summarizedCall = await post("/api/communications/calls", {requestId: randomUUID(), leadId: lead.id, direction: "OUTBOUND", callType: "FOLLOW_UP", callStatus: "COMPLETED", outcome: "CALLBACK_REQUESTED",
    startedAt: new Date(Date.now() - 90_000).toISOString(), durationSeconds: 75, notes: "Customer asked for a call back tomorrow about two-bedroom units (synthetic)."});
  assert.equal(summarizedCall.status, 201, JSON.stringify(summarizedCall.body));
  await tickNow(); await tickNow();
  await signIn("owner-a");
  const history = await api(`/api/automations/executions?workflowId=${summarizer.body.data.id}`);
  assert.equal(history.status, 200, JSON.stringify(history.body).slice(0, 500));
  const runs = history.body.data.executions;
  assert.equal(runs.length, 1, "the answered call started the workflow once");
  const workflowUsage = (await sql(`query U($org: UUID!) { aiUsageRecords(where: {organizationId: {eq: $org}, contentType: {eq: "CALL_SUMMARY"}, userUid: {eq: "owner-a"}}) { status errorCode } }`, {org: f.orgA})).aiUsageRecords;
  assert.ok(workflowUsage.some(row => row.status === "FAILED"), "the step asked Claude as the workflow's executor (refused in invalid-key mode) and the usage is recorded");
  assert.equal((await api(`/api/communications/calls/${summarizedCall.body.data.call.id}/summaries`)).body.data.summaries.length, 0, "nothing is stored when Claude fails");
  pass("An answered call starts a workflow whose call.summarize step asks Claude as the executor; with the key refused nothing is stored and the usage is recorded");

  // ------------------------------------------------------------ numbers saved in display form (as older demo data)
  const displayContact = randomUUID();
  await dc.executeGraphql(`mutation C($org: UUID!, $id: UUID!) { contact_insert(data: {organizationId: $org, id: $id, fullName: "E2E Display Number", phone: "+44 7700 900077", createdByUid: "owner-a"}) }`, {variables: {org: f.orgA, id: displayContact}});
  const displayView = (await api(`/api/communications/contacts/${displayContact}/calls`)).body.data;
  assert.deepEqual(displayView.numbers, [], "a number the database cannot match is not offered");
  assert.equal(displayView.numbersNeedingUpdate, 1);
  const withoutNumber = await post(`/api/communications/calls`, {requestId: randomUUID(), contactId: displayContact, direction: "INBOUND", callType: "INBOUND_ENQUIRY", callStatus: "COMPLETED",
    startedAt: new Date(Date.now() - 60_000).toISOString(), durationSeconds: 30, notes: "Synthetic"});
  assert.equal(withoutNumber.status, 201, JSON.stringify(withoutNumber.body));
  await load(`/contacts/${displayContact}`, "document.querySelector('#calls')?.innerText.includes('Edit and save the contact')");
  pass("A phone saved in display form is flagged with how to fix it instead of failing on save; the call is still logged");

  // ------------------------------------------------------------ 6F.6: reports
  await signIn("agent-a");
  // The test meeting is tomorrow, so the period runs to the day after (Dubai dates).
  const reportTo = new Date(Date.now() + 4 * 3_600_000 + 2 * 86_400_000).toISOString().slice(0, 10);
  const own = (await api(`/api/communications/reports?agent=${f.memberOwnerA}&to=${reportTo}`)).body.data;
  assert.equal(own.companyWide, false);
  assert.ok(own.byAgent.every(row => row.agentId.replaceAll("-", "") === f.memberAgentA.replaceAll("-", "")), "agents see only their own figures");
  assert.ok(own.totals.attempts >= 1 && own.totals.missed >= 1 && own.meetings.held >= 1, JSON.stringify(own.totals));
  assert.equal((await api("/api/communications/reports?from=2026-01-01&to=2026-12-31")).status, 400, "at most 92 days");
  await signIn("owner-a");
  await load("/communications/reports", "!!document.querySelector('[aria-label=\"Report by agent\"]')");
  const reportText = await evaluate("document.body.innerText");
  assert.match(reportText, /not a measure of quality/);
  assert.match(reportText, /Outgoing attempts/);
  await screenshot("communication-reports");
  pass("Reports separate attempts, answers, conversations and meetings; agents see only their own figures; owners see the company");

  // ------------------------------------------------------------ developer simulator (synthetic records only)
  await signIn("agent-a");
  assert.equal((await api("/api/dev/communication-tests")).status, 403, "agents cannot use the simulator");
  await load("/dev/communication-tests", "document.body.innerText.includes('Only owners and administrators can use the communication simulator')");
  await signIn("owner-a");
  const realCallsBefore = (await sql(`query C($org: UUID!) { callRecords(where: {organizationId: {eq: $org}, source: {ne: SIMULATED}}) { id } }`, {org: f.orgA})).callRecords.length;
  const dashboardBefore = (await api("/api/communications/dashboard")).body.data.totals;
  assert.equal((await post("/api/dev/communication-tests/calls", {leadId: lead.id, direction: "INBOUND", scenario: "MISSED"})).status, 400, "simulated calls are refused on real leads");
  await load("/dev/communication-tests", "document.body.innerText.includes('Fictional leads')");
  await clickText("Create fictional lead", "button");
  await waitFor("!!document.querySelector('[aria-label=\"Fictional leads\"]')?.innerText.includes('[SIM] Test customer')", "the fictional lead");
  const simLeadId = (await api("/api/dev/communication-tests")).body.data.leads[0].leadId;
  await evaluate("(()=>{const f=document.querySelector('form[aria-label=\"Simulate a call\"]');f.querySelector('[name=direction]').value='INBOUND';})()");
  await evaluate(`(()=>{const e=document.querySelector('[name=scenario]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,'MISSED');e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await pause(200);
  await clickText("Run scenario", "button");
  await waitFor("document.querySelector('[aria-label=\"Event log\"]')?.innerText.includes('NO_ANSWER')", "the scenario log");
  const simLog = await evaluate("document.querySelector('[aria-label=\"Event log\"]').innerText");
  assert.match(simLog, /RINGING\s*APPLIED/);
  assert.match(simLog, /NO_ANSWER\s*APPLIED\s*workflow event call\.missed/);
  const simCall = (await api("/api/dev/communication-tests")).body.data.calls[0];
  assert.equal(simCall.callStatus, "NO_ANSWER");
  const simTasks = async () => (await sql(`query F($org: UUID!, $lead: UUID!) { leadFollowUps(where: {organizationId: {eq: $org}, leadId: {eq: $lead}}) { id title } }`, {org: f.orgA, lead: simLeadId})).leadFollowUps;
  await tickNow(); await tickNow();
  assert.equal((await simTasks()).length, 1, "the missed-call workflow created one call-back task for the simulated missed call");
  const replay = await post(`/api/dev/communication-tests/calls/${simCall.id}/events`, {status: "NO_ANSWER"});
  assert.equal(replay.body.data.result, "DUPLICATE");
  const late = await post(`/api/dev/communication-tests/calls/${simCall.id}/events`, {status: "RINGING"});
  assert.equal(late.body.data.result, "FINAL", "a late event cannot reopen the call");
  await tickNow();
  assert.equal((await simTasks()).length, 1, "replayed and late events create no further tasks");
  await screenshot("dev-communication-simulator");
  pass("The developer simulator creates fictional leads, plays a missed call through the provider state machine, starts the missed-call workflow once, and ignores replayed and late events");

  await load(`/leads/${simLeadId}`, "document.querySelector('#calls')?.innerText.includes('Simulated')");
  const dashboardAfter = (await api("/api/communications/dashboard")).body.data;
  assert.deepEqual(dashboardAfter.totals, dashboardBefore, "simulated calls never count in the dashboard by default");
  assert.ok(dashboardAfter.simulated.available && dashboardAfter.simulated.count >= 1);
  assert.equal((await api("/api/communications/dashboard?includeSimulated=1")).body.data.totals.missed, dashboardBefore.missed + 1, "they count only when explicitly included");
  const listed = (await api("/api/communications/calls")).body.data.calls;
  assert.ok(!listed.some(call => call.source === "SIMULATED"), "the call list leaves them out too");
  assert.ok((await api("/api/communications/calls?includeSimulated=1")).body.data.calls.some(call => call.source === "SIMULATED"));
  assert.equal((await api("/api/communications/reports?includeSimulated=1")).body.data.simulated.included, true);
  pass("Simulated calls are labelled on the lead and left out of dashboards, lists and reports unless explicitly included");

  await signIn("owner-b");
  assert.equal((await api("/api/dev/communication-tests")).body.data.calls.length, 0, "another company sees none of them");
  assert.equal((await post("/api/dev/communication-tests/calls", {leadId: simLeadId, direction: "INBOUND", scenario: "MISSED"}, f.orgB)).status, 400, "nor can it simulate on another company's lead");
  await signIn("owner-a");
  const reset = await post("/api/dev/communication-tests/reset");
  assert.equal(reset.status, 200, JSON.stringify(reset.body));
  assert.equal((await api("/api/dev/communication-tests")).body.data.calls.length, 0);
  assert.equal((await sql(`query C($org: UUID!) { callRecords(where: {organizationId: {eq: $org}, source: {ne: SIMULATED}}) { id } }`, {org: f.orgA})).callRecords.length, realCallsBefore, "real calls are untouched by the reset");
  assert.ok((await sql(`query L($org: UUID!, $id: UUID!) { lead(key: {organizationId: $org, id: $id}) { archivedAt } }`, {org: f.orgA, id: simLeadId})).lead.archivedAt, "the fictional lead is archived");
  pass("Other companies cannot see or use the simulator's records; reset removes only simulator data");

  assert.deepEqual(exceptions.filter(message => !/ResizeObserver/.test(message)), [], "no uncaught browser exceptions");
  console.log(`\n${checks} communication end-to-end checks passed.`);
} catch (error) {
  if (error !== LIVE_DONE) failure = error;
  else console.log(`\n${checks} live Claude communication checks passed.`);
} finally {
  try { socket?.close(); } catch { /* closed */ }
  stop(browser); stop(server);
  await deleteApp(authApp).catch(() => {}); await deleteApp(sqlApp).catch(() => {});
}
if (failure) { console.error(failure); console.error(`--- Next.js server log (tail) ---
${serverLog.slice(-6000)}`); process.exit(1); }
process.exit(0);
