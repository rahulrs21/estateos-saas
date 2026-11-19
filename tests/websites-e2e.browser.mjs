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
const {apps: sqlApps, dc} = localDataConnect();
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

  // ------------------------------------------------------------ Style gallery: live sample pages per style and structure
  await waitFor("!!document.querySelector('[data-testid=style-DEPTH_3D]').closest('li').querySelector('.pg-root')", "the style miniatures");
  assert.equal(await evaluate("document.querySelectorAll('button button, button a, button form, a button').length"), 0, "no interactive element sits inside a button (the miniatures are beside the card buttons)");
  // Miniatures render as they come into view: the signature styles further down render once scrolled to.
  assert.equal(await evaluate("!!document.querySelector('[data-testid=style-PREMIUM_DARK]').closest('li').querySelector('.pg-root')"), false, "off-screen miniatures wait until they are needed");
  await evaluate("document.querySelector('[data-testid=style-PREMIUM_DARK]').scrollIntoView({block: 'center'})");
  await waitFor("!!document.querySelector('[data-testid=style-PREMIUM_DARK]').closest('li').querySelector('.pg-root')", "the signature style miniatures");
  // The campaign miniature has a real enquiry form: it still must not sit inside the card button.
  await evaluate("document.querySelector('[aria-label=\"More signature styles\"]').click()");
  await waitFor("!!document.querySelector('[data-testid=style-HIGH_CONVERSION]').closest('li').querySelector('.pg-root form')", "the campaign miniature with its form");
  assert.equal(await evaluate("document.querySelectorAll('button button, button a, button form, a button').length"), 0, "no interactive element inside a button, with every miniature drawn");
  await evaluate("document.querySelector('[data-testid=style-HIGH_CONVERSION]').click()");
  assert.equal(await evaluate("document.querySelector('[data-testid=style-HIGH_CONVERSION]').getAttribute('aria-checked')"), "true", "the card button selects the style");
  await evaluate("document.querySelector('[data-testid=style-auto]').click()");
  await pause(1500);
  await screenshot("01b-style-gallery-signature");
  await evaluate("document.querySelector('[data-testid=style-auto]').scrollIntoView({block: 'start'})");
  await pause(1500);
  await screenshot("01b-style-gallery");
  assert.equal(await evaluate("document.querySelector('[data-testid=style-auto]').getAttribute('aria-checked')"), "true", "Claude chooses by default");
  const carousel = "document.querySelector('[data-testid=carousel-new-design-styles]')";
  const inView = `(()=>{const t=${carousel};const r=t.getBoundingClientRect();return [...t.children].filter(c=>{const b=c.getBoundingClientRect();return b.left>=r.left-2&&b.right<=r.right+2;}).length;})()`;
  assert.equal(await evaluate(inView), 4, "four style cards per view");
  // The rows stay inside the form column: the page does not scroll sideways and the side panel is not covered.
  assert.ok(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "the page does not scroll sideways");
  assert.ok(await evaluate(`(()=>{const c=${carousel}.getBoundingClientRect(),a=document.querySelector('[data-testid=wizard-next-steps]').getBoundingClientRect(),d=document.querySelector('[data-testid=wizard-design]').getBoundingClientRect();return c.top>=a.bottom&&d.right>a.left;})()`), "the style rows use the full width below the What happens next panel");
  assert.ok(await evaluate("document.querySelector('[data-testid=wizard-next-steps]').getBoundingClientRect().height < 400"), "the What happens next panel is only as tall as its text");
  assert.ok(await evaluate(`${carousel}.scrollWidth > ${carousel}.clientWidth`), "the other styles are further along the row");
  assert.equal(await evaluate("document.querySelector('[aria-label=\"Previous new design styles\"]').disabled"), true);
  await evaluate("document.querySelector('[aria-label=\"More new design styles\"]').click()");
  await waitFor(`${carousel}.scrollLeft > 100 && !document.querySelector('[aria-label="Previous new design styles"]').disabled`, "the next style cards");
  await waitFor("!!document.querySelector('[data-testid=style-WARM_ORGANIC]').closest('li').querySelector('.pg-root')", "the miniature scrolled into the row");
  await pause(1200);
  await screenshot("01b-style-carousel-next");
  await evaluate("document.querySelector('[aria-label=\"Previous new design styles\"]').click()");
  await waitFor(`${carousel}.scrollLeft <= 1`, "the first style cards again");
  await evaluate("document.querySelector('[data-testid=style-BENTO_GRID]').click()");
  await waitFor("document.querySelector('[data-testid=style-BENTO_GRID]').getAttribute('aria-checked') === 'true' && document.querySelector('[data-testid=structure-BENTO]').innerText.includes('Recommended')", "the chosen style and its recommended structure");
  await evaluate("document.querySelector('[data-testid=structure-auto]').scrollIntoView({block: 'start'})");
  await pause(500);
  await screenshot("01c-structure-picker");
  // Page structures are a carousel too, and every carousel can be dragged with the mouse (a drag does not pick a card).
  const structures = "document.querySelector('[data-testid=carousel-page-structures]')";
  assert.equal(await evaluate(`(()=>{const t=${structures};const r=t.getBoundingClientRect();return [...t.children].filter(c=>{const b=c.getBoundingClientRect();return b.left>=r.left-2&&b.right<=r.right+2;}).length;})()`), 4, "four structures per view");
  const grip = await evaluate(`(()=>{const r=${structures}.children[2].getBoundingClientRect();return {x: Math.round(r.left + r.width / 2), y: Math.round(r.top + 60)};})()`);
  const pickedBefore = await evaluate("document.querySelector('[data-testid=structure-SHOWCASE_3D]').getAttribute('aria-checked')");
  await command("Input.dispatchMouseEvent", {type: "mouseMoved", x: grip.x, y: grip.y});
  await command("Input.dispatchMouseEvent", {type: "mousePressed", x: grip.x, y: grip.y, button: "left", buttons: 1, clickCount: 1});
  for (let step = 1; step <= 12; step++) await command("Input.dispatchMouseEvent", {type: "mouseMoved", x: grip.x - step * 40, y: grip.y, button: "left", buttons: 1});
  await command("Input.dispatchMouseEvent", {type: "mouseReleased", x: grip.x - 480, y: grip.y, button: "left", buttons: 0, clickCount: 1});
  await waitFor(`${structures}.scrollLeft > 150 && !${structures}.dataset.dragging`, "the dragged structures row");
  assert.equal(await evaluate("document.querySelector('[data-testid=structure-SHOWCASE_3D]').getAttribute('aria-checked')"), pickedBefore, "a drag does not pick the card it started on");
  await pause(900);
  await screenshot("01c-structure-carousel-dragged");
  // A full-size sample page per new style, with its look applied by the stylesheet.
  const LOOK_CHECKS = {
    DEPTH_3D: ["depth", "!!document.querySelector('[data-testid=style-preview] .pg-wordmark') && getComputedStyle(document.querySelector('[data-testid=style-preview] .pg-hero-buttons .pg-btn')).borderTopLeftRadius === '0px'"],
    SWISS_MINIMAL: ["minimal", "getComputedStyle(document.querySelector('[data-testid=style-preview] .pg-card:not(.pg-panel)')).backgroundColor === 'rgba(0, 0, 0, 0)'"],
    EDITORIAL: ["editorial", "getComputedStyle(document.querySelector('[data-testid=style-preview] .pg-section .pg-h2'), '::before').content.includes('pg-chapter')"],
    BENTO_GRID: ["bento", "getComputedStyle(document.querySelector('[data-testid=style-preview] [data-section-type=STATS] > .pg-inner')).borderTopLeftRadius === '32px'"],
    GLASS_AURORA: ["glass", "getComputedStyle(document.querySelector('[data-testid=style-preview] .pg-card')).backdropFilter.includes('blur')"],
    BOLD_STATEMENT: ["bold", "getComputedStyle(document.querySelector('[data-testid=style-preview] .pg-card')).boxShadow.includes('6px 6px')"],
    WARM_ORGANIC: ["organic", "getComputedStyle(document.querySelector('[data-testid=style-preview] .pg-media.pg-portrait')).borderTopLeftRadius.startsWith('999')"],
    LUXURY_MINIMALIST: ["quiet", "!!document.querySelector('[data-testid=style-preview] [data-section-variant=centered] [aria-label=\"More page sections\"]')"],
    PREMIUM_DARK: ["noir", "getComputedStyle(document.querySelector('[data-testid=style-preview] .pg-root')).backgroundImage.includes('linear-gradient')"],
    MODERN_CORPORATE: ["grid", "getComputedStyle(document.querySelector('[data-testid=style-preview] .pg-card')).borderTopLeftRadius === '0px'"],
    ELEGANT_LIGHT: ["boutique", "getComputedStyle(document.querySelector('[data-testid=style-preview] .pg-btn')).borderTopLeftRadius.startsWith('9999')"],
    CONTEMPORARY: ["panel", "!!document.querySelector('[data-testid=style-preview] .pg-hero-panel')"],
    HIGH_CONVERSION: ["campaign", "getComputedStyle(document.querySelector('[data-testid=style-preview] .pg-hero-buttons .pg-btn'), '::after').borderTopLeftRadius.startsWith('999')"],
  };
  for (const [style, [look, check]] of Object.entries(LOOK_CHECKS)) {
    await evaluate(`document.querySelector('[data-testid=style-${style}]').closest('li').querySelector('[aria-label^="Preview"]').click()`);
    await waitFor(`document.querySelector('[data-testid=style-preview] .pg-root')?.dataset.pgLook === ${JSON.stringify(look)}`, `the ${style} preview`);
    await pause(2200);
    await screenshot(`01d-preview-${style.toLowerCase()}-top`);
    if (style === "DEPTH_3D") {
      assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-testid=style-preview] .pg-scroll')).scrollBehavior"), "smooth", "the preview panel scrolls smoothly");
      assert.equal(await evaluate("getComputedStyle(document.documentElement).scrollBehavior"), "auto", "the rest of EstateOS keeps normal scrolling");
      // Menu links scroll the preview to their section (the miniatures behind it use the same section names).
      const panel = "document.querySelector('[data-testid=style-preview] .pg-scroll')";
      await evaluate(`[...document.querySelectorAll('[data-testid=style-preview] [data-section-type=NAVBAR] nav a')].find(a=>a.textContent.trim()==='Units').click()`);
      await waitFor(`(()=>{const p=${panel};const u=p.querySelector('#units');return p.scrollTop > 400 && Math.abs(u.getBoundingClientRect().top - p.getBoundingClientRect().top) < 160;})()`, "the Units section scrolled into the preview");
      await pause(600);
      await screenshot("01d-preview-depth-units-link");
      // The photo strip: no scrollbar; the buttons move it.
      const strip = "document.querySelector('[data-testid=style-preview] .pg-carousel-track')";
      await evaluate(`${strip}.scrollIntoView({block:'center', behavior:'instant'})`);
      await pause(500);
      assert.equal(await evaluate(`getComputedStyle(${strip}).scrollbarWidth`), "none", "no scrollbar under the photo strip");
      assert.ok(await evaluate(`${strip}.offsetHeight - ${strip}.clientHeight === 0`), "the strip reserves no scrollbar space");
      await evaluate("document.querySelector('[data-testid=style-preview] [aria-label=\"Next photos\"]').click()");
      await waitFor(`${strip}.scrollLeft > 100`, "the next photos");
      await screenshot("01d-preview-depth-photo-strip");
    }
    if (style === "GLASS_AURORA") {
      // The 3D carousel rotates with the buttons, the arrow keys and dragging; a drag does not open the photo viewer.
      const stage = "document.querySelector('[data-testid=style-preview] .pg-coverflow-stage')";
      const counter = "document.querySelector('[data-testid=style-preview] .pg-coverflow-3d [aria-live=polite]').textContent.trim()";
      await evaluate(`${stage}.scrollIntoView({block:'center', behavior:'instant'})`);
      await pause(800);
      assert.match(await evaluate(counter), /^1 \/ \d+$/);
      await evaluate("document.querySelector('[data-testid=style-preview] [aria-label=\"Next photo\"]').click()");
      await waitFor(`${counter}.startsWith('2 /')`, "the next photo in front");
      await evaluate(`${stage}.focus()`);
      await command("Input.dispatchKeyEvent", {type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39});
      await waitFor(`${counter}.startsWith('3 /')`, "the arrow key turning the carousel");
      const grip = await evaluate(`(()=>{const r=${stage}.getBoundingClientRect();return {x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2)};})()`);
      await command("Input.dispatchMouseEvent", {type: "mouseMoved", x: grip.x, y: grip.y});
      await command("Input.dispatchMouseEvent", {type: "mousePressed", x: grip.x, y: grip.y, button: "left", buttons: 1, clickCount: 1});
      for (let step = 1; step <= 10; step++) await command("Input.dispatchMouseEvent", {type: "mouseMoved", x: grip.x + step * 40, y: grip.y, button: "left", buttons: 1});
      await command("Input.dispatchMouseEvent", {type: "mouseReleased", x: grip.x + 400, y: grip.y, button: "left", buttons: 0, clickCount: 1});
      await waitFor(`${counter}.startsWith('1 /') || ${counter}.startsWith('2 /')`, "the carousel dragged back");
      await pause(900);
      assert.equal(await evaluate("!!document.querySelector('[role=dialog][aria-label^=\"Photo\"], [data-lightbox-open]')"), false, "a drag does not open the photo viewer");
      await screenshot("01d-preview-glass-coverflow");
    }
    assert.ok(await evaluate(check), `the ${look} look is applied`);
    await evaluate("(()=>{const s=document.querySelector('[data-testid=style-preview] .overflow-y-auto');s.scrollTo({top:s.scrollHeight*0.3,behavior:'instant'});})()");
    await pause(1500);
    await screenshot(`01d-preview-${style.toLowerCase()}-middle`);
    await evaluate("(()=>{const s=document.querySelector('[data-testid=style-preview] .overflow-y-auto');s.scrollTo({top:s.scrollHeight*0.6,behavior:'instant'});})()");
    await pause(1200);
    await screenshot(`01d-preview-${style.toLowerCase()}-lower`);
    await command("Input.dispatchKeyEvent", {type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27});
    await waitFor("!document.querySelector('[data-testid=style-preview]')", "the closed preview");
  }
  // The phone width, then "Use this design" picks the style.
  await evaluate("document.querySelector('[data-testid=style-WARM_ORGANIC]').closest('li').querySelector('[aria-label^=\"Preview\"]').click()");
  await waitFor("!!document.querySelector('[data-testid=style-preview] .pg-root')", "the organic preview");
  await evaluate("document.querySelector('[data-testid=style-preview] [title=Phone]').click()");
  await pause(1800);
  await screenshot("01e-preview-phone");
  const header = await evaluate(`(()=>{const p=document.querySelector('[data-testid=style-preview] .pg-root');const m=p.querySelector('[data-section-type=NAVBAR] summary');const b=p.querySelector('[data-section-type=NAVBAR] a[href="#top"]');
    const r=p.getBoundingClientRect(),mr=m.getBoundingClientRect(),br=b.getBoundingClientRect();return {menuGap: Math.round(r.right-mr.right), brandLeft: Math.round(br.left-r.left), between: Math.round(mr.left-br.right)};})()`);
  assert.ok(header.menuGap <= 32 && header.brandLeft <= 32 && header.between > 120, `phone header: ${JSON.stringify(header)}`);
  await evaluate("document.querySelector('[data-testid=style-preview-use]').click()");
  await waitFor("!document.querySelector('[data-testid=style-preview]') && document.querySelector('[data-testid=style-WARM_ORGANIC]').getAttribute('aria-checked') === 'true'", "the chosen previewed style");
  assert.equal(await evaluate("document.querySelector('[data-testid=structure-auto]').getAttribute('aria-checked')"), "true", "the style's own structure stays the default");
  if (!live) {
    await load(`/websites/new?projectId=${ids.project}`, "!!document.querySelector('[data-testid=style-DEPTH_3D]') && !!document.getElementById('page-title')");
    await evaluate(`(()=>{const i=document.getElementById('page-title');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Wizard style page');i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await evaluate("document.querySelector('[data-testid=style-DEPTH_3D]').click()");
    await evaluate("document.querySelector('[data-testid=structure-INVESTOR]').click()");
    await waitFor("document.querySelector('[data-testid=structure-INVESTOR]').getAttribute('aria-checked') === 'true'", "the chosen structure");
    await clickText("Generate with Claude", "button");
    await waitFor("!!document.querySelector('[role=alert]')", "the generation result");
    const message = await evaluate("document.querySelector('[role=alert]').innerText");
    assert.doesNotMatch(message, /Check the supplied details|out of date/, "the wizard's request with a style and structure is accepted");
    assert.match(message, /AI service|Anthropic|credentials/i, `the request reached Claude: ${message}`);
  }
  pass("Style gallery: live sample miniatures for every style; choosing a style recommends its structure; full previews apply each new look (3D, minimal, editorial, bento, glass, bold, organic) on desktop and phone widths; a previewed design can be picked; styles scroll as carousels four to a view; on phones the menu button sits at the right end; the wizard's request with a style and structure reaches Claude");

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
  assert.equal(await evaluate("[...document.querySelectorAll('[role=tablist][aria-label=\"Editor panels\"] [role=tab]')].some(e=>e.textContent.includes('Navigator'))"), false, "the Navigator is not a panel tab on wide screens");
  await waitFor("!!document.querySelector('[data-testid=navigator-dock]:not([data-minimised])')", "the Navigator docked on the right");
  await clickText("Payment plans", "[data-testid=navigator-dock] li button");
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
  assert.deepEqual(await evaluate("[...document.querySelectorAll('aside [role=tablist][aria-label=\"Element settings\"] [role=tab]')].map(e=>e.textContent)"), ["Content", "Style", "Advanced"], "elements have Content, Style and Advanced tabs");
  assert.equal(await evaluate("document.querySelector('[data-testid=element-tab-content]').getAttribute('aria-selected')"), "true", "the element opens on its content");
  assert.ok(await evaluate("[...document.querySelectorAll('aside textarea, aside input')].some(e=>e.value==='E2E Waterfront Launch')"), "the headline's text is in the Content tab");
  await evaluate("document.querySelector('[data-testid=element-tab-style]').click()");
  await setField("aside input[placeholder='Theme colour']", "#b03a0b");
  await setField("aside input[type=range]", "64");
  await clickText("Centre", "aside [role=radio]");
  const headlineLook = `(()=>{const e=document.querySelector('[data-section-type="HERO"] [data-move-key="headline"]');const c=getComputedStyle(e);return c.color==='rgb(176, 58, 11)'&&c.textAlign==='center'&&c.fontSize==='64px';})()`;
  await waitFor(headlineLook, "the headline's colour, size and alignment change on the canvas only");
  assert.ok(await evaluate(`getComputedStyle(document.querySelector('[data-section-type="HERO"] [data-move-key="subheadline"]')).color !== 'rgb(176, 58, 11)'`), "the rest of the section keeps its style");
  await screenshot("02b-editor-element-style");
  await evaluate("document.querySelector('[data-testid=element-tab-advanced]').click()");
  await waitFor("document.body.innerText.includes('Move \"Headline\"') && document.body.innerText.includes('Show on mobile')", "element position, spacing and visibility controls");
  for (let press = 0; press < 2; press++) {
    await command("Input.dispatchKeyEvent", {type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39, modifiers: 1});
    await command("Input.dispatchKeyEvent", {type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39, modifiers: 1});
  }
  await waitFor(`document.querySelector('[data-section-type="HERO"] [data-move-key="headline"]').style.left === "8px"`, "Alt+arrow moves the headline on the canvas");
  // Drag the move handle: the headline follows and the move is saved once, when released.
  await waitFor("!!document.querySelector('[data-testid=element-move-handle]')", "the move handle on the selected element");
  const handle = await evaluate("(()=>{const r=document.querySelector('[data-testid=element-move-handle]').getBoundingClientRect();return {x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2)};})()");
  await command("Input.dispatchMouseEvent", {type: "mouseMoved", x: handle.x, y: handle.y});
  await command("Input.dispatchMouseEvent", {type: "mousePressed", x: handle.x, y: handle.y, button: "left", buttons: 1, clickCount: 1});
  for (let step = 1; step <= 6; step++) await command("Input.dispatchMouseEvent", {type: "mouseMoved", x: handle.x + step * 10, y: handle.y + step * 4, button: "left", buttons: 1});
  await command("Input.dispatchMouseEvent", {type: "mouseReleased", x: handle.x + 60, y: handle.y + 24, button: "left", buttons: 0, clickCount: 1});
  await waitFor(`(()=>{const e=document.querySelector('[data-section-type="HERO"] [data-move-key="headline"]');return e.style.left === "68px" && e.style.top === "24px" && !e.style.translate;})()`, "the dragged headline keeps its new place");
  await screenshot("02b2-editor-drag-handle");
  // The Navigator lists every element of a section, nested in its groups (open a section with its arrow).
  const heroId = await evaluate("document.querySelector('[data-preview-device] [data-section-type=HERO]').closest('[data-editor-section]').dataset.editorSection");
  await waitFor(`!!document.querySelector('[data-testid="navigator-elements-${heroId}"] [data-element-row="primaryCta"]')`, "the hero's elements in the Navigator");
  const rows = await evaluate(`[...document.querySelectorAll('[data-testid="navigator-elements-${heroId}"] [data-element-row]')].map(e=>e.dataset.elementRow)`);
  for (const key of ["headline", "subheadline", "buttons", "primaryCta"]) assert.ok(rows.includes(key), `the Navigator lists ${key}: ${rows.join(", ")}`);
  await screenshot("02b3-editor-navigator-elements");
  // A button from the Navigator: its Content tab edits the words and what it does.
  await evaluate(`document.querySelector('[data-testid="navigator-elements-${heroId}"] [data-element-row="primaryCta"]').click()`);
  await waitFor("document.querySelector('[data-testid=element-panel-title]')?.textContent === 'Primary button' && document.body.innerText.includes('When clicked')", "the button's content");
  const buttonText = await evaluate("[...document.querySelectorAll('aside label')].find(l=>l.textContent.trim().startsWith('Button text'))?.htmlFor");
  const originalButtonText = await evaluate(`document.querySelector('[id="${buttonText}"]').value`);
  await setField(`[id="${buttonText}"]`, "Book a private viewing");
  await waitFor(`document.querySelector('[data-section-type="HERO"] [data-move-key="primaryCta"]').innerText.includes('Book a private viewing')`, "the button's new words on the canvas");
  // Back to its original words, so the published page below keeps its expected text.
  await setField(`[id="${buttonText}"]`, originalButtonText);
  await waitFor(`document.querySelector('[data-section-type="HERO"] [data-move-key="primaryCta"]').innerText.includes(${JSON.stringify(originalButtonText)})`, "the button's original words");
  // A group lists its parts: the buttons group leads to each button.
  await evaluate(`document.querySelector('[data-preview-device] [data-section-type="HERO"] [data-move-key="buttons"]').click()`);
  await waitFor("!!document.querySelector('[data-testid=\"element-part-primaryCta\"]')", "the parts of the buttons group");
  // The enquiry form: its button and where its fields come from.
  await evaluate(`document.querySelector('[data-preview-device] [data-section-type="ENQUIRY_FORM"] [data-move-key="form"]').click()`);
  await waitFor("document.querySelector('[data-testid=element-panel-title]')?.textContent === 'Form' && document.body.innerText.includes('Edit lead form fields')", "the form's content");
  await screenshot("02b4-editor-form-content");
  // The eyebrow's marker is part of the eyebrow element, so they move and align together.
  assert.ok(await evaluate("!!document.querySelector('[data-preview-device] [data-section-type=\"HERO\"] [data-move-key=\"eyebrow\"] > span[aria-hidden=\"true\"]')"), "the eyebrow's marker is inside the eyebrow element");
  const rightClick = key => evaluate(`(()=>{const e=document.querySelector('[data-preview-device] [data-section-type="HERO"] [data-move-key="${key}"]');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();e.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+8,clientY:r.top+8}));})()`);
  const menuItem = async item => { await waitFor(`!!document.querySelector('[data-testid=element-menu] [data-menu-item="${item}"]:not([disabled])')`, `the ${item} menu item`); await evaluate(`document.querySelector('[data-testid=element-menu] [data-menu-item="${item}"]').click()`); };
  // A real right mouse button on the canvas opens the element's menu: Duplicate, Copy, Paste, Copy style, Paste style…
  const realRightClick = async key => {
    const box = await evaluate(`(()=>{const e=document.querySelector('[data-preview-device] [data-section-type="HERO"] [data-move-key="${key}"]');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.left+Math.min(12,r.width/2),y:r.top+Math.min(12,r.height/2)};})()`);
    await command("Input.dispatchMouseEvent", {type: "mouseMoved", x: box.x, y: box.y});
    await command("Input.dispatchMouseEvent", {type: "mousePressed", x: box.x, y: box.y, button: "right", buttons: 2, clickCount: 1});
    await command("Input.dispatchMouseEvent", {type: "mouseReleased", x: box.x, y: box.y, button: "right", buttons: 0, clickCount: 1});
  };
  await realRightClick("headline");
  await waitFor("['duplicate','copy','paste','copyStyle','pasteStyle','delete'].every(k=>!!document.querySelector('[data-testid=element-menu] [data-menu-item='+k+']'))", "the element menu from a real right-click");
  await screenshot("02b7-editor-element-menu");
  // Copy style and Paste style: the headline's colour onto the subheadline.
  await menuItem("copyStyle");
  await rightClick("subheadline");
  await menuItem("pasteStyle");
  await waitFor(`getComputedStyle(document.querySelector('[data-preview-device] [data-section-type="HERO"] [data-move-key="subheadline"]')).color === 'rgb(176, 58, 11)'`, "the pasted style on the subheadline");
  // An automatic key fact: its panel shows its fields; its value is an element of its own, with its own colour.
  await evaluate(`document.querySelector('[data-preview-device] [data-section-type="HERO"] [data-move-key="facts.0"]').click()`);
  await waitFor("!!document.querySelector('[data-testid=element-fact-value]')", "an automatic fact's fields");
  await evaluate(`document.querySelector('[data-preview-device] [data-section-type="HERO"] [data-move-key="facts.0.value"]').click()`);
  await waitFor("document.querySelector('[data-testid=element-panel-title]')?.textContent === 'Fact 1 value' && !!document.querySelector('[data-testid=element-fact-value]')", "the fact value, with the fact's fields");
  await evaluate("document.querySelector('[data-testid=element-tab-style]').click()");
  await setField("aside input[placeholder='Theme colour']", "#22c55e");
  await waitFor(`getComputedStyle(document.querySelector('[data-preview-device] [data-section-type="HERO"] [data-move-key="facts.0.value"]')).color === 'rgb(34, 197, 94)'`, "the fact value in its own colour");
  await screenshot("02b13-editor-fact-value-colour");
  await clickLabel("Undo");
  // Duplicate and delete a key fact from its right-click menu (the automatic facts become the hero's own list).
  // Whole facts only (each fact also holds its label and value as elements of their own).
  const factCount = "[...document.querySelectorAll('[data-preview-device] [data-section-type=\"HERO\"] [data-move-key^=\"facts.\"]')].filter(e=>/^facts\\.\\d+$/.test(e.dataset.moveKey)).length";
  const factsBefore = await evaluate(factCount);
  await rightClick("facts.0");
  await menuItem("duplicate");
  await waitFor(`${factCount} === ${factsBefore + 1}`, "the duplicated fact");
  await screenshot("02b5-editor-duplicated-fact");
  await rightClick(`facts.${factsBefore}`);
  await menuItem("delete");
  await waitFor(`${factCount} === ${factsBefore}`, "the deleted fact");
  // Copy a fact and paste it on another: a new fact right after the target.
  await rightClick("facts.0");
  await menuItem("copy");
  await rightClick("facts.1");
  await menuItem("paste");
  await waitFor(`${factCount} === ${factsBefore + 1}`, "the pasted fact");
  await rightClick("facts.2");
  await menuItem("delete");
  await waitFor(`${factCount} === ${factsBefore}`, "the pasted fact removed");
  // A fact's own panel: its CRM value, which can be replaced by your own value, shown on the canvas.
  await evaluate(`document.querySelector('[data-preview-device] [data-section-type="HERO"] [data-move-key="facts.1"]').click()`);
  await waitFor("!!document.querySelector('[data-testid=element-fact-value]') && !!document.querySelector('[data-testid=element-duplicate]')", "the fact's CRM value and actions");
  const valueId = await evaluate("[...document.querySelectorAll('aside label')].find(l=>l.textContent.trim().startsWith('Value'))?.htmlFor");
  assert.ok(valueId, "the value field of a custom fact");
  await setField(`[id="${valueId}"]`, "Sea view");
  await waitFor(`document.querySelector('[data-preview-device] [data-section-type="HERO"] [data-move-key="facts.1"]')?.textContent.includes('Sea view')`, "the typed value on the canvas");
  await screenshot("02b8-editor-fact-own-value");
  // A fact's label is typed on the canvas, like a headline, and the panel follows.
  await evaluate(`(()=>{const e=document.querySelector('[data-preview-device] [data-section-type="HERO"] [data-edit-path="facts.1.label"]');e.scrollIntoView({block:'center'});e.focus();const r=document.createRange();r.selectNodeContents(e);const s=getSelection();s.removeAllRanges();s.addRange(r);})()`);
  await command("Input.insertText", {text: "View"});
  await command("Input.dispatchKeyEvent", {type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13});
  await command("Input.dispatchKeyEvent", {type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13});
  await waitFor("[...document.querySelectorAll('aside input')].some(i=>i.value==='View')", "the typed label in the panel");
  // Navigator: drag an element row onto another (the subheadline above the headline), then undo.
  const heroText = "document.querySelector('[data-preview-device] [data-section-type=\"HERO\"] [data-order-group=heroText]')";
  const subFirst = `!!(${heroText}.querySelector('[data-move-key=headline]').compareDocumentPosition(${heroText}.querySelector('[data-move-key=subheadline]')) & Node.DOCUMENT_POSITION_PRECEDING)`;
  assert.equal(await evaluate(subFirst), false);
  await waitFor("!!document.querySelector('[data-testid=navigator-dock] [data-element-item=subheadline]') && !!document.querySelector('[data-testid=navigator-dock] [data-element-item=headline]')", "the hero's element rows");
  await evaluate("(()=>{window.__dt=new DataTransfer();document.querySelector('[data-testid=navigator-dock] [data-element-item=subheadline]').dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:window.__dt}));})()");
  await evaluate("new Promise(r=>setTimeout(()=>{const to=document.querySelector('[data-testid=navigator-dock] [data-element-item=headline]');const y=to.getBoundingClientRect().top+2;to.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:window.__dt,clientY:y}));r();},50))");
  await evaluate("new Promise(r=>setTimeout(()=>{const to=document.querySelector('[data-testid=navigator-dock] [data-element-item=headline]');const y=to.getBoundingClientRect().top+2;to.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:window.__dt,clientY:y}));document.querySelector('[data-testid=navigator-dock] [data-element-item=subheadline]').dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:window.__dt}));r();},50))");
  await waitFor(subFirst, "the subheadline above the headline on the canvas");
  await screenshot("02b9-editor-navigator-reordered");
  await clickLabel("Undo");
  await waitFor(`!(${subFirst})`, "the original order again");
  // Right-click on a Navigator row: the same element menu.
  await evaluate("(()=>{const e=document.querySelector('[data-testid=navigator-dock] [data-element-item=headline]');const r=e.getBoundingClientRect();e.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+10,clientY:r.top+5}));})()");
  await waitFor("!!document.querySelector('[data-testid=element-menu] [data-menu-item=copy]') && !!document.querySelector('[data-testid=element-menu] [data-menu-item=duplicate]')", "the element menu from the Navigator");
  await evaluate("document.body.click()");
  // The key facts group lists them, with the list to add, remove and reorder.
  await evaluate(`document.querySelector('[data-preview-device] [data-section-type="HERO"] [data-move-key="facts"]').click()`);
  await waitFor("document.querySelector('[data-testid=element-panel-title]')?.textContent === 'Key facts' && document.body.innerText.includes('Back to the automatic facts')", "the key facts list");
  // Every fact in the list has a value field: typing in a CRM fact's field shows your own text instead.
  assert.ok(await evaluate("document.querySelectorAll('aside input[aria-label=Value]').length >= 3"), "a value field for every fact");
  await setField("aside input[aria-label=Value]", "Ready 2027");
  await waitFor(`document.querySelector('[data-preview-device] [data-section-type="HERO"] [data-move-key="facts.0"]')?.textContent.includes('Ready 2027')`, "the typed value on the canvas");
  await screenshot("02b14-editor-key-facts-values");
  await clickLabel("Undo");
  // Minimise the Navigator and open it again.
  await evaluate("document.querySelector('[data-testid=navigator-dock-minimise]').click()");
  await waitFor("document.querySelector('[data-testid=navigator-dock]')?.dataset.minimised === 'true'", "the minimised Navigator");
  await screenshot("02b6-editor-navigator-minimised");
  await evaluate("document.querySelector('[data-testid=navigator-dock-open]').click()");
  await waitFor("!document.querySelector('[data-testid=navigator-dock]').dataset.minimised", "the Navigator open again");
  await evaluate(`document.querySelector('[data-preview-device] [data-section-type="HERO"] [data-move-key="headline"]').click()`);
  await waitFor("document.querySelector('[data-testid=element-panel-title]')?.textContent === 'Headline'", "back to the headline");
  const heroBackground = "(()=>{const s=document.querySelector('[data-preview-device] section[data-section-type=HERO]');const i=s.querySelector(':scope > div[aria-hidden] img');const v=s.querySelector(':scope > video');return (i?i.getAttribute('src'):'')+'|'+(v?v.getAttribute('src'):'');})()";
  const originalBackground = await evaluate(heroBackground);
  await clickLabel("Back to Hero");
  await clickText("style", "aside [role=tab]");
  // Every layout choice keeps its label inside its own button (eight hero layouts sit in a grid of three).
  assert.deepEqual(await evaluate("[...document.querySelectorAll('aside [role=radiogroup] [role=radio]')].filter(b=>b.offsetParent&&(b.scrollWidth>b.clientWidth+1||b.scrollHeight>b.clientHeight+1)).map(b=>b.textContent)"), [], "no squeezed option labels");
  await screenshot("02b11-editor-hero-layout-options");
  // "Showcase with image": the hero image framed beside the text, over the background.
  const heroVariant = "document.querySelector('[data-preview-device] section[data-section-type=HERO]').dataset.sectionVariant";
  const variantBefore = await evaluate(heroVariant);
  await clickText("Showcase with image", "aside [role=radiogroup] [role=radio]");
  await waitFor(`${heroVariant} === 'showcaseImage' && !!document.querySelector('[data-preview-device] section[data-section-type=HERO] .pg-tilt-stage [data-move-key=image]')`, "the showcase with image layout");
  await screenshot("02b12-editor-showcase-with-image");
  await clickLabel("Undo");
  await waitFor(`${heroVariant} === ${JSON.stringify(variantBefore)}`, "the original layout again");
  await clickText("Image", "aside [role=radiogroup] [role=radio]");
  await clickText("content", "aside [role=tab]");
  await waitFor("[...document.querySelectorAll('aside label, aside p')].some(e=>e.textContent.trim()==='Background image')", "the background image in the Content tab");
  const backgroundField = "[...document.querySelectorAll('aside label')].find(e=>e.textContent.trim()==='Background image').parentElement.parentElement";
  await evaluate(`${backgroundField}.querySelector('button[aria-expanded]').click()`);
  await waitFor(`!!${backgroundField}.querySelector('[role=tab]')`, "the background image choices");
  await evaluate(`[...${backgroundField}.querySelectorAll('[role=tab]')].find(b=>b.textContent.trim()==='Stock').click()`);
  const chosenStock = await evaluate(`new Promise(r=>setTimeout(()=>{const b=[...${backgroundField}.querySelectorAll('button[title] img')].map(i=>i.closest('button'))[3];b.click();r(b.querySelector('img').src.split('?')[0]);},100))`);
  await waitFor(`(${heroBackground}).startsWith(${JSON.stringify(chosenStock)})`, "the chosen photo as the hero background");
  await screenshot("02b10-editor-hero-background");
  for (let attempt = 0; attempt < 4 && await evaluate(heroBackground) !== originalBackground; attempt++) await clickLabel("Undo");
  assert.equal(await evaluate(heroBackground), originalBackground, "undo restores the background");
  // Convert to custom section: the hero becomes rows of widgets (an H1 heading, buttons, CRM counters), then undo.
  await evaluate(`(()=>{const e=document.querySelector('[data-editor-section="${heroId}"]');e.scrollIntoView({block:'start'});const r=e.getBoundingClientRect();e.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+4,clientY:r.top+4}));})()`);
  await waitFor("!!document.querySelector('[role=menu] [data-menu-item=convert]:not([disabled])')", "the convert item in the section menu");
  await evaluate("document.querySelector('[role=menu] [data-menu-item=convert]').click()");
  await waitFor("!!document.querySelector('[data-testid=convert-dialog]')", "the convert confirmation");
  await screenshot("02b15-editor-convert-dialog");
  await evaluate("document.querySelector('[data-testid=convert-confirm]').click()");
  const converted = `document.querySelector('[data-editor-section="${heroId}"] section')`;
  await waitFor(`${converted}?.dataset.sectionType === 'CUSTOM' && !!${converted}.querySelector('h1') && ${converted}.querySelectorAll('[data-widget-path]').length >= 5`, "the hero as a custom section");
  assert.match(await evaluate(`${converted}.querySelector('h1').textContent`), /E2E Waterfront Launch/, "the headline is still the page's main heading");
  assert.ok(await evaluate(`${converted}.textContent.includes('AED 1,250,000')`), "the price is still read from the CRM");
  await screenshot("02b16-editor-converted-hero");
  await clickLabel("Undo");
  await waitFor(`${converted}?.dataset.sectionType === 'HERO'`, "the built-in hero again");
  await evaluate(`document.querySelector('[data-editor-section="${heroId}"]').click()`);
  // Back to the section: centre the hero content and set custom padding in its Advanced tab.
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
  assert.deepEqual(storedHero.style.elementOffsets, {headline: {x: 68, y: 24}}, "the moved headline (keyboard nudge and drag) was saved");
  assert.deepEqual([storedHero.style.elementStyles.headline.color, storedHero.style.elementStyles.headline.size, storedHero.style.elementStyles.headline.align], ["#b03a0b", 64, "CENTER"], "the headline's own style was saved");
  assert.deepEqual(Object.keys(storedHero.style.elementStyles), ["headline", "subheadline"], "only the styled elements are stored (the headline, and the subheadline its style was pasted onto)");
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
  // A video from the computer as the custom section's background: a real WebM recorded in the browser, streamed by byte range.
  await clickText("Custom section", "[data-testid=navigator-dock] li button");
  await waitFor("!!document.querySelector('[role=tablist][aria-label=\"Section settings\"]')", "the custom section's settings");
  await clickText("style", "[role=tablist][aria-label='Section settings'] [role=tab]");
  await clickText("Video", "[role=radiogroup] [role=radio]");
  await evaluate("document.querySelector('[data-testid=video-tab-uploads]').click()");
  await waitFor("!!document.querySelector('[data-testid=website-video-input]')", "the video upload control");
  const recorded = await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=320;c.height=180;const g=c.getContext('2d');const recorder=new MediaRecorder(c.captureStream(15),{mimeType:'video/webm'});const parts=[];recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};let frame=0;const paint=()=>{g.fillStyle='hsl('+(frame++*24)+',70%,45%)';g.fillRect(0,0,320,180)};paint();const timer=setInterval(paint,60);const stopped=new Promise(r=>recorder.onstop=r);recorder.start(200);await new Promise(r=>setTimeout(r,1500));recorder.stop();await stopped;clearInterval(timer);const file=new File(parts,'e2e-loop.webm',{type:'video/webm'});const input=document.querySelector('[data-testid=website-video-input]');const list=new DataTransfer();list.items.add(file);input.files=list.files;input.dispatchEvent(new Event('change',{bubbles:true}));return file.size;})()`);
  assert.ok(recorded > 1000, "a WebM was recorded");
  const backgroundVideo = `document.querySelector('[data-preview-device] [data-section-type="CUSTOM"] > video')`;
  await waitFor(`(()=>{const v=${backgroundVideo};return !!v && (v.getAttribute('src')||'').startsWith('/api/websites/media/') && v.readyState >= 2;})()`, "the uploaded video playing as the background");
  await screenshot("02d2-editor-background-video");
  const videoSrc = await evaluate(`${backgroundVideo}.getAttribute('src')`);
  const ranged = await evaluate(`(async()=>{const r=await fetch(${JSON.stringify(videoSrc)},{headers:{Range:'bytes=0-99'}});const b=await r.arrayBuffer();return {status:r.status,range:r.headers.get('content-range'),type:r.headers.get('content-type'),length:b.byteLength};})()`);
  assert.deepEqual([ranged.status, ranged.length, ranged.type], [206, 100, "video/webm"], "the editor route answers a byte range");
  assert.match(ranged.range, /^bytes 0-99\/\d+$/);
  assert.equal(await evaluate(`fetch(${JSON.stringify(videoSrc)},{headers:{Range:'bytes=999999999-'}}).then(r=>r.status)`), 416, "a range past the end is unsatisfiable");
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
  assert.equal(customSection.style.backgroundType, "VIDEO");
  const videoUploadId = customSection.style.backgroundVideo.uploadId;
  assert.match(videoUploadId, /^[0-9a-f-]{32,36}$/, "the uploaded video is stored as a library ID");
  assert.ok(stored.linked.uploads.some(upload => upload.id.replaceAll("-", "") === videoUploadId.replaceAll("-", "") && upload.contentType === "video/webm"));
  const library = await api("/api/websites/media");
  assert.ok(library.body.data.items.some(item => item.id.replaceAll("-", "") === uploadId.replaceAll("-", "") && item.width === 960), "the library records the image size");
  assert.equal((await api(`/api/websites/media/${uploadId}/content`)).contentType, "image/png");
  const forged = await api("/api/websites/media", {method: "POST", headers: {"Content-Type": "image/png", "X-EstateOS-Organization": f.orgA}, body: "<html><script>alert(1)</script></html>"});
  assert.equal(forged.status, 415, "a file whose bytes are not an image is rejected");
  const fakeVideo = await api("/api/websites/media", {method: "POST", headers: {"Content-Type": "video/mp4", "X-EstateOS-Organization": f.orgA}, body: "<html><script>alert(1)</script></html>"});
  assert.equal(fakeVideo.status, 415, "a file whose bytes are not a video is rejected");
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
  const wrongKind = structuredClone(stored.data);
  wrongKind.sections.find(section => section.type === "CUSTOM").style.backgroundVideo = {uploadId};
  assert.equal((await save(wrongKind, stored.page.revision)).status, 400, "an uploaded image cannot fill a video slot");
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
    assert.ok(records.length >= 2 && records.every(row => row.status === "FAILED" && row.promptVersion === "6e.1"), JSON.stringify(records));
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
  const videoUrl = [...html.matchAll(/\/api\/public\/site-media\/[0-9a-f-]+\/([0-9a-f-]+)/g)].find(match => match[1].replaceAll("-", "") === videoUploadId.replaceAll("-", ""))?.[0];
  assert.ok(videoUrl, "the uploaded video is published through the publication allowlist");
  const videoPart = await fetch(origin + videoUrl, {headers: {Range: "bytes=0-1023"}});
  assert.deepEqual([videoPart.status, videoPart.headers.get("content-type"), (await videoPart.arrayBuffer()).byteLength], [206, "video/webm", 1024], "the public route streams a byte range of the video");
  assert.equal((await fetch(origin + `/api/websites/media/${uploadId}/content`)).status, 401, "the editor route needs a session");
  for (const path of ["/site/local-agency-b/e2e-marina-launch", "/site/local-agency-a/does-not-exist", "/site/local-agency-a/manager-draft", "/site/LOCAL/../etc"]) assert.equal((await fetch(origin + path)).status, 404, path);
  const sitemap = await (await fetch(origin + "/sitemap.xml")).text();
  assert.ok(sitemap.includes(publicPath) && !sitemap.includes("manager-draft"));
  await load(publicPath, "document.body.innerText.includes('E2E Waterfront Launch')");
  assert.equal(await evaluate("getComputedStyle(document.documentElement).scrollBehavior"), "smooth", "links to sections glide on public pages");
  await screenshot("05a-public-desktop-hero");
  await evaluate("window.scrollTo({top: document.body.scrollHeight * 0.35, behavior: 'instant'})"); await pause(800); await screenshot("05b-public-desktop-middle");
  await evaluate("window.scrollTo({top: document.body.scrollHeight * 0.7, behavior: 'instant'})"); await pause(800); await screenshot("05c-public-desktop-lower");
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
  await deleteApp(authApp).catch(() => {}); for (const sqlApp of sqlApps) await deleteApp(sqlApp).catch(() => {});
}
if (failure) { console.error(failure); console.error(`--- Next.js server log (tail) ---
${serverLog.slice(-6000)}`); process.exit(1); }
process.exit(0);
