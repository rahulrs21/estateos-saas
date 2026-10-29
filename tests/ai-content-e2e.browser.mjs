import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import * as sdk from "@dataconnect/admin-generated";
import { localDataConnect } from "../scripts/sql-connect-local.mjs";
import { fixture as f } from "./fixtures/sql-connect-fixtures.mjs";

// Phase 6B Content Studio. Run through `npm run test:ai-content:e2e` (and AI_E2E_LIVE=1 for real Claude calls).
// Everything here is synthetic, local-only data on isolated emulators.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = process.env.ESTATEOS_E2E_WORKSPACE;
const executable = process.env.ESTATEOS_TEST_BROWSER;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const live = process.env.AI_E2E_LIVE === "1";
if (!workspace || !executable || !authHost?.startsWith("127.0.0.1:") || process.env.GCLOUD_PROJECT !== "demo-estateos-test") {
  throw new Error("Run npm run test:ai-content:e2e; this script needs the isolated emulators it starts.");
}
writeFileSync(join(workspace, "tests-started"), new Date().toISOString());
const screens = join(workspace, "screens");
mkdirSync(screens, {recursive: true});
const pause = ms => new Promise(done => setTimeout(done, ms));
const password = "e2e-only-" + randomUUID();
let checks = 0;
const pass = message => { checks++; console.log(`✔ ${message}`); };
const MONTHLY_USER_LIMIT = 20;

// ---------------------------------------------------------------- fixtures
const {app: sqlApp, dc} = localDataConnect();
const seed = readFileSync(join(root, "dataconnect", "seed_data.gql"), "utf8");
if (process.env.DATA_CONNECT_EMULATOR_HOST !== "127.0.0.1:19999") throw new Error("Refusing to reset an unexpected SQL Connect emulator.");
await dc.executeGraphql(seed, {operationName: "ResetEstateOS"});
await dc.executeGraphql(seed, {operationName: "SeedEstateOS"});
const ids = {marina1: randomUUID(), marina2: randomUUID(), jvc: randomUUID(), foreign: randomUUID()};
const secrets = {hiddenAddress: "E2E HIDDEN STREET 9", hiddenLatitude: "25.093456", foreignRef: "E2E-B-SECRET", foreignLead: "E2E-B-LEAD-ZETA", unassignedLead: "E2E-A-UNASSIGNED-OMEGA"};
const property = (organizationId, id, propertyReference, extra) => ({organizationId, id, propertyReference, propertyType: "APARTMENT", marketType: "SECONDARY", emirate: "DUBAI", city: "Dubai",
  inventoryStatus: "AVAILABLE", builtUpArea: 1250, areaUnit: "SQFT", bathrooms: 2, createdByUid: organizationId === f.orgA ? "owner-a" : "owner-b", updatedByUid: organizationId === f.orgA ? "owner-a" : "owner-b", ...extra});
await dc.executeGraphql("mutation InsertProperties($data: [Property_Data!]!) { property_insertMany(data: $data) }", {variables: {data: [
  property(f.orgA, ids.marina1, "E2E-MARINA-1", {bedrooms: 2, community: "Dubai Marina", address: "E2E Marina Gate 1", mapDisplayMode: "EXACT", latitude: 25.0801, longitude: 55.1403,
    referencePriceMinor: "210000000", assignedMembershipId: f.memberAgentA}),
  property(f.orgA, ids.marina2, "E2E-MARINA-2", {bedrooms: 2, community: "Dubai Marina", address: secrets.hiddenAddress, mapDisplayMode: "HIDDEN", latitude: 25.093456, longitude: 55.151234,
    googlePlaceId: "ChIJ_e2e_hidden", referencePriceMinor: "240000000", internalNotes: "E2E-INTERNAL-NOTE"}),
  property(f.orgA, ids.jvc, "E2E-JVC-1", {bedrooms: 1, community: "Jumeirah Village Circle", mapDisplayMode: "APPROXIMATE", referencePriceMinor: "95000000"}),
  property(f.orgB, ids.foreign, secrets.foreignRef, {bedrooms: 2, community: "Dubai Marina", referencePriceMinor: "199000000"}),
]}});
const listing = (propertyId, listingReference, askingPriceMinor, assignedMembershipId = null) => ({organizationId: f.orgA, id: randomUUID(), propertyId, listingReference, listingPurpose: "SALE",
  marketType: "SECONDARY", title: `E2E sale ${listingReference}`, askingPriceMinor, currency: "AED", listingStatus: "ACTIVE", assignedMembershipId, createdByUid: "owner-a", updatedByUid: "owner-a"});
await dc.executeGraphql("mutation InsertListings($data: [PropertyListing_Data!]!) { propertyListing_insertMany(data: $data) }", {variables: {data: [
  listing(ids.marina1, "E2E-L-MARINA-1", "215000000", f.memberAgentA), listing(ids.marina2, "E2E-L-MARINA-2", "245000000"),
]}});
await dc.executeGraphql("mutation InsertLeads($data: [Lead_Data!]!) { lead_insertMany(data: $data) }", {variables: {data: [
  {organizationId: f.orgA, id: randomUUID(), fullName: secrets.unassignedLead, status: "NEW", preferredLocation: "Dubai Marina", createdByUid: "owner-a", updatedByUid: "owner-a"},
  {organizationId: f.orgB, id: randomUUID(), fullName: secrets.foreignLead, status: "QUALIFIED", createdByUid: "owner-b", updatedByUid: "owner-b"},
]}});
const authApp = initializeApp({projectId: "demo-estateos-test"}, "ai-content-e2e-auth");
for (const uid of ["owner-a", "admin-a", "agent-a", "owner-b"]) {
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

// ---------------------------------------------------------------- app server
const reservation = createServer();
await new Promise(done => reservation.listen(0, "127.0.0.1", done));
const port = reservation.address().port;
await new Promise(done => reservation.close(done));
const origin = `http://127.0.0.1:${port}`;
let serverLog = "";
const server = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env, NEXT_TELEMETRY_DISABLED: "1", NODE_ENV: "test", __NEXT_PROCESSED_ENV: "true",
    ESTATEOS_NEXT_DIST_DIR: ".tmp/ai-e2e/next", ESTATEOS_TSCONFIG_PATH: ".tmp/ai-e2e/tsconfig.json",
    APP_ORIGIN: origin, FIREBASE_PROJECT_ID: "demo-estateos-test", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-estateos-test",
    NEXT_PUBLIC_FIREBASE_API_KEY: "demo-key", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "127.0.0.1", NEXT_PUBLIC_FIREBASE_APP_ID: "demo-app",
    RATE_LIMIT_BACKEND: "sql-connect", FIREBASE_STORAGE_BUCKET: "demo-estateos-test.appspot.com",
    ESTATEOS_AI_ENABLED: "true",
    // Default mode: well-formed but invalid, so Anthropic itself rejects it.
    ANTHROPIC_API_KEY: live ? process.env.AI_E2E_ANTHROPIC_API_KEY : `sk-ant-api03-e2e-invalid-${"x".repeat(40)}`,
    ANTHROPIC_MODEL: live ? process.env.AI_E2E_ANTHROPIC_MODEL : "claude-sonnet-5-5",
    AI_MONTHLY_REQUESTS_PER_USER: String(MONTHLY_USER_LIMIT), AI_REQUESTS_PER_MINUTE_PER_MEMBER: "6",
    AI_E2E_ANTHROPIC_API_KEY: "",
  },
});
server.stdout.on("data", data => { serverLog = (serverLog + data).slice(-30000); });
server.stderr.on("data", data => { serverLog = (serverLog + data).slice(-30000); });

function stop(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") { try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {stdio: "ignore", windowsHide: true}); } catch { /* stopped */ } }
  else child.kill("SIGTERM");
}

// ---------------------------------------------------------------- browser (CDP)
const profile = join(workspace, "browser-profile");
mkdirSync(profile, {recursive: true});
const browser = spawn(executable, ["--headless=new", "--disable-gpu", "--no-proxy-server", "--no-first-run", "--disable-default-apps",
  "--disable-background-networking", "--disable-component-update", "--remote-debugging-port=0", "--user-data-dir=" + profile, "about:blank"], {windowsHide: true, stdio: "ignore"});
let socket, sequence = 0;
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
  throw new Error(`Timed out waiting for ${description}: ${text.slice(0, 1500)}\n--- server ---\n${serverLog.slice(-3000)}`);
}
async function load(path, ready) {
  await command("Emulation.setDeviceMetricsOverride", {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false});
  await command("Page.navigate", {url: origin + path});
  await waitFor(`document.readyState === "complete"`, `navigation to ${path}`);
  if (ready) await waitFor(ready, `${path} content`);
  await pause(700);
}
async function screenshot(label) {
  const result = await command("Page.captureScreenshot", {format: "png"});
  writeFileSync(join(screens, `${label}.png`), Buffer.from(result.data, "base64"));
}
async function clickText(label, selector = "button,a") {
  await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim().startsWith(${JSON.stringify(label)})&&!e.disabled);if(!e)throw Error('Missing control: '+${JSON.stringify(label)});e.scrollIntoView({block:'center'});e.click();})()`);
}
async function api(path, init = {}) {
  return evaluate(`(async()=>{const init=${JSON.stringify(init)};
    if(init.method&&init.method!=='GET'){const c=await (await fetch('/api/auth/csrf')).json();init.headers={'Content-Type':'application/json',...(init.headers||{}),'X-CSRF-Token':c.csrfToken};}
    const r=await fetch(${JSON.stringify(path)},init);let body=null;const text=await r.text();try{body=JSON.parse(text)}catch{body=text}
    return {status:r.status,retryAfter:r.headers.get('retry-after'),contentType:r.headers.get('content-type'),body};})()`, 240000);
}
async function signIn(uid) {
  await command("Network.clearBrowserCookies");
  await load("/api/auth/session");
  const token = await idToken(uid);
  const result = await evaluate(`(async()=>{const c=await (await fetch('/api/auth/csrf')).json();
    const r=await fetch('/api/auth/session',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':c.csrfToken},body:JSON.stringify({idToken:${JSON.stringify(token)}})});
    return {status:r.status,body:await r.json()};})()`);
  assert.equal(result.status, 200, `session for ${uid}: ${JSON.stringify(result.body)}`);
  // A member who already selected a company sees the workspace shell instead of the picker.
  await load("/onboarding/company?select=1", "[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Open workspace')) || document.body.innerText.includes('Signed in as')");
  if (!await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Open workspace'))")) return;
  await evaluate(`(()=>{const s=document.querySelector('form select');if(s&&!s.value){const o=[...s.options].find(o=>o.value);Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,o.value);s.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
  await pause(300);
  await clickText("Open workspace", "button");
  await waitFor("!location.pathname.startsWith('/onboarding')", "the selected workspace");
}
const usageRows = async uid => (await dc.executeGraphql(`query AiUsage($uid: String!) { aiUsageRecords(where: {userUid: {eq: $uid}}, orderBy: [{createdAt: DESC}]) { id status errorCode model inputTokens outputTokens cacheReadInputTokens toolCalls conversationId
  aiToolExecutions_on_usageRecord { toolName status resultCount } } }`, {variables: {uid}})).data.aiUsageRecords;
const counter = async uid => (await sdk.getAiUsageCounters(dc, {organizationId: f.orgA, periodKey: new Date().toISOString().slice(0, 7), userKey: `user:${uid}`})).data.user?.requestCount ?? 0;
const leaked = (text, values) => values.filter(value => text.includes(value));

let failure;
try {
  for (let attempt = 0; ; attempt++) {
    if (server.exitCode !== null) throw new Error("Next.js exited: " + serverLog);
    try { if ((await fetch(origin + "/api/auth/csrf", {signal: AbortSignal.timeout(5000)})).ok) break; } catch { /* compiling */ }
    if (attempt > 300) throw new Error("Next.js did not start: " + serverLog);
    await pause(500);
  }
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
    } else if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  });
  await command("Page.enable"); await command("Runtime.enable"); await command("Network.enable");


  // ------------------------------------------------------------ helpers
  const listingId = async reference => (await dc.executeGraphql(`query L($ref: String!) { propertyListings(where: {listingReference: {eq: $ref}}) { id } }`, {variables: {ref: reference}})).data.propertyListings[0].id;
  const contentUsageRows = async uid => (await dc.executeGraphql(`query U($uid: String!) { aiUsageRecords(where: {userUid: {eq: $uid}, feature: {eq: "CONTENT"}}, orderBy: [{createdAt: DESC}]) { status errorCode model inputTokens outputTokens contentType promptVersion } }`, {variables: {uid}})).data.aiUsageRecords;
  const contentUsage = async uid => (await usageRows(uid)).length;
  async function generateApi(body, organizationId = f.orgA, path = "/api/ai/content/generate") {
    const response = await api(path, {method: "POST", headers: {"X-EstateOS-Organization": organizationId}, body: JSON.stringify(body)});
    const events = typeof response.body === "string" ? response.body.split("\n").filter(Boolean).map(line => JSON.parse(line)) : [];
    return {...response, events, last: events.at(-1)};
  }
  const settings = JSON.stringify({schemaVersion: 1, selection: {propertyId: ids.marina1}, useLeadFirstName: false, length: "STANDARD"});
  const emptyValidation = JSON.stringify({schemaVersion: 1, generatedAt: new Date().toISOString(), factsReadAt: new Date().toISOString(), model: "seeded-fixture", sources: [], warnings: [],
    missingInformation: [], claimsToReview: [], editedAfterGeneration: false, factIndex: {numbers: ["2", "1250", "2150000"], contacts: [], supportedTerms: []}});
  async function seedDraft(actorUid, type, language, content, title) {
    const id = randomUUID();
    await sdk.createAiContentDraft(dc, {organizationId: f.orgA, id, actorUid, contentType: type, purpose: type === "EMAIL" ? "PROPERTY_RECOMMENDATION" : "LISTING_DESCRIPTION", title, language,
      tone: "PROFESSIONAL", audience: "BUYERS", sourcePropertyId: ids.marina1, sourceRefs: settings, contentData: JSON.stringify({schemaVersion: 1, content}), validation: emptyValidation,
      model: "seeded-fixture", generatedAt: new Date().toISOString()});
    return id;
  }
  const propertyContent = text => ({listingTitle: text, shortDescription: `${text} short`, detailedDescription: `${text} detail`, keyHighlights: ["2 bedrooms"], amenitiesSummary: "", locationDescription: "Dubai Marina", callToAction: ""});
  async function setField(selector, value) {
    await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('missing '+${JSON.stringify(selector)});
      const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  }
  const editorText = () => evaluate("document.querySelector('section[aria-label=Draft]')?.innerText ?? ''");
  const listingA2 = await listingId("E2E-L-MARINA-2");
  const base = {contentType: "PROPERTY_DESCRIPTION", purpose: "LISTING_DESCRIPTION", language: "EN", tone: "PROFESSIONAL", audience: "BUYERS"};

  // ------------------------------------------------------------ gates
  await load("/api/auth/csrf");
  for (const path of ["/api/ai/content/status", "/api/ai/content/drafts", "/api/ai/content/sources?kind=property", "/api/ai/content/brand", "/api/ai/content/templates"]) {
    assert.equal((await api(path)).status, 401, path);
  }
  assert.equal((await generateApi({...base, propertyId: ids.marina1})).status, 401);
  pass("Unauthenticated Content Studio reads and generation are rejected (401)");

  await signIn("owner-a");
  const status = await api("/api/ai/content/status");
  assert.equal(status.status, 200);
  assert.equal(status.body.data.enabled, true);
  assert.ok(!JSON.stringify(status.body).includes("sk-ant-"), "status never returns the key");
  assert.equal((await generateApi({...base, propertyId: ids.marina1, organizationId: f.orgB, role: "OWNER"})).status, 400);
  assert.equal((await generateApi({...base, propertyId: ids.marina1}, f.orgB)).status, 409);
  const foreign = await generateApi({...base, propertyId: ids.foreign});
  assert.equal(foreign.status, 404, JSON.stringify(foreign.body));
  assert.equal(foreign.body.error.code, "SOURCE_UNAVAILABLE");
  assert.equal((await generateApi({...base, propertyId: "not-a-uuid"})).status, 400);
  assert.equal((await generateApi(base)).status, 400, "a property description needs a property or listing");
  assert.equal((await api(`/api/ai/content/sources?kind=property&id=${ids.foreign}`)).status, 404);
  assert.equal(await contentUsage("owner-a"), 0, "rejected requests never reach Claude or record usage");
  pass("Injected organization/role fields, a foreign company header, another company's property, malformed IDs and missing sources are rejected before Claude is called");

  await signIn("agent-a");
  const unassigned = await generateApi({...base, propertyId: ids.marina2});
  assert.equal(unassigned.status, 404, "an agent cannot generate from an unassigned property");
  assert.equal(unassigned.body.error.code, "SOURCE_UNAVAILABLE");
  const sources = await api("/api/ai/content/sources?kind=property");
  assert.deepEqual(sources.body.data.options.map(option => option.label), ["E2E-MARINA-1"], "the picker lists only assigned inventory");
  pass("An agent's picker shows only assigned inventory, and an unassigned property is refused server-side (404 SOURCE_UNAVAILABLE)");

  // Contextual button: opens the studio with the record pre-selected and generates nothing.
  const before = await contentUsage("agent-a");
  await load(`/properties/${ids.marina1}`, "[...document.querySelectorAll('a')].some(a => a.textContent.includes('Generate AI Description'))");
  await clickText("Generate AI Description", "a");
  await waitFor("location.pathname === '/ai-content' && document.querySelector('ul[aria-label=\"Selected properties\"]')?.innerText.includes('E2E-MARINA-1')", "the pre-selected property");
  await screenshot("content-studio-preselected");
  await pause(1500);
  assert.equal(await contentUsage("agent-a"), before, "opening the studio does not generate");
  pass("Property page 'Generate AI Description' opens /ai-content with the permitted property pre-selected and does not generate automatically");

  // Allowance, enforced before any provider call.
  const period = new Date().toISOString().slice(0, 7);
  for (let index = 0; index < MONTHLY_USER_LIMIT; index++) await sdk.reserveAiRequest(dc, {organizationId: f.orgA, periodKey: period, subjectKey: "user:admin-a", limit: MONTHLY_USER_LIMIT});
  await signIn("admin-a");
  const quota = await generateApi({...base, propertyId: ids.marina1});
  assert.equal(quota.status, 429, JSON.stringify(quota.body));
  assert.equal(quota.body.error.code, "AI_QUOTA_EXCEEDED");
  assert.equal(await contentUsage("admin-a"), 0);
  pass("Content generation shares the monthly AI allowance: an exhausted allowance returns 429 before calling Claude");

  if (!live) {
    await signIn("agent-a");
    const failed = await generateApi({...base, propertyId: ids.marina1});
    assert.equal(failed.status, 200);
    assert.equal(failed.last?.type, "error", JSON.stringify(failed.events));
    assert.equal(failed.last.code, "AI_PROVIDER_AUTH");
    assert.ok(!JSON.stringify(failed.events).includes("sk-ant-"));
    const usage = await contentUsageRows("agent-a");
    assert.equal(usage[0].status, "FAILED");
    assert.equal(usage[0].contentType, "PROPERTY_DESCRIPTION");
    assert.equal(usage[0].promptVersion, "6b.1");
    assert.equal(await counter("agent-a"), 0, "the reservation is returned when Claude never answered");
    assert.equal((await api("/api/ai/content/drafts")).body.data.total, 0, "nothing is saved when generation fails");
    pass("A rejected Anthropic key streams AI_PROVIDER_AUTH, saves no draft, records a FAILED CONTENT usage row and returns the allowance");

    await load(`/ai-content?type=PROPERTY_DESCRIPTION&propertyId=${ids.marina1}`, "document.querySelector('ul[aria-label=\"Selected properties\"]') !== null && [...document.querySelectorAll('button')].some(b => b.textContent.includes('Generate draft') && !b.disabled)");
    await clickText("Generate draft", "button");
    await waitFor("document.querySelector('section[aria-label=Draft] [role=alert]')?.innerText.includes('rejected EstateOS')", "the configuration error in the studio");
    await screenshot("content-invalid-key");
    pass("The studio shows the configuration problem instead of a fake draft");
  }

  // ------------------------------------------------------------ draft editing and persistence (seeded drafts; no Claude needed)
  await signIn("agent-a");
  const seeded = await seedDraft("agent-a", "PROPERTY_DESCRIPTION", "EN", {en: propertyContent("Seeded Marina listing")}, "Seeded Marina draft");
  await load(`/ai-content?draft=${seeded}`, "document.getElementById('draft-title')?.value === 'Seeded Marina draft'");
  await clickText("Edit", "button");
  await waitFor("document.getElementById('content-en-detailedDescription') !== null", "the field editor");
  await setField("#content-en-detailedDescription", "Edited by the agent: 2 bedrooms, 1,250 sq ft.");
  await setField("#draft-title", "Edited Marina draft");
  await clickText("Save", "button");
  await waitFor("document.body.innerText.includes('Version 2') && !document.body.innerText.includes('Unsaved changes')", "the saved edit");
  await load(`/ai-content?draft=${seeded}`, "document.getElementById('draft-title')?.value === 'Edited Marina draft'");
  assert.ok((await editorText()).includes("Edited by the agent: 2 bedrooms, 1,250 sq ft."), "the edit survives a reload");
  await screenshot("content-draft-after-reload");
  pass("An agent edits a draft, saves it, reloads the page and gets the saved draft back from SQL Connect");

  const versions = await api(`/api/ai/content/drafts/${seeded}`);
  assert.deepEqual(versions.body.data.versions.map(item => [item.versionNumber, item.kind]), [[2, "EDITED"], [1, "GENERATED"]]);
  assert.equal(versions.body.data.draft.validation.editedAfterGeneration, true);
  assert.equal(versions.body.data.draft.validation.factIndex, undefined, "the internal fact index is not sent to the browser");
  await evaluate(`(()=>{const rows=[...document.querySelectorAll('section[aria-labelledby=draft-versions] li')];const row=rows.find(r=>r.innerText.includes('Version 1'));[...row.querySelectorAll('button')].find(b=>b.textContent.includes('Use this version')).click();})()`);
  await waitFor("document.body.innerText.includes('Version 3')", "the restored version");
  assert.ok((await editorText()).includes("Seeded Marina listing detail"));
  const stale = await api(`/api/ai/content/drafts/${seeded}`, {method: "PATCH", headers: {"X-EstateOS-Organization": f.orgA}, body: JSON.stringify({expectedRevision: 1, title: "Stale", content: {en: propertyContent("Stale")}})});
  assert.equal(stale.status, 409, "a stale revision cannot overwrite newer content");
  const forged = await api(`/api/ai/content/drafts/${seeded}`, {method: "PATCH", headers: {"X-EstateOS-Organization": f.orgA}, body: JSON.stringify({expectedRevision: 3, title: "x", content: {en: {...propertyContent("x"), html: "<script>alert(1)</script>"}}})});
  assert.equal(forged.status, 400, "content with unknown fields is rejected");
  pass("Version history records the edit, 'Use this version' restores version 1, and stale or malformed saves are rejected");

  await clickText("Submit for review", "button");
  await waitFor("document.querySelector('section[aria-label=Draft]')?.innerText.includes('In review')", "the review status");
  assert.ok(!(await evaluate("[...document.querySelectorAll('button')].some(b => b.textContent.includes('Approve internally'))")), "agents see no approve action");
  const agentApprove = await api(`/api/ai/content/drafts/${seeded}/status`, {method: "POST", headers: {"X-EstateOS-Organization": f.orgA}, body: JSON.stringify({expectedRevision: 4, status: "APPROVED"})});
  assert.equal(agentApprove.status, 403);
  await signIn("admin-a");
  const companyDrafts = await api("/api/ai/content/drafts?scope=COMPANY");
  assert.ok(companyDrafts.body.data.drafts.some(item => item.id === seeded));
  assert.equal((await api("/api/ai/content/drafts")).body.data.drafts.some(item => item.id === seeded), false, "the default view lists the administrator's own drafts");
  const approved = await api(`/api/ai/content/drafts/${seeded}/status`, {method: "POST", headers: {"X-EstateOS-Organization": f.orgA}, body: JSON.stringify({expectedRevision: 4, status: "APPROVED"})});
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(approved.body.data.draft.status, "APPROVED");
  await signIn("owner-b");
  assert.equal((await api(`/api/ai/content/drafts/${seeded}`)).status, 404);
  assert.notEqual((await api(`/api/ai/content/drafts/${seeded}`, {method: "DELETE", headers: {"X-EstateOS-Organization": f.orgB}})).status, 200);
  pass("Agents submit for review but cannot approve (403); an administrator sees company drafts and approves; another company gets 404");

  // Arabic and bilingual drafts render right-to-left.
  await signIn("owner-a");
  const bilingual = await seedDraft("owner-a", "EMAIL", "EN_AR", {
    en: {subject: "Dubai Marina apartment", previewText: "2 bedrooms", body: "A 2 bedroom apartment in Dubai Marina.", callToAction: "Reply to arrange a viewing"},
    ar: {subject: "شقة في دبي مارينا", previewText: "غرفتا نوم", body: "شقة من غرفتي نوم في دبي مارينا.", callToAction: "رد لترتيب معاينة"},
  }, "Bilingual email");
  await load(`/ai-content?draft=${bilingual}`, "document.getElementById('draft-title')?.value === 'Bilingual email'");
  await clickText("العربية", "button");
  await waitFor("[...document.querySelectorAll('[dir=rtl][lang=ar]')].some(e => e.innerText.includes('شقة في دبي مارينا'))", "the Arabic preview");
  await screenshot("content-arabic-preview");
  pass("Bilingual drafts switch to an Arabic preview rendered right-to-left (dir=rtl, lang=ar)");

  // Brand settings and templates.
  await signIn("agent-a");
  assert.equal((await api("/api/ai/content/brand", {method: "PUT", headers: {"X-EstateOS-Organization": f.orgA}, body: JSON.stringify({expectedRevision: 0, preferredLanguage: "EN", useCompanyPhone: true, useCompanyEmail: true})})).status, 403);
  assert.equal((await api("/api/ai/content/templates", {method: "POST", headers: {"X-EstateOS-Organization": f.orgA}, body: JSON.stringify({name: "Agent template", contentType: "EMAIL", instructions: "x"})})).status, 403);
  await signIn("owner-a");
  const brand = await api("/api/ai/content/brand", {method: "PUT", headers: {"X-EstateOS-Organization": f.orgA}, body: JSON.stringify({expectedRevision: 0, preferredLanguage: "EN", useCompanyPhone: false, useCompanyEmail: false, tagline: "E2E tagline", whatsappNumber: "+971 50 123 4567"})});
  assert.equal(brand.status, 200, JSON.stringify(brand.body));
  const template = await api("/api/ai/content/templates", {method: "POST", headers: {"X-EstateOS-Organization": f.orgA}, body: JSON.stringify({name: "E2E property style", contentType: "PROPERTY_DESCRIPTION", instructions: "Short paragraphs."})});
  assert.equal(template.status, 201, JSON.stringify(template.body));
  await load("/settings/ai-content", "document.body.innerText.includes('E2E property style') && document.getElementById('brand-tagline')?.value === 'E2E tagline'");
  await screenshot("content-settings");
  pass("Only owners and administrators change brand settings and templates (agents get 403); the settings page shows them");

  if (live) {
    // ---------------------------------------------------------- live Claude: the acceptance flow
    await signIn("agent-a");
    await load(`/properties/${ids.marina1}`, "[...document.querySelectorAll('a')].some(a => a.textContent.includes('Generate AI Description'))");
    await clickText("Generate AI Description", "a");
    await waitFor("document.querySelector('ul[aria-label=\"Selected properties\"]')?.innerText.includes('E2E-MARINA-1') && [...document.querySelectorAll('button')].some(b => b.textContent.includes('Generate draft') && !b.disabled)", "the pre-selected property");
    await clickText("Generate draft", "button");
    await waitFor("document.body.innerText.includes('Generating draft')", "generation progress", 100);
    await screenshot("content-live-progress");
    await waitFor("document.getElementById('draft-title') !== null || document.querySelector('section[aria-label=Draft] > [role=alert]') !== null", "Claude's draft", 1200);
    assert.ok(!(await evaluate("document.querySelector('section[aria-label=Draft] > [role=alert]') !== null")), await editorText());
    const draftId = new URL(await evaluate("location.href")).searchParams.get("draft");
    const generated = (await api(`/api/ai/content/drafts/${draftId}`)).body.data;
    const text = JSON.stringify(generated.draft.contentData);
    await screenshot("content-live-draft");
    assert.ok(text.includes("Dubai Marina"), text);
    assert.deepEqual(leaked(text, [secrets.foreignRef, secrets.hiddenAddress, secrets.hiddenLatitude, "ChIJ_e2e_hidden", "E2E-INTERNAL-NOTE", "E2E-MARINA-2"]), [], text);
    const usage = (await contentUsageRows("agent-a"))[0];
    assert.equal(usage.status, "SUCCEEDED");
    assert.ok(usage.inputTokens > 0 && usage.outputTokens > 0);
    console.log(`  Live draft (${generated.draft.validation.warnings.length} automatic warnings): ${text.slice(0, 600)}`);
    pass(`AGENT clicks Generate AI Description; Claude (${usage.model}) writes a draft from the assigned property only (${usage.inputTokens} in / ${usage.outputTokens} out tokens)`);

    await clickText("Edit", "button");
    await waitFor("document.getElementById('content-en-shortDescription') !== null", "the field editor");
    await setField("#content-en-shortDescription", "Agent-reviewed: a 2 bedroom apartment in Dubai Marina.");
    await clickText("Save", "button");
    await waitFor("document.body.innerText.includes('Version 2') && !document.body.innerText.includes('Unsaved changes')", "the saved edit");
    await load(`/ai-content?draft=${draftId}`, "document.getElementById('draft-title') !== null");
    assert.ok((await editorText()).includes("Agent-reviewed: a 2 bedroom apartment in Dubai Marina."));
    pass("Acceptance: the Claude draft is edited, saved, the app is reloaded and the saved draft is retrieved");

    const alternative = await generateApi({mode: "ALTERNATIVE", expectedRevision: 2}, f.orgA, `/api/ai/content/drafts/${draftId}/generate`);
    assert.equal(alternative.last?.type, "done", JSON.stringify(alternative.events));
    const afterAlternative = (await api(`/api/ai/content/drafts/${draftId}`)).body.data;
    assert.equal(afterAlternative.versions[0].kind, "ALTERNATIVE");
    assert.ok(JSON.stringify(afterAlternative.draft.contentData).includes("Agent-reviewed"), "an alternative does not replace the current text");
    pass("An alternative version is generated into the history without replacing the current text");

    await signIn("owner-a");
    const arabic = await generateApi({contentType: "EMAIL", purpose: "PROPERTY_RECOMMENDATION", language: "EN_AR", tone: "PROFESSIONAL", audience: "BUYERS", listingId: listingA2});
    assert.equal(arabic.last?.type, "done", JSON.stringify(arabic.events));
    const email = (await api(`/api/ai/content/drafts/${arabic.last.draftId}`)).body.data.draft;
    assert.match(email.contentData.content.ar.body, /[؀-ۿ]/, "the Arabic version is in Arabic");
    assert.ok(email.contentData.content.en.subject.length > 0);
    assert.deepEqual(leaked(JSON.stringify(email.contentData), [secrets.hiddenAddress, secrets.hiddenLatitude, "ChIJ_e2e_hidden", "E2E-INTERNAL-NOTE", secrets.foreignRef]), []);
    console.log(`  Live bilingual email subject: ${email.contentData.content.en.subject} / ${email.contentData.content.ar.subject}`);
    pass(`OWNER generates an English + Arabic email from a HIDDEN-location listing with no address, coordinate or internal-note leak (${email.validation.warnings.length} automatic warnings)`);
  }

  assert.deepEqual(exceptions.filter(message => !/ResizeObserver/.test(message)), [], "no uncaught browser exceptions");
  console.log(`\n${checks} AI Content Studio end-to-end checks passed (${live ? "live Claude" : "invalid-key mode"}). Screenshots: ${screens}`);
} catch (error) {
  failure = error;
} finally {
  try { socket?.close(); } catch { /* closed */ }
  stop(browser); stop(server);
  await deleteApp(authApp).catch(() => {}); await deleteApp(sqlApp).catch(() => {});
}
if (failure) { console.error(failure); process.exit(1); }
process.exit(0);
