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
import * as sdk from "@dataconnect/admin-generated";
import { localDataConnect } from "../scripts/sql-connect-local.mjs";
import { fixture as f } from "./fixtures/sql-connect-fixtures.mjs";

// Phase 6D landing page builder. Run through `npm run test:websites:e2e` (AI_E2E_LIVE=1 adds one real Claude generation).
// Everything here is synthetic, local-only data on isolated emulators; nothing is published outside them.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = process.env.ESTATEOS_E2E_WORKSPACE;
const executable = process.env.ESTATEOS_TEST_BROWSER;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const live = process.env.AI_E2E_LIVE === "1";
if (!workspace || !executable || !authHost?.startsWith("127.0.0.1:") || process.env.GCLOUD_PROJECT !== "demo-estateos-test") {
  throw new Error("Run npm run test:websites:e2e; this script needs the isolated emulators it starts.");
}
writeFileSync(join(workspace, "tests-started"), new Date().toISOString());
const screens = join(workspace, "screens");
mkdirSync(screens, {recursive: true});
const pause = ms => new Promise(done => setTimeout(done, ms));
const password = "e2e-only-" + randomUUID();
let checks = 0;
const pass = message => { checks++; console.log(`✔ ${message}`); };
const BUCKET = "demo-estateos-test.appspot.com";
const daysFromNow = days => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------- fixtures
const {app: sqlApp, dc} = localDataConnect();
const seed = readFileSync(join(root, "dataconnect", "seed_data.gql"), "utf8");
if (process.env.DATA_CONNECT_EMULATOR_HOST !== "127.0.0.1:19999") throw new Error("Refusing to reset an unexpected SQL Connect emulator.");
await dc.executeGraphql(seed, {operationName: "ResetEstateOSWebsites"});
await dc.executeGraphql(seed, {operationName: "ResetEstateOS"});
await dc.executeGraphql(seed, {operationName: "SeedEstateOS"});
const ids = {developer: randomUUID(), project: randomUUID(), projectB: randomUUID(), developerB: randomUUID(), unit: randomUUID(), hiddenUnit: randomUUID(), listing: randomUUID(), plan: randomUUID(), media: randomUUID()};
const secrets = {exactLatitude: "25.080512", exactLongitude: "55.140231", hiddenAddress: "E2E HIDDEN STREET 9", note: "E2E-INTERNAL-NOTE", foreign: "E2E-B-SECRET-TOWER", unitNumber: "E2E-UNIT-4401"};
const storagePath = `organizations/${f.orgA}/inventory/projects/${ids.project}/${ids.media}.png`;
await dc.executeGraphql(`mutation Fixtures($org: UUID!, $orgB: UUID!, $dev: UUID!, $devB: UUID!, $project: UUID!, $projectB: UUID!, $launch: Date!, $permitExpiry: Date!) {
  organization_update(id: $org, data: {contactPhone: "+971 4 555 0100", companyEmail: "info@agency-a.example"})
  aiBrandProfile_insert(data: {organizationId: $org, useCompanyPhone: true, useCompanyEmail: true, whatsappNumber: "+971 50 555 0101", tagline: "E2E homes", marketingDisclaimer: "E2E disclaimer: information is subject to change.", updatedByUid: "owner-a"})
  developer_insert(data: {organizationId: $org, id: $dev, name: "E2E Developer", slug: "e2e-developer", createdByUid: "owner-a", updatedByUid: "owner-a"})
  project_insert(data: {organizationId: $org, id: $project, developerId: $dev, projectName: "E2E Marina Towers", projectCode: "E2E-MT", projectType: RESIDENTIAL, projectStatus: ACTIVE,
    constructionStatus: UNDER_CONSTRUCTION, emirate: DUBAI, city: "Dubai", community: "Dubai Marina", area: "Marina Walk", address: "E2E Project Street 1",
    latitude: 25.080512, longitude: 55.140231, mapDisplayMode: APPROXIMATE, startingPriceMinor: "125000000", currency: "AED", totalUnits: 120, launchDate: $launch,
    expectedHandoverDate: "2029-06-30", permitNumber: "PRJ-E2E-1", permitExpiryDate: $permitExpiry, permitReferenceUrl: "https://verify.example/PRJ-E2E-1",
    marketingDescription: "A synthetic waterfront tower for end-to-end tests.", createdByUid: "owner-a", updatedByUid: "owner-a"})
  developerB: developer_insert(data: {organizationId: $orgB, id: $devB, name: "E2E B Developer", slug: "e2e-b-developer", createdByUid: "owner-b", updatedByUid: "owner-b"})
  projectB: project_insert(data: {organizationId: $orgB, id: $projectB, developerId: $devB, projectName: "${secrets.foreign}", projectCode: "E2E-B", projectType: RESIDENTIAL, projectStatus: ACTIVE, createdByUid: "owner-b", updatedByUid: "owner-b"})
}`, {variables: {org: f.orgA, orgB: f.orgB, dev: ids.developer, devB: ids.developerB, project: ids.project, projectB: ids.projectB, launch: daysFromNow(90), permitExpiry: daysFromNow(365)}});
await dc.executeGraphql(`mutation Units($org: UUID!, $project: UUID!, $unit: UUID!, $hidden: UUID!, $agent: UUID!, $listing: UUID!, $plan: UUID!, $media: UUID!, $path: String!, $expiry: Date!) {
  unit: property_insert(data: {organizationId: $org, id: $unit, propertyReference: "E2E-REF-1", projectId: $project, unitNumber: "${secrets.unitNumber}", propertyType: APARTMENT, marketType: OFF_PLAN,
    bedrooms: 1, bathrooms: 1, builtUpArea: 780, areaUnit: SQFT, emirate: DUBAI, community: "Dubai Marina", referencePriceMinor: "125000000", inventoryStatus: AVAILABLE, mapDisplayMode: APPROXIMATE,
    assignedMembershipId: $agent, createdByUid: "owner-a", updatedByUid: "owner-a"})
  hidden: property_insert(data: {organizationId: $org, id: $hidden, propertyReference: "E2E-REF-2", projectId: $project, propertyType: APARTMENT, marketType: OFF_PLAN, bedrooms: 2, referencePriceMinor: "210000000",
    inventoryStatus: AVAILABLE, address: "${secrets.hiddenAddress}", latitude: 25.093456, longitude: 55.151234, mapDisplayMode: HIDDEN, internalNotes: "${secrets.note}", createdByUid: "owner-a", updatedByUid: "owner-a"})
  propertyListing_insert(data: {organizationId: $org, id: $listing, propertyId: $unit, listingReference: "E2E-L-1", listingPurpose: SALE, marketType: OFF_PLAN, title: "E2E One Bedroom",
    askingPriceMinor: "130000000", currency: "AED", listingStatus: ACTIVE, publicationStatus: PUBLISHED, advertisingPermitNumber: "7112345678", permitExpiryDate: $expiry, createdByUid: "owner-a", updatedByUid: "owner-a"})
  paymentPlan_insert(data: {organizationId: $org, id: $plan, projectId: $project, name: "E2E 20/40/40", bookingPercentageBps: 2000, handoverPercentageBps: 4000, installmentTotalBps: 4000, isActive: true, createdByUid: "owner-a", updatedByUid: "owner-a"})
  paymentPlanInstallment_insert(data: {organizationId: $org, paymentPlanId: $plan, position: 1, percentageBps: 4000, dueTrigger: CONSTRUCTION_MILESTONE, constructionMilestonePercent: 50})
  inventoryMedia_insert(data: {organizationId: $org, id: $media, projectId: $project, storagePath: $path, fileName: "e2e-cover.png", contentType: "image/png", byteSize: "1000", mediaKind: PROPERTY_PHOTO,
    isCover: true, status: ACTIVE, uploadedByUid: "owner-a"})
}`, {variables: {org: f.orgA, project: ids.project, unit: ids.unit, hidden: ids.hiddenUnit, agent: f.memberAgentA, listing: ids.listing, plan: ids.plan, media: ids.media, path: storagePath, expiry: daysFromNow(200)}});
const authApp = initializeApp({projectId: "demo-estateos-test", storageBucket: BUCKET}, "websites-e2e-auth");
const photo = readFileSync(join(root, "public", "demo-assets", "demo-dunewell-properties", "demo-prj-05", "demo-p-013", "photo-1.png"));
await getStorage(authApp).bucket(BUCKET).file(storagePath).save(photo, {contentType: "image/png"});
const as = uid => ({impersonate: {authClaims: {sub: uid, email: `${uid}@example.test`, email_verified: true, firebase: {sign_in_provider: "password"}}}});
const form = (await sdk.createLeadCaptureForm(dc, {
  organizationId: f.orgA, publicId: randomBytes(32).toString("base64url"), name: "E2E landing enquiries", status: sdk.LeadCaptureFormStatus.ACTIVE, sourceName: "Website - E2E landing",
  branchId: null, projectId: null, consentText: "I agree that E2E Agency may contact me about this property.", privacyPolicyUrl: "https://agency-a.example/privacy",
  successMessage: "Thank you. E2E enquiry received.",
  fields: [{key: "FULL_NAME", label: "Full name", enabled: true, required: true}, {key: "EMAIL", label: "Email", enabled: true, required: false},
    {key: "PHONE", label: "Phone", enabled: true, required: false}, {key: "MESSAGE", label: "Message", enabled: true, required: false}],
}, as("owner-a"))).data.form.id;
for (const uid of ["owner-a", "admin-a", "agent-a", "manager-a", "owner-b"]) {
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
function startNext() {
  const child = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env, NEXT_TELEMETRY_DISABLED: "1", NODE_ENV: "test", __NEXT_PROCESSED_ENV: "true",
      ESTATEOS_NEXT_DIST_DIR: ".tmp/ai-e2e/next", ESTATEOS_TSCONFIG_PATH: ".tmp/ai-e2e/tsconfig.json",
      APP_ORIGIN: origin, FIREBASE_PROJECT_ID: "demo-estateos-test", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-estateos-test",
      NEXT_PUBLIC_FIREBASE_API_KEY: "demo-key", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "127.0.0.1", NEXT_PUBLIC_FIREBASE_APP_ID: "demo-app",
      RATE_LIMIT_BACKEND: "sql-connect", FIREBASE_STORAGE_BUCKET: BUCKET, ESTATEOS_AI_ENABLED: "true",
      // Default mode: well-formed but invalid, so Anthropic itself rejects it.
      ANTHROPIC_API_KEY: live ? process.env.AI_E2E_ANTHROPIC_API_KEY : `sk-ant-api03-e2e-invalid-${"x".repeat(40)}`,
      ANTHROPIC_MODEL: live ? process.env.AI_E2E_ANTHROPIC_MODEL : "claude-sonnet-5-5",
      AI_MONTHLY_REQUESTS_PER_USER: "20", AI_REQUESTS_PER_MINUTE_PER_MEMBER: "6", AI_E2E_ANTHROPIC_API_KEY: "",
    },
  });
  child.stdout.on("data", data => { serverLog = (serverLog + data).slice(-30000); });
  child.stderr.on("data", data => { serverLog = (serverLog + data).slice(-30000); });
  return child;
}
let server = startNext();
function stop(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") { try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {stdio: "ignore", windowsHide: true}); } catch { /* stopped */ } }
  else child.kill("SIGTERM");
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
let socket, sequence = 0;
const requests = new Map();
const exceptions = [];
const consoleErrors = [];
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
  throw new Error(`Timed out waiting for ${description}: ${text.slice(0, 1500)}\n--- browser errors ---\n${[...exceptions, ...consoleErrors].slice(-6).join("\n").slice(0, 3000)}\n--- server ---\n${serverLog.slice(-3000)}`);
}
async function load(path, ready, viewport = {width: 1440, height: 1000, mobile: false}) {
  await command("Emulation.setDeviceMetricsOverride", {width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile});
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
async function clickLabel(label) {
  await evaluate(`(()=>{const e=document.querySelector('[aria-label=${JSON.stringify(label)}]');if(!e||e.disabled)throw Error('Missing control: '+${JSON.stringify(label)});e.click();})()`);
}
async function api(path, init = {}) {
  return evaluate(`(async()=>{const init=${JSON.stringify(init)};
    if(init.method&&init.method!=='GET'&&!init.public){const c=await (await fetch('/api/auth/csrf')).json();init.headers={'Content-Type':'application/json',...(init.headers||{}),'X-CSRF-Token':c.csrfToken};}
    const r=await fetch(${JSON.stringify(path)},init);let body=null;const text=await r.text();try{body=JSON.parse(text)}catch{body=text}
    return {status:r.status,contentType:r.headers.get('content-type'),cache:r.headers.get('cache-control'),body};})()`, 240000);
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
const counter = async uid => (await sdk.getAiUsageCounters(dc, {organizationId: f.orgA, periodKey: new Date().toISOString().slice(0, 7), userKey: `user:${uid}`})).data.user?.requestCount ?? 0;
const leaked = (text, values) => values.filter(value => text.includes(value));

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
    } else if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") consoleErrors.push(message.params.args.map(arg => arg.value ?? arg.description ?? "").join(" ").slice(0, 600));
  });
  await command("Page.enable"); await command("Runtime.enable"); await command("Network.enable"); await command("Emulation.setFocusEmulationEnabled", {enabled: true});

  const post = (path, body = {}, organizationId = f.orgA, method = "POST") => api(path, {method, headers: {"X-EstateOS-Organization": organizationId}, body: JSON.stringify(body)});
  const payload = async pageId => { const result = await api(`/api/websites/pages/${pageId}`); assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body.data; };
  const pageRows = async () => (await dc.executeGraphql(`query P($org: UUID!) { websitePages(where: {organizationId: {eq: $org}}) { id title versionCount revision status } }`, {variables: {org: f.orgA}})).data.websitePages;
  const usage = async uid => (await dc.executeGraphql(`query U($uid: String!) { aiUsageRecords(where: {userUid: {eq: $uid}, feature: {eq: "PAGES"}}, orderBy: [{createdAt: DESC}]) { status errorCode model inputTokens outputTokens promptVersion } }`, {variables: {uid}})).data.aiUsageRecords;

  // ------------------------------------------------------------ gates
  await load("/api/auth/csrf");
  assert.equal((await api("/api/websites")).status, 401);
  assert.ok([401, 403].includes((await post("/api/websites/pages", {mode: "BLANK", title: "x"})).status));
  pass("Unauthenticated website reads and page creation are rejected");

  // ------------------------------------------------------------ OWNER: create, edit, preview
  await signIn("owner-a");
  await load("/websites", "document.body.innerText.includes('No landing pages yet')");
  await screenshot("01-websites-empty");
  const overview = (await api("/api/websites")).body.data;
  const websiteId = overview.website.id;
  assert.equal(overview.organization.slug, "local-agency-a");
  await load("/websites/new", "document.body.innerText.includes('Describe it to Claude') && document.body.innerText.includes('Start from a template')");
  pass("OWNER opens Websites and the new-page wizard (Claude, template, blank, duplicate)");

  assert.equal((await post("/api/websites/pages", {mode: "BLANK", title: "Injected", organizationId: f.orgB, role: "OWNER"})).status, 400);
  assert.equal((await post("/api/websites/pages", {mode: "BLANK", title: "Wrong company"}, f.orgB)).status, 409);
  assert.equal((await post("/api/websites/pages", {mode: "TEMPLATE", templateKey: "OFF_PLAN_LAUNCH", title: "Other company project", projectId: ids.projectB})).status, 404, "another company's project is not a usable source");
  const created = await post("/api/websites/pages", {mode: "TEMPLATE", templateKey: "OFF_PLAN_LAUNCH", title: "E2E Marina Launch", slug: "e2e-marina-launch", projectId: ids.project});
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const pageId = created.body.data.id;
  pass("Organization and role fields, a foreign company header and another company's project are rejected; a template page is created from an authorized project");

  const editorPath = `/websites/${websiteId}/pages/${pageId}/edit`;
  await load(editorPath, "document.querySelector('[data-preview-device]')?.innerText.includes('Waterfront living')");
  const heroPhoto = "(()=>{const i=document.querySelector('[data-preview-device] [data-section-type=\"HERO\"] img');return i?JSON.stringify({src:i.getAttribute('src'),complete:i.complete,width:i.naturalWidth,rect:i.getBoundingClientRect().height,opacity:getComputedStyle(i).opacity}):'none';})()";
  try { await waitFor(`(()=>{const i=document.querySelector('[data-preview-device] [data-section-type="HERO"] img');return i&&i.complete&&i.naturalWidth>0&&i.getBoundingClientRect().height>200;})()`, "the CRM cover photo in the editor hero", 75); }
  catch { assert.fail(`the editor hero photo did not load: ${await evaluate(heroPhoto)}`); }
  await screenshot("02a-editor-initial");
  const previewText = await evaluate("document.querySelector('[data-preview-device]').innerText");
  for (const expected of ["AED 1,250,000", "E2E 20/40/40", "During construction", "Internal preview", "PRJ-E2E-1", "E2E disclaimer", "illustrative stock media"]) assert.ok(previewText.includes(expected), `preview shows ${expected}`);
  assert.ok(await evaluate("document.querySelectorAll('[data-preview-device] img[src*=\"images.unsplash.com\"]').length >= 2"), "stock photography is used where the project has no photos");
  assert.ok(await evaluate("document.querySelectorAll('[data-preview-device] video[src*=\"videos.pexels.com\"]').length >= 1"), "a stock video is used");
  assert.deepEqual(leaked(previewText, [secrets.hiddenAddress, secrets.note, secrets.unitNumber, secrets.foreign]), []);
  await screenshot("02-editor");
  await clickText("Navigator", "[role=tab]");
  await clickText("Payment plans", "aside[aria-label='Editor panel'] li button");
  await waitFor("document.body.innerText.includes('From CRM: Active payment plans')", "linked-data label");
  await clickLabel("Back to elements");
  // Elementor-style inline editing: type straight into the headline on the canvas.
  await evaluate(`(()=>{const e=document.querySelector('[data-section-type="HERO"] [data-edit-path="headline"]');e.scrollIntoView({block:'center'});e.focus();const r=document.createRange();r.selectNodeContents(e);const s=getSelection();s.removeAllRanges();s.addRange(r);})()`);
  await command("Input.insertText", {text: "E2E Waterfront Launch"});
  await command("Input.dispatchKeyEvent", {type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13});
  await command("Input.dispatchKeyEvent", {type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13});
  await waitFor("document.body.innerText.includes('Unsaved changes') && document.querySelector('[data-preview-device]').innerText.includes('E2E Waterfront Launch')", "the inline edit is in the draft");
  // Element panel: style the headline on its own (colour, size, alignment), then move it with Alt+arrow keys.
  const setField = (selector, value) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing field: '+${JSON.stringify(selector)});const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await evaluate(`document.querySelector('[data-section-type="HERO"] [data-move-key="headline"]').click()`);
  await waitFor("document.querySelector('[data-testid=element-panel-title]')?.textContent === 'Headline'", "the headline's own style panel");
  await setField("aside input[placeholder='Theme colour']", "#b03a0b");
  await setField("aside input[type=range]", "64");
  await clickText("Centre", "aside [role=radio]");
  const headlineLook = `(()=>{const e=document.querySelector('[data-section-type="HERO"] [data-move-key="headline"]');const c=getComputedStyle(e);return c.color==='rgb(176, 58, 11)'&&c.textAlign==='center'&&c.fontSize==='64px';})()`;
  await waitFor(headlineLook, "the headline's colour, size and alignment change on the canvas only");
  assert.ok(await evaluate(`getComputedStyle(document.querySelector('[data-section-type="HERO"] [data-move-key="subheadline"]')).color !== 'rgb(176, 58, 11)'`), "the rest of the section keeps its style");
  await screenshot("02b-editor-element-style");
  await clickText("position", "aside [role=tab]");
  await waitFor("document.body.innerText.includes('Move \"Headline\"')", "element position controls");
  for (let press = 0; press < 2; press++) {
    await command("Input.dispatchKeyEvent", {type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39, modifiers: 1});
    await command("Input.dispatchKeyEvent", {type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39, modifiers: 1});
  }
  await waitFor(`document.querySelector('[data-section-type="HERO"] [data-move-key="headline"]').style.left === "8px"`, "Alt+arrow moves the headline on the canvas");
  // Back to the section: centre the hero content and set custom padding in its Advanced tab.
  await clickLabel("Back to Hero");
  await clickText("advanced", "aside [role=tab]");
  await clickText("Middle", "[role=radio]");
  await evaluate(`(()=>{const e=document.querySelector('[aria-label="Padding (desktop) top"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'120');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor(`getComputedStyle(document.querySelector('[data-section-type="HERO"]')).getPropertyValue('--pg-pt-d').trim() === "120px"`, "custom padding is applied on the canvas");
  await screenshot("02c-editor-advanced");
  await clickLabel("Move Key facts down");
  await clickText("Save", "button");
  await waitFor("document.body.innerText.includes('Saved · version 2')", "saved version 2");
  let stored = await payload(pageId);
  assert.equal(stored.data.sections[2].type, "PROJECT_OVERVIEW", "the reorder was saved");
  assert.equal(stored.data.sections[3].type, "STATS");
  assert.equal(stored.data.sections.find(section => section.type === "HERO").props.headline, "E2E Waterfront Launch");
  const storedHero = stored.data.sections.find(section => section.type === "HERO");
  assert.deepEqual(storedHero.style.elementOffsets, {headline: {x: 8, y: 0}}, "the moved headline was saved");
  assert.deepEqual([storedHero.style.elementStyles.headline.color, storedHero.style.elementStyles.headline.size, storedHero.style.elementStyles.headline.align], ["#b03a0b", 64, "CENTER"], "the headline's own style was saved");
  assert.deepEqual(Object.keys(storedHero.style.elementStyles), ["headline"], "only the styled element is stored");
  assert.equal(storedHero.style.contentVertical, "CENTER");
  assert.equal(storedHero.style.padding.desktop.top, 120);
  pass("Editor shows linked CRM data (labelled From CRM), stock photos and video, edits the headline inline, styles it on its own (colour, size, alignment) and moves it, sets padding and content position in the Advanced tab, reorders from the section toolbar and saves version 2");

  await clickLabel("Mobile");
  await waitFor("document.querySelector('[data-preview-device=mobile]')?.getBoundingClientRect().width <= 392", "mobile preview width");
  await screenshot("03-editor-mobile");
  await clickLabel("Desktop");
  pass("Desktop, tablet and mobile previews resize the page with container queries");

  // Custom section (rows, columns, widgets) with an image uploaded from the computer, saved to the company library.
  await evaluate(`document.querySelector('[aria-label="Close settings"]')?.click()`);
  await clickText("Elements", "[role=tab]");
  await clickText("Custom section", "aside[aria-label='Editor panel'] button");
  await waitFor(`!!document.querySelector('[data-preview-device] [data-section-type="CUSTOM"] [data-widget-path]')`, "the custom section on the canvas");
  await clickText("content", "[role=tab]");
  await clickText("Image", "aside[aria-label='Editor panel'] li button");
  await waitFor("document.body.innerText.includes('Row 1 › Column 2 › Image')", "the widget panel");
  await clickText("Change image", "aside[aria-label='Editor panel'] button");
  await clickText("Uploads", "[role=tab]");
  await waitFor("!!document.querySelector('[data-testid=website-media-input]')", "the upload control");
  const {root: documentNode} = await command("DOM.getDocument", {depth: 1});
  const {nodeId: fileInput} = await command("DOM.querySelector", {nodeId: documentNode.nodeId, selector: "[data-testid=website-media-input]"});
  await command("DOM.setFileInputFiles", {nodeId: fileInput, files: [join(root, "public", "demo-assets", "demo-dunewell-properties", "demo-prj-05", "demo-p-013", "photo-1.png")]});
  await waitFor(`[...document.querySelectorAll('[data-preview-device] [data-section-type="CUSTOM"] img')].some(i => (i.getAttribute('src') || '').startsWith('/api/websites/media/') && i.complete && i.naturalWidth > 0)`, "the uploaded image on the canvas");
  await screenshot("02d-editor-custom-section");
  // Elementor-style structure: a new 33/67 section, widths changed to 40/60, reversed on phones.
  await evaluate(`document.querySelector('[aria-label="Close settings"]')?.click()`);
  await clickText("Add a section", "main button");
  await waitFor("!!document.querySelector('#structure-title')", "the structure picker");
  await screenshot("02e-structure-picker");
  await clickLabel("33 / 67 columns");
  await waitFor(`document.querySelectorAll('[data-preview-device] [data-section-type="CUSTOM"]').length === 2`, "the new two-column section");
  await setField("[aria-label='Column 1 width in percent']", "40");
  await waitFor(`[...document.querySelectorAll('[data-preview-device] [data-row-path]')].some(e => e.style.getPropertyValue('--pg-cols') === 'minmax(0,40fr) minmax(0,60fr)')`, "the new column widths on the canvas");
  await clickText("Reverse order on phones", "aside label");
  await screenshot("02f-editor-column-widths");
  await clickText("Save", "button");
  await waitFor("document.body.innerText.includes('Saved · version 3')", "saved version 3");
  stored = await payload(pageId);
  const customSection = stored.data.sections.find(section => section.type === "CUSTOM");
  const imageWidget = customSection.props.rows[0].columns[1].widgets.find(widget => widget.type === "IMAGE");
  const structured = stored.data.sections.filter(section => section.type === "CUSTOM")[1];
  assert.deepEqual([structured.props.rows[0].layout, structured.props.rows[0].widths, structured.props.rows[0].reverseOnMobile], ["1-2", [40, 60], true], "the chosen structure, widths and phone order are saved");
  const uploadId = imageWidget.props.image.uploadId;
  assert.match(uploadId, /^[0-9a-f-]{32,36}$/, "the uploaded image is stored as a library ID, never a URL");
  assert.ok(stored.linked.uploads.some(upload => upload.id.replaceAll("-", "") === uploadId.replaceAll("-", "")));
  const library = await api("/api/websites/media");
  assert.ok(library.body.data.items.some(item => item.id.replaceAll("-", "") === uploadId.replaceAll("-", "") && item.width === 960), "the library records the image size");
  assert.equal((await api(`/api/websites/media/${uploadId}/content`)).contentType, "image/png");
  const forged = await api("/api/websites/media", {method: "POST", headers: {"Content-Type": "image/png", "X-EstateOS-Organization": f.orgA}, body: "<html><script>alert(1)</script></html>"});
  assert.equal(forged.status, 415, "a file whose bytes are not an image is rejected");
  await evaluate(`(()=>{const e=document.querySelector('[data-preview-device] [data-section-type="CUSTOM"]').closest('[data-editor-section]');const b=e.getBoundingClientRect();e.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:b.left+40,clientY:b.top+40}));})()`);
  await clickText("Save to library", "[role=menu] button");
  await waitFor("!!document.querySelector('#save-section-title')", "the save-to-library dialog");
  await evaluate(`document.querySelector('[role=dialog] input[name=name]').value = 'E2E saved layout'`);
  await clickText("Save", "[role=dialog] button[type=submit]");
  await waitFor("!document.querySelector('#save-section-title')", "the dialog to close");
  const saved = (await api("/api/websites/section-templates")).body.data.find(item => item.name === "E2E saved layout");
  assert.ok(saved && saved.section.type === "CUSTOM", "the section is in the company library");
  assert.ok(JSON.stringify(saved.section).includes(uploadId), "uploads stay in saved sections");
  // The editor on a phone: a drawer panel and a bottom action bar.
  await command("Emulation.setDeviceMetricsOverride", {width: 390, height: 844, deviceScaleFactor: 2, mobile: true});
  await waitFor("!!document.querySelector('nav[aria-label=\"Editor actions\"]')", "the phone editor's action bar");
  await screenshot("03b-editor-phone");
  await clickText("Elements", "nav[aria-label='Editor actions'] button");
  await waitFor("!!document.querySelector('aside[aria-label=\"Editor panel\"].fixed')", "the panel as a drawer");
  await screenshot("03c-editor-phone-drawer");
  await clickLabel("Close panel");
  await command("Emulation.setDeviceMetricsOverride", {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false});
  await waitFor("!document.querySelector('nav[aria-label=\"Editor actions\"]')", "the desktop editor again");
  pass("Custom section built from rows, columns and widgets; an image uploaded from the computer (signature-checked) is stored by ID; a new section's structure, column widths and phone order are chosen and saved; the section is saved to the company library; the editor works on a phone");

  const save = (data, revision, extra = {}) => post(`/api/websites/pages/${pageId}`, {expectedRevision: revision, title: "E2E Marina Launch", slug: "e2e-marina-launch", description: null, seoTitle: "E2E Marina Launch", seoDescription: "Register your interest in E2E Marina Towers.", data, ...extra}, f.orgA, "PUT");
  const script = structuredClone(stored.data);
  script.sections.find(section => section.type === "HERO").props.headline = "<script>alert(1)</script>";
  assert.equal((await save(script, stored.page.revision)).status, 400);
  const custom = structuredClone(stored.data);
  custom.sections.push({...custom.sections[0], id: "custom-1", type: "CUSTOM_HTML"});
  assert.equal((await save(custom, stored.page.revision)).status, 400);
  assert.equal((await save(stored.data, stored.page.revision - 1)).status, 409);
  const seo = await save(stored.data, stored.page.revision);
  assert.equal(seo.status, 200, JSON.stringify(seo.body));
  pass("Saving rejects HTML/script text, unknown component types and stale revisions (409); a valid save adds a version");

  // ------------------------------------------------------------ roles and tenants
  await signIn("agent-a");
  const agentView = (await api("/api/websites")).body.data;
  assert.equal(agentView.permissions.canCreate, false);
  assert.equal(agentView.pages.length, 0, "agents see only their own pages");
  assert.equal((await post("/api/websites/pages", {mode: "BLANK", title: "Agent page"})).status, 403);
  assert.equal((await api(`/api/websites/pages/${pageId}`)).status, 404);
  await signIn("manager-a");
  assert.equal((await post("/api/websites/pages", {mode: "TEMPLATE", templateKey: "OFF_PLAN_LAUNCH", title: "Manager project page", projectId: ids.project})).status, 403, "managers have no inventory scope");
  const managerPage = await post("/api/websites/pages", {mode: "BLANK", title: "Manager draft", slug: "manager-draft"});
  assert.equal(managerPage.status, 201);
  assert.equal((await post(`/api/websites/pages/${pageId}/publish`, {expectedRevision: 1, attestations: []})).status, 403);
  await signIn("owner-b");
  assert.equal((await api(`/api/websites/pages/${pageId}`)).status, 404);
  assert.equal((await api("/api/websites")).body.data.pages.length, 0);
  pass("Agents cannot create pages without permission or open others' pages; managers cannot link inventory or publish; another company sees nothing");

  // ------------------------------------------------------------ Claude failure preserves work
  await signIn("owner-a");
  const before = {rows: (await pageRows()).length, counter: await counter("owner-a"), page: (await pageRows()).find(row => row.id.replaceAll("-", "") === pageId.replaceAll("-", ""))};
  if (!live) {
    const failed = await post("/api/websites/pages/generate", {title: "Claude page", brief: "A premium page", projectId: ids.project});
    assert.ok(failed.status >= 400 && /AI_/.test(failed.body.error.code), JSON.stringify(failed.body));
    const regenerate = await post(`/api/websites/pages/${pageId}/generate`, {expectedRevision: (await payload(pageId)).page.revision, brief: "Redesign"});
    assert.ok(regenerate.status >= 400, JSON.stringify(regenerate.body));
    const after = (await pageRows()).find(row => row.id.replaceAll("-", "") === pageId.replaceAll("-", ""));
    assert.equal((await pageRows()).length, before.rows, "no page was created");
    assert.equal(after.versionCount, before.page.versionCount, "the existing page is unchanged");
    assert.equal(await counter("owner-a"), before.counter, "the allowance was returned");
    const records = await usage("owner-a");
    assert.ok(records.length >= 2 && records.every(row => row.status === "FAILED" && row.promptVersion === "6d.2"), JSON.stringify(records));
    pass(`Claude failure (invalid key, ${failed.body.error.code}) creates nothing, leaves the page unchanged, returns the allowance and records PAGES usage`);
  } else {
    const generated = await post("/api/websites/pages/generate", {title: "E2E Claude page", brief: "A premium modern landing page for this Dubai Marina project with a luxury design, gallery, pricing, map, payment plan and enquiry form.", projectId: ids.project});
    assert.equal(generated.status, 201, JSON.stringify(generated.body));
    const view = await payload(generated.body.data.pageId);
    const types = view.data.sections.map(section => section.type);
    assert.equal(types[0], "HERO"); assert.equal(types.at(-1), "FOOTER"); assert.ok(types.includes("ENQUIRY_FORM"));
    const text = JSON.stringify(view.data);
    assert.doesNotMatch(text, /<|javascript:/i);
    assert.deepEqual(leaked(text, [secrets.hiddenAddress, secrets.note, secrets.unitNumber, secrets.foreign, secrets.exactLatitude]), []);
    const records = await usage("owner-a");
    assert.equal(records[0].status, "SUCCEEDED");
    assert.ok(records[0].inputTokens > 0 && records[0].outputTokens > 0);
    console.log(`  Live page: ${types.join(", ")}; ${view.validation?.warnings.length ?? 0} fact-check warnings; omitted: ${view.validation?.omitted.join(" | ") || "none"}`);
    console.log(`  Hero: ${view.data.sections[0].props.headline} / ${view.data.sections[0].props.subheadline}`);
    pass(`Live Claude (${records[0].model}) generated a registry-valid page from the authorized project, with no leaked data, and usage was recorded`);
  }

  // ------------------------------------------------------------ form, review, publish
  let current = await payload(pageId);
  assert.equal((await post(`/api/websites/pages/${pageId}/publish`, {expectedRevision: current.page.revision, attestations: []})).status, 409, "an unapproved page cannot be published");
  // Fix the failing checklist item in place: connect the lead form from the Publish tab.
  await load(editorPath, "document.body.innerText.includes('E2E Waterfront Launch')");
  await clickText("Publish", "header button");
  await waitFor("document.body.innerText.includes('Connect a form here')", "the in-place fix for the lead form");
  await clickText("Connect a form here", "aside button");
  await waitFor("!!document.querySelector('aside li select')", "the lead form picker in the checklist");
  await evaluate(`(()=>{const s=document.querySelector('aside li select');const o=[...s.options].find(o=>o.textContent.includes('E2E landing enquiries'));Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,o.value);s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await clickText("Connect", "aside li button");
  await waitFor("document.body.innerText.includes('Enquiries go to the CRM through the connected form') && !document.body.innerText.includes('Connect a form here')", "the checklist re-checks after connecting");
  await screenshot("04a-publish-fixed-in-place");
  current = await payload(pageId);
  assert.equal(current.form.name, "E2E landing enquiries");
  assert.equal((await post(`/api/websites/pages/${pageId}/submit`, {expectedRevision: current.page.revision})).status, 200);
  await signIn("manager-a");
  current = await payload(pageId);
  assert.equal((await post(`/api/websites/pages/${pageId}/approve`, {expectedRevision: current.page.revision, versionNumber: current.page.currentVersionNumber})).status, 403);
  await signIn("owner-a");
  current = await payload(pageId);
  assert.equal((await post(`/api/websites/pages/${pageId}/approve`, {expectedRevision: current.page.revision, versionNumber: current.page.currentVersionNumber})).status, 200);
  current = await payload(pageId);
  assert.equal(current.page.status, "APPROVED");
  const unconfirmed = await post(`/api/websites/pages/${pageId}/publish`, {expectedRevision: current.page.revision, attestations: []});
  assert.equal(unconfirmed.status, 409);
  const checklist = unconfirmed.body.error.checklist;
  assert.equal(checklist.blockers, 0, JSON.stringify(checklist.items.filter(item => item.blocking)));
  assert.deepEqual(checklist.attestations, ["CONTENT_REVIEWED", "ADVERTISING_PERMITS_VERIFIED", "STOCK_MEDIA_ILLUSTRATIVE"]);
  assert.ok(checklist.items.some(item => item.id === "project-permit" && item.status === "PASS"));
  await load(editorPath, "document.body.innerText.includes('E2E Waterfront Launch')");
  await clickText("Publish", "header button");
  await clickText("Publish…", "button");
  await waitFor("document.body.innerText.includes('Confirm before publishing')", "publish confirmation");
  await evaluate("[...document.querySelectorAll('fieldset input[type=checkbox]')].forEach(box=>{if(!box.checked)box.click();})");
  await screenshot("04-publish-checklist");
  await clickText("Publish now", "button");
  await waitFor("document.body.innerText.includes('Live since')", "live status");
  current = await payload(pageId);
  assert.equal(current.page.status, "PUBLISHED");
  const publicPath = current.live.path;
  assert.equal(publicPath, "/site/local-agency-a/e2e-marina-launch");
  pass("Lead form connected; manager cannot approve; OWNER approves, sees the UAE checklist (Dubai permit recorded) and publishes after confirming both attestations");

  // ------------------------------------------------------------ public page
  await command("Network.clearBrowserCookies");
  const html = (await api(publicPath)).body;
  for (const expected of ["E2E Waterfront Launch", "AED 1,250,000", "images.unsplash.com", "illustrative stock media", "PRJ-E2E-1", "E2E disclaimer", "Register your interest", "rel=\"canonical\"", `${origin}${publicPath}`, "og:image", "/api/public/site-media/"]) assert.ok(html.includes(expected), `public page has ${expected}`);
  assert.ok(!html.includes("Internal preview"));
  assert.ok(!/noindex/.test(html), "live pages are indexable");
  assert.deepEqual(leaked(html, [secrets.exactLatitude, secrets.exactLongitude, secrets.hiddenAddress, secrets.note, secrets.unitNumber, secrets.foreign, "organizations/", "E2E Project Street", form, "E2E-REF-"]), []);
  const image = html.match(/\/api\/public\/site-media\/[0-9a-f-]+\/[0-9a-f-]+/)[0];
  const imageResponse = await fetch(origin + image);
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get("content-type"), "image/png");
  assert.equal((await fetch(origin + image.replace(/[0-9a-f-]+$/, randomUUID()))).status, 404, "media outside the page's allowlist is not served");
  const uploadUrl = [...html.matchAll(/\/api\/public\/site-media\/[0-9a-f-]+\/([0-9a-f-]+)/g)].find(match => match[1].replaceAll("-", "") === uploadId.replaceAll("-", ""))?.[0];
  assert.ok(uploadUrl, "the uploaded image is published through the publication allowlist");
  const uploadResponse = await fetch(origin + uploadUrl);
  assert.equal(uploadResponse.status, 200);
  assert.equal(uploadResponse.headers.get("content-type"), "image/png");
  assert.equal((await fetch(origin + `/api/websites/media/${uploadId}/content`)).status, 401, "the editor route needs a session");
  for (const path of ["/site/local-agency-b/e2e-marina-launch", "/site/local-agency-a/does-not-exist", "/site/local-agency-a/manager-draft", "/site/LOCAL/../etc"]) assert.equal((await fetch(origin + path)).status, 404, path);
  const sitemap = await (await fetch(origin + "/sitemap.xml")).text();
  assert.ok(sitemap.includes(publicPath) && !sitemap.includes("manager-draft"));
  await load(publicPath, "document.body.innerText.includes('E2E Waterfront Launch')");
  await screenshot("05a-public-desktop-hero");
  await evaluate("window.scrollTo(0, document.body.scrollHeight * 0.35)"); await pause(800); await screenshot("05b-public-desktop-middle");
  await evaluate("window.scrollTo(0, document.body.scrollHeight * 0.7)"); await pause(800); await screenshot("05c-public-desktop-lower");
  // Gallery photos open in a full-screen viewer (next with the arrow key, Escape closes).
  await evaluate(`(()=>{const a=document.querySelector('[data-lightbox-group][data-lightbox-index="0"]');a.scrollIntoView({block:'center'});a.click();})()`);
  await waitFor("/^Photo 1 of \\d+$/.test(document.querySelector('[role=dialog][aria-modal=true]')?.getAttribute('aria-label') || '')", "the photo viewer");
  await command("Input.dispatchKeyEvent", {type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39});
  await command("Input.dispatchKeyEvent", {type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39});
  const photoCount = await evaluate("Number((document.querySelector('[role=dialog][aria-modal=true]')?.getAttribute('aria-label') || '').split(' of ')[1])");
  await waitFor(`(document.querySelector('[role=dialog][aria-modal=true]')?.getAttribute('aria-label') || '') === 'Photo ${photoCount > 1 ? 2 : 1} of ${photoCount}'`, "the next photo (or the only one)");
  await screenshot("05d-public-gallery-viewer");
  await command("Input.dispatchKeyEvent", {type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27});
  await command("Input.dispatchKeyEvent", {type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27});
  await waitFor("!document.querySelector('[role=dialog][aria-modal=true]')", "the viewer to close");
  pass("Public page needs no login, shows CRM values, permit, disclaimer, canonical and Open Graph tags, serves only allowlisted images, and leaks no coordinates, hidden addresses, notes, storage paths or other companies' data; wrong slugs and drafts are 404; sitemap lists live pages only");

  await load(publicPath, "document.body.innerText.includes('Get the price list')", {width: 390, height: 844, mobile: true});
  assert.ok(await evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "no horizontal scrolling on mobile");
  assert.equal(await evaluate("document.querySelectorAll('h1').length"), 1);
  await screenshot("05-public-mobile");
  await pause(1200);
  await evaluate(`(()=>{const set=(name,value)=>{const e=document.querySelector('[name='+name+']');const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));};
    set('FULL_NAME','E2E Landing Visitor');set('EMAIL','visitor.e2e@example.test');set('MESSAGE','Interested in a one bedroom.');document.querySelector('[name=consent]').click();})()`);
  await clickText("Send me the details", "button");
  await waitFor("document.body.innerText.includes('Thank you. E2E enquiry received.')", "enquiry success");
  await screenshot("06-enquiry-sent");
  const submissions = (await dc.executeGraphql(`query S($form: UUID!) { leadCaptureSubmissions(where: {formId: {eq: $form}}) { leadId landingPageUrl lead { fullName propertyInterest organizationId status } } }`, {variables: {form}})).data.leadCaptureSubmissions;
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].lead.fullName, "E2E Landing Visitor");
  assert.equal(submissions[0].landingPageUrl, `${origin}${publicPath}`);
  assert.match(submissions[0].lead.propertyInterest, /Landing page: E2E Marina Launch · Project: E2E Marina Towers/);
  const enquiryKey = "e2e" + randomUUID().replaceAll("-", "");
  const publicPost = body => api(`/api/public/sites/local-agency-a/e2e-marina-launch/enquiries`, {method: "POST", public: true, headers: {"Content-Type": "application/json", "Idempotency-Key": enquiryKey}, body: JSON.stringify(body)});
  const valid = {fields: {FULL_NAME: "E2E Retry Visitor", EMAIL: "retry.e2e@example.test"}, consent: true, honeypot: "", elapsedMs: 5000, attribution: {utmSource: "e2e", utmCampaign: "launch"}};
  assert.equal((await publicPost(valid)).status, 201);
  assert.equal((await publicPost(valid)).body.data.duplicate, true, "a retried submission does not create a second lead");
  assert.equal((await publicPost({...valid, honeypot: "bot"})).status, 400);
  assert.equal((await publicPost({...valid, organizationId: f.orgB})).status, 400, "a browser-supplied company is rejected");
  pass("Visitor submits the mobile enquiry form; the lead is created in the right company with the server-built page URL and project reference; retries, bots and injected company IDs are handled");

  await signIn("owner-a");
  const enquiries = (await api(`/api/websites/pages/${pageId}/enquiries`)).body.data;
  assert.equal(enquiries.total, 2);
  assert.ok(enquiries.enquiries.some(item => item.lead.fullName === "E2E Landing Visitor"));
  assert.ok(enquiries.enquiries.some(item => item.utmCampaign === "launch"));
  const leadId = enquiries.enquiries.find(item => item.lead.fullName === "E2E Landing Visitor").leadId;
  assert.equal((await api(`/api/leads/${leadId}`)).status, 200);
  await signIn("manager-a");
  assert.equal((await api(`/api/websites/pages/${pageId}/enquiries`)).status, 403);
  pass("OWNER sees both enquiries (with UTM attribution) linked to the page and opens the lead in EstateOS Leads; managers cannot list page enquiries");

  // ------------------------------------------------------------ draft edits, outdated data, rollback, offline
  await signIn("owner-a");
  current = await payload(pageId);
  const draft = structuredClone(current.data);
  draft.sections.find(section => section.type === "HERO").props.headline = "E2E Draft Headline";
  assert.equal((await save(draft, current.page.revision)).status, 200);
  let publicHtml = (await api(publicPath)).body;
  assert.ok(publicHtml.includes("E2E Waterfront Launch") && !publicHtml.includes("E2E Draft Headline"), "the live page does not change when the draft is edited");
  await dc.executeGraphql(`mutation Price($org: UUID!, $id: UUID!) { project_update(key: {organizationId: $org, id: $id}, data: {startingPriceMinor: "130000000"}) }`, {variables: {org: f.orgA, id: ids.project}});
  current = await payload(pageId);
  assert.equal(current.page.status, "DRAFT");
  assert.ok(current.live.outdated && current.live.changes.some(change => change.includes("starting price")), JSON.stringify(current.live));
  publicHtml = (await api(publicPath)).body;
  assert.ok(publicHtml.includes("AED 1,250,000") && !publicHtml.includes("AED 1,300,000"), "a CRM change is never republished silently");
  const republished = await post(`/api/websites/pages/${pageId}/publish`, {expectedRevision: current.page.revision, versionNumber: current.page.approvedVersionNumber, attestations: ["CONTENT_REVIEWED", "ADVERTISING_PERMITS_VERIFIED", "STOCK_MEDIA_ILLUSTRATIVE"]});
  assert.equal(republished.status, 200, JSON.stringify(republished.body));
  publicHtml = (await api(publicPath)).body;
  assert.ok(publicHtml.includes("AED 1,300,000") && publicHtml.includes("E2E Waterfront Launch") && !publicHtml.includes("E2E Draft Headline"));
  current = await payload(pageId);
  assert.equal(current.page.status, "DRAFT", "the newer draft keeps its status after republishing the approved version");
  pass("Draft edits leave the live page unchanged; a CRM price change is flagged as outdated, not republished, until the OWNER republishes the approved version with current data");

  await dc.executeGraphql(`mutation Expire($org: UUID!, $id: UUID!) { project_update(key: {organizationId: $org, id: $id}, data: {permitExpiryDate: "2020-01-01"}) }`, {variables: {org: f.orgA, id: ids.project}});
  assert.equal((await fetch(origin + publicPath)).status, 404, "an expired project permit takes the page offline");
  await dc.executeGraphql(`mutation Renew($org: UUID!, $id: UUID!, $date: Date!) { project_update(key: {organizationId: $org, id: $id}, data: {permitExpiryDate: $date}) }`, {variables: {org: f.orgA, id: ids.project, date: daysFromNow(365)}});
  assert.equal((await fetch(origin + publicPath)).status, 200);
  pass("An expired advertising permit takes the live page offline automatically; renewing it restores the page");

  // ------------------------------------------------------------ restart persistence
  // Park the tab first: an open dev page reloads itself when its server goes away.
  await command("Page.navigate", {url: "about:blank"});
  await pause(500);
  stop(server);
  await pause(1500);
  server = startNext();
  await serverReady();
  // The fresh dev server compiles each route on first use and may reload an open tab; compile them first.
  for (const path of ["/api/auth/session", "/onboarding/company?select=1", "/workspace/dashboard", editorPath, publicPath, "/api/websites"]) await fetch(origin + path).catch(() => null);
  await pause(2000);
  for (let attempt = 1; ; attempt++) {
    try { await signIn("owner-a"); break; } catch (error) { if (attempt >= 3 || !/navigated or closed/.test(String(error))) throw error; await pause(2000); }
  }
  current = await payload(pageId);
  assert.equal(current.data.sections.find(section => section.type === "HERO").props.headline, "E2E Draft Headline");
  assert.ok(current.live && current.versions.length >= 4);
  await load(editorPath, "document.body.innerText.includes('E2E Draft Headline') || document.querySelector('[data-preview-device]')?.innerText.includes('E2E Draft Headline')");
  await command("Network.clearBrowserCookies");
  const afterRestart = (await api(publicPath)).body;
  assert.ok(afterRestart.includes("E2E Waterfront Launch"));
  assert.equal((await fetch(origin + afterRestart.match(/\/api\/public\/site-media\/[0-9a-f-]+\/[0-9a-f-]+/)[0])).status, 200, "uploaded images remain accessible");
  await signIn("owner-a");
  assert.equal((await api(`/api/websites/pages/${pageId}/enquiries`)).body.data.total, 2);
  pass("After a server restart the editor, draft, version history, live page, image and enquiries all load from the database and Storage");

  // ------------------------------------------------------------ unpublish
  current = await payload(pageId);
  assert.equal((await post(`/api/websites/pages/${pageId}/unpublish`, {expectedRevision: current.page.revision})).status, 200);
  assert.equal((await fetch(origin + publicPath)).status, 404);
  assert.equal((await fetch(origin + image)).status, 404, "an unpublished page's images are no longer served");
  assert.ok(!(await (await fetch(origin + "/sitemap.xml")).text()).includes(publicPath));
  pass("Unpublishing removes the page, its images and its sitemap entry immediately");

  assert.deepEqual(exceptions.filter(message => !/ResizeObserver/.test(message)), [], "no uncaught browser exceptions");
  console.log(`\n${checks} website builder end-to-end checks passed (${live ? "live Claude" : "invalid-key mode"}). Screenshots: ${screens}`);
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
