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
import { localDataConnect } from "../scripts/sql-connect-local.mjs";
import { fixture as f } from "./fixtures/sql-connect-fixtures.mjs";

// Phase 7A unified inbox against the real app, real sessions and real SQL Connect authorization.
// Run through `npm run test:inbox:e2e`. Fictional customers (+44 7700 900xxx, example.test) on isolated
// emulators; no channel provider is connected and nothing is sent outside EstateOS.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = process.env.ESTATEOS_E2E_WORKSPACE;
const executable = process.env.ESTATEOS_TEST_BROWSER;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!workspace || !executable || !authHost?.startsWith("127.0.0.1:") || process.env.GCLOUD_PROJECT !== "demo-estateos-test") {
  throw new Error("Run npm run test:inbox:e2e; this script needs the isolated emulators it starts.");
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
const authApp = initializeApp({projectId: "demo-estateos-test"}, "inbox-e2e-auth");
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
  assert.equal((await api("/api/inbox/conversations")).status, 401);
  assert.equal((await post("/api/inbox/conversations/" + randomUUID() + "/notes", {body: "x"})).status, 401);
  pass("Unauthenticated inbox reads and changes are rejected");

  // ------------------------------------------------------------ fixtures through the server-only storage (as ingestion writes them)
  await signIn("owner-a");
  const PHONE = "+447700900701";
  const created = await post("/api/leads", {fullName: "Inbox Customer " + randomUUID().slice(0, 6), phone: "+44 7700 900701", email: "inbox.customer@example.test", assignedMembershipId: f.memberAgentA});
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const lead = (await sql(`query L($org: UUID!, $phone: String!) { leads(where: {organizationId: {eq: $org}, phone: {eq: $phone}}) { id contactId fullName } }`, {org: f.orgA, phone: PHONE})).leads[0];
  const minutesAgo = minutes => new Date(Date.now() - minutes * 60_000).toISOString();
  const conversation = async values => {
    const id = randomUUID();
    await sql(`mutation C($org: UUID!, $id: UUID!, $channel: InboxChannel!, $thread: String!, $identity: String!, $name: String, $subject: String, $contact: UUID, $lead: UUID, $assignee: UUID, $at: Timestamp!, $preview: String, $unread: Int!) {
      inboxConversation_insert(data: {organizationId: $org, id: $id, channel: $channel, externalThreadId: $thread, customerIdentity: $identity, customerName: $name, subject: $subject, contactId: $contact, leadId: $lead,
        assignedMembershipId: $assignee, lastMessageAt: $at, lastInboundAt: $at, lastMessagePreview: $preview, unreadCount: $unread}) }`,
      {org: f.orgA, id, channel: "WHATSAPP", thread: "thread-" + id, name: null, subject: null, contact: null, lead: null, assignee: null, at: minutesAgo(5), preview: null, unread: 1, ...values});
    return id;
  };
  const message = (conversationId, content, at, extra = {}) => sql(`mutation M($org: UUID!, $id: UUID!, $conversation: UUID!, $external: String!, $content: String, $at: Timestamp!, $direction: InboxDirection!, $status: InboxDeliveryStatus!, $sender: String) {
      inboxMessage_insert(data: {organizationId: $org, id: $id, conversationId: $conversation, externalMessageId: $external, direction: $direction, senderIdentity: $sender, content: $content, deliveryStatus: $status, createdAt: $at, providerTimestamp: $at}) }`,
    {org: f.orgA, id: randomUUID(), conversation: conversationId, external: "ext-" + randomUUID(), content, at, direction: "INBOUND", status: "RECEIVED", sender: PHONE, ...extra});
  const linked = await conversation({identity: PHONE, name: "Fictional WhatsApp customer", contact: lead.contactId, lead: lead.id, assignee: f.memberAgentA, preview: "What is the payment plan?", unread: 2, at: minutesAgo(2)});
  await message(linked, "Hello, is the two-bedroom in the Marina still available?", minutesAgo(4));
  await message(linked, "What is the payment plan?", minutesAgo(2));
  const unknown = await conversation({channel: "EMAIL", identity: "someone.new@example.test", name: "Someone New", subject: "Viewing request <b>tomorrow</b>",
    preview: "Please call me <script>alert(1)</script>", unread: 1, at: minutesAgo(3)});
  await message(unknown, "Please call me <script>alert(1)</script> about https://phishing.example.test/login", minutesAgo(3), {sender: "someone.new@example.test"});
  for (let index = 0; index < 26; index++) await conversation({identity: "+4477009008" + String(index).padStart(2, "0"), name: "Older enquiry " + index, preview: "Older message " + index, unread: 0, at: minutesAgo(60 + index)});
  pass("Fictional conversations are stored for the inbox (linked WhatsApp, unknown email sender and older enquiries)");

  // ------------------------------------------------------------ AGENT: only their conversations; opening marks read; text stays text
  await signIn("agent-a");
  await load("/inbox", "!!document.querySelector('[data-testid=conversation-list]')");
  let listText = await evaluate("document.querySelector('[data-testid=conversation-list]').innerText");
  assert.match(listText, /Fictional WhatsApp customer|Inbox Customer/);
  assert.doesNotMatch(listText, /Someone New/, "agents never see unassigned conversations");
  assert.equal((await api("/api/inbox/conversations/" + unknown)).status, 404);
  assert.equal((await api("/api/inbox/counts")).body.data.UNREAD, 1);
  await load("/inbox/" + linked, "document.querySelector('[aria-label=Messages]')?.innerText.includes('payment plan')");
  await waitFor("fetch('/api/inbox/counts').then(r=>r.json()).then(b=>b.data.UNREAD === 0)", "the conversation marked read");
  assert.match(await evaluate("document.body.innerText"), /Sending is not connected for this channel/);
  assert.match(await evaluate("document.querySelector('[aria-label=Customer]').innerText"), /Inbox Customer/);
  await screenshot("inbox-agent");
  pass("An agent sees only their conversations, opens one with its customer panel, and it is marked read; sending is shown as not connected");

  // ------------------------------------------------------------ OWNER: views, search, pagination, safe text
  await signIn("owner-a");
  await load("/inbox", "!!document.querySelector('[data-testid=conversation-list]')");
  assert.equal(await evaluate("document.querySelectorAll('[data-testid=conversation-list] li').length"), 25, "the first page");
  await clickText("Load more", "button");
  await waitFor("document.querySelectorAll('[data-testid=conversation-list] li').length === 28", "the next page");
  await clickText("Unassigned", "nav[aria-label='Inbox views'] button");
  await waitFor("document.querySelector('[data-testid=conversation-list]')?.innerText.includes('Someone New') && !document.querySelector('[data-testid=conversation-list]').innerText.includes('Fictional WhatsApp customer')", "the unassigned view");
  await clickText("All conversations", "nav[aria-label='Inbox views'] button");
  await evaluate(`(()=>{const e=document.querySelector('#inbox-search');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'payment plan');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor("document.querySelectorAll('[data-testid=conversation-list] li').length === 1 && document.querySelector('[data-testid=conversation-list]').innerText.includes('Inbox Customer')", "the search result");
  await load("/inbox/" + unknown, "document.querySelector('[aria-label=Messages]')?.innerText.includes('phishing.example.test')");
  assert.equal(await evaluate("document.querySelectorAll('[aria-label=Messages] script, [aria-label=Messages] b, [aria-label=Messages] a').length"), 0, "message text is never rendered as HTML or links");
  assert.match(await evaluate("document.querySelector('[aria-label=Messages]').innerText"), /<script>alert\(1\)<\/script>/);
  pass("An owner sees every conversation, pages through them, filters the unassigned view and searches; message markup stays plain text");

  // Assign, link (with the identity check), status, a note; then reload.
  const assigneeSelect = "select[aria-label='Assigned to']";
  await waitFor("[...document.querySelectorAll(\"" + assigneeSelect + " option\")].length > 2", "the assignee choices");
  await evaluate(`(()=>{const e=document.querySelector("${assigneeSelect}");const o=[...e.options].find(o=>o.value.replaceAll('-','')===${JSON.stringify(f.memberAgentA.replaceAll("-", ""))});Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,o.value);e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await waitFor("fetch('/api/inbox/conversations/" + unknown + "').then(r=>r.json()).then(b=>b.data.assignedMembershipId !== null)", "the assignment");
  const assigned = (await api("/api/inbox/conversations/" + unknown)).body.data;
  assert.equal(assigned.assignments.length, 1);
  const linkResult = await post("/api/inbox/conversations/" + unknown + "/link", {expectedRevision: assigned.revision, leadId: lead.id});
  assert.equal(linkResult.status, 200, JSON.stringify(linkResult.body));
  assert.equal(linkResult.body.data.identityMatches, false, "the email sender is not on the lead's record: the member is told");
  const leadAfter = (await sql(`query L($org: UUID!, $id: UUID!) { lead(key: {organizationId: $org, id: $id}) { assignedMembershipId } }`, {org: f.orgA, id: lead.id})).lead;
  assert.equal(leadAfter.assignedMembershipId.replaceAll("-", ""), f.memberAgentA.replaceAll("-", ""), "linking never changes the lead's assignment");
  await load("/inbox/" + unknown, "document.querySelector('[aria-label=Customer]')?.innerText.includes('Inbox Customer')");
  await evaluate(`(()=>{const e=document.querySelector("select[aria-label='Status']");Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,'PENDING');e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await waitFor("fetch('/api/inbox/conversations/" + unknown + "').then(r=>r.json()).then(b=>b.data.status === 'PENDING')", "the pending status");
  await evaluate(`(()=>{const e=document.querySelector('textarea[id^=note-]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Asked for a call after 6 pm (synthetic).');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await clickText("Add note", "button");
  await waitFor("document.querySelector('[aria-label=Notes]')?.innerText.includes('after 6 pm')", "the note");
  await load("/inbox/" + unknown, "document.querySelector('[aria-label=Notes]')?.innerText.includes('after 6 pm')");
  assert.equal(await evaluate("document.querySelector(\"select[aria-label='Status']\").value"), "PENDING", "status and note are still there after a reload");
  await screenshot("inbox-owner");
  assert.ok(await evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "no sideways scrolling on a 1440px screen");
  await load("/inbox", "!!document.querySelector('[data-testid=conversation-list]')", {width: 390, height: 844, mobile: true});
  assert.ok(await evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "the list fits a phone");
  await load("/inbox/" + unknown, "!!document.querySelector('[aria-label=Messages]')", {width: 390, height: 844, mobile: true});
  assert.equal(await evaluate("getComputedStyle(document.querySelector('section[aria-label=Conversations]')).display"), "none", "on a phone the open conversation replaces the list");
  assert.ok(await evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "the conversation fits a phone");
  await screenshot("inbox-mobile");
  pass("An owner assigns, links with the identity check, marks pending and adds a note; the lead's assignment is unchanged and everything survives a reload");

  // ------------------------------------------------------------ MANAGER and other companies
  await signIn("manager-a");
  assert.equal((await api("/api/inbox/conversations/" + linked)).status, 404, "managers do not see other agents' conversations");
  const triage = (await api("/api/inbox/conversations?view=UNASSIGNED")).body.data;
  assert.ok(triage.conversations.length === 25 && triage.nextCursor, "managers triage the unassigned queue (a full page and more)");
  assert.equal((await api("/api/inbox/conversations?view=UNASSIGNED&cursor=" + encodeURIComponent(triage.nextCursor))).body.data.conversations.length, 1, "the cursor gives the rest");
  await signIn("owner-b");
  assert.equal((await api("/api/inbox/conversations/" + linked)).status, 404);
  assert.equal((await api("/api/inbox/conversations")).body.data.conversations.length, 0, "another company sees none of them");
  assert.ok([403, 404].includes((await post("/api/inbox/conversations/" + linked + "/notes", {body: "x"}, f.orgB)).status), "another company cannot write to it");
  assert.equal((await sql(`query N($org: UUID!, $id: UUID!) { inboxNotes(where: {organizationId: {eq: $org}, conversationId: {eq: $id}}) { id } }`, {org: f.orgA, id: linked})).inboxNotes.length, 0, "and nothing was written");
  pass("Managers triage only the unassigned queue; another company cannot read or change these conversations");

  // ------------------------------------------------------------ 7A.3: a website enquiry opens a linked conversation in the same transaction
  await signIn("owner-a");
  const form = await post("/api/lead-capture/forms", {name: "Inbox test form", status: "ACTIVE", consentText: "I agree to be contacted about my enquiry (synthetic).",
    privacyPolicyUrl: "https://example.test/privacy", successMessage: "Thank you", fields: [
      {key: "FULL_NAME", label: "Name", enabled: true, required: true}, {key: "EMAIL", label: "Email", enabled: true, required: false},
      {key: "PHONE", label: "Phone", enabled: true, required: false}, {key: "MESSAGE", label: "Message", enabled: true, required: false}]});
  assert.equal(form.status, 201, JSON.stringify(form.body));
  const publicId = (await sql(`query F($org: UUID!) { leadCaptureForms(where: {organizationId: {eq: $org}, name: {eq: "Inbox test form"}}) { publicId } }`, {org: f.orgA})).leadCaptureForms[0].publicId;
  const enquiry = await fetch(origin + "/api/public/lead-forms/" + encodeURIComponent(publicId), {method: "POST", headers: {"Content-Type": "application/json", "Idempotency-Key": "inbox-e2e-" + randomUUID()},
    body: JSON.stringify({fields: {FULL_NAME: "Website Visitor Example", EMAIL: "web.visitor@example.test", PHONE: "+44 7700 900742", MESSAGE: "Do you have a three-bedroom villa with a garden?"}, consent: true, elapsedMs: 9000})});
  assert.equal(enquiry.status, 201, await enquiry.text());
  const websiteRows = (await sql(`query W($org: UUID!) { inboxConversations(where: {organizationId: {eq: $org}, channel: {eq: WEBSITE}}) { id leadId contactId customerIdentity simulated lastMessagePreview } }`, {org: f.orgA})).inboxConversations;
  assert.equal(websiteRows.length, 1);
  assert.ok(websiteRows[0].leadId && websiteRows[0].contactId, "linked to the new lead and its contact");
  assert.equal(websiteRows[0].customerIdentity, "web.visitor@example.test");
  assert.equal(websiteRows[0].simulated, false);
  await load("/inbox/" + websiteRows[0].id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5"), "document.querySelector('[aria-label=Messages]')?.innerText.includes('three-bedroom villa')");
  const websiteEvents = (await sql(`query E($org: UUID!, $id: UUID!) { automationEvents(where: {organizationId: {eq: $org}, targetId: {eq: $id}}) { triggerType } }`, {org: f.orgA, id: websiteRows[0].id})).automationEvents.map(row => row.triggerType).sort();
  assert.deepEqual(websiteEvents, ["inbox.conversation.created", "inbox.message.received"]);
  pass("A website enquiry opens an inbox conversation linked to its new lead, with the visitor's message and the workflow events, in the same transaction");

  // ------------------------------------------------------------ 7A.3: the developer inbox simulator
  await signIn("agent-a");
  assert.equal((await post("/api/dev/communication-tests/inbox/inbound", {channel: "WHATSAPP", text: "x"})).status, 403, "agents cannot use the simulator");
  await signIn("owner-a");
  const fictional = await post("/api/dev/communication-tests/leads");
  assert.equal(fictional.status, 201, JSON.stringify(fictional.body));
  const simLeadId = fictional.body.data.leadId;
  const fromLead = await post("/api/dev/communication-tests/inbox/inbound", {channel: "WHATSAPP", leadId: simLeadId, text: "Hi, is the Marina apartment still available?"});
  assert.equal(fromLead.status, 201, JSON.stringify(fromLead.body));
  assert.equal(fromLead.body.data.status, "CREATED");
  assert.equal(fromLead.body.data.match, "MATCHED", "the fictional lead's number matched exactly one contact");
  const replay = await post("/api/dev/communication-tests/inbox/inbound", {channel: "WHATSAPP", leadId: simLeadId, text: "Hi, is the Marina apartment still available?", replayOf: fromLead.body.data.externalMessageId});
  assert.equal(replay.body.data.status, "DUPLICATE", "a repeated provider delivery is ignored");
  const reply = await post("/api/dev/communication-tests/inbox/inbound", {channel: "WHATSAPP", leadId: simLeadId, text: "Also, can I view it on Saturday?"});
  assert.equal(reply.body.data.status, "APPENDED");
  assert.equal(reply.body.data.conversationId, fromLead.body.data.conversationId, "a customer reply joins the same conversation");
  const simMessages = (await sql(`query M($org: UUID!, $id: UUID!) { inboxMessages(where: {organizationId: {eq: $org}, conversationId: {eq: $id}}) { id simulated } }`, {org: f.orgA, id: fromLead.body.data.conversationId})).inboxMessages;
  assert.equal(simMessages.length, 2, "two messages, not three");
  assert.ok(simMessages.every(row => row.simulated));
  const stranger = await post("/api/dev/communication-tests/inbox/inbound", {channel: "EMAIL", text: "Please send me your brochure.", subject: "Brochure"});
  assert.equal(stranger.body.data.match, "UNKNOWN");
  const strangerRow = (await api("/api/inbox/conversations/" + stranger.body.data.conversationId)).body.data;
  assert.equal(strangerRow.contactId, null, "an unknown sender stays unlinked until a person matches it");
  assert.equal(strangerRow.channel, "EMAIL");
  const simWebsite = await post("/api/dev/communication-tests/inbox/website", {message: "Simulated website question about payment plans."});
  assert.equal(simWebsite.status, 201, JSON.stringify(simWebsite.body));
  await load("/inbox?view=ALL", "!!document.querySelector('[data-testid=conversation-list]')");
  assert.doesNotMatch(await evaluate("document.querySelector('[data-testid=conversation-list]').innerText"), /SIMULATED/, "simulated conversations are not listed unless included");
  await evaluate("document.querySelector('[data-testid=include-simulated] input').click()");
  await waitFor("document.querySelector('[data-testid=conversation-list]').innerText.includes('SIMULATED')", "the simulated conversations");
  await load("/dev/communication-tests", "document.body.innerText.includes('Inbox simulator')");
  await screenshot("inbox-simulator");
  pass("The simulator stores WhatsApp, email and website messages through the real pipelines: matched and unknown senders, a reply in the same conversation, and a duplicate delivery ignored");

  await signIn("owner-b");
  assert.equal((await api("/api/dev/communication-tests/inbox")).body.data.conversations.length, 0, "another company sees none of the simulated conversations");
  assert.equal((await api("/api/inbox/conversations/" + fromLead.body.data.conversationId)).status, 404);
  await signIn("owner-a");
  const realBefore = (await sql(`query R($org: UUID!) { inboxConversations(where: {organizationId: {eq: $org}, simulated: {eq: false}}) { id } }`, {org: f.orgA})).inboxConversations.length;
  assert.equal((await post("/api/dev/communication-tests/reset")).status, 200);
  assert.equal((await sql(`query S($org: UUID!) { inboxConversations(where: {organizationId: {eq: $org}, simulated: {eq: true}}) { id } }`, {org: f.orgA})).inboxConversations.length, 0);
  assert.equal((await sql(`query R($org: UUID!) { inboxConversations(where: {organizationId: {eq: $org}, simulated: {eq: false}}) { id } }`, {org: f.orgA})).inboxConversations.length, realBefore, "real conversations are untouched");
  pass("Other companies cannot see simulated conversations; reset removes only simulated ones");

  assert.deepEqual(exceptions.filter(message => !/ResizeObserver/.test(message)), [], "no uncaught browser exceptions");
  console.log(`\n${checks} inbox end-to-end checks passed.`);
} catch (error) {
  if (error !== LIVE_DONE) failure = error;
  else console.log(`\n${checks} live Claude inbox checks passed.`);
} finally {
  try { socket?.close(); } catch { /* closed */ }
  stop(browser); stop(server);
  await deleteApp(authApp).catch(() => {}); await deleteApp(sqlApp).catch(() => {});
}
if (failure) { console.error(failure); console.error(`--- Next.js server log (tail) ---
${serverLog.slice(-6000)}`); process.exit(1); }
process.exit(0);
