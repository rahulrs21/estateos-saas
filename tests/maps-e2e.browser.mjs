import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { localDataConnect } from "../scripts/sql-connect-local.mjs";
import { fixture as f } from "./fixtures/sql-connect-fixtures.mjs";
import { generateScaleDataset, insertScaleDataset, SCALE } from "./sql-connect-map-scale.cases.mjs";

// Run through `npm run test:maps:e2e`, which starts isolated Auth and SQL
// Connect emulators. Everything here is synthetic, local-only data.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = process.env.ESTATEOS_E2E_WORKSPACE;
const executable = process.env.ESTATEOS_TEST_BROWSER;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!workspace || !executable || !authHost?.startsWith("127.0.0.1:") || process.env.GCLOUD_PROJECT !== "demo-estateos-test") {
  throw new Error("Run npm run test:maps:e2e; this script needs the isolated emulators it starts.");
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
// Reset only this suite's own emulator (fixed port and demo project), never
// dev:local or the integration-test database, then load the synthetic seed.
if (process.env.DATA_CONNECT_EMULATOR_HOST !== "127.0.0.1:19799") throw new Error("Refusing to reset an unexpected SQL Connect emulator.");
await dc.executeGraphql(seed, {operationName: "ResetEstateOS"});
await dc.executeGraphql(seed, {operationName: "SeedEstateOS"});
const dataset = generateScaleDataset(randomUUID().slice(0, 8));
await insertScaleDataset(dc, dataset);
const privacy = {
  approximate: {id: randomUUID(), latitude: 25.071234, longitude: 55.132345, reference: "E2E-APPROX"},
  hidden: {id: randomUUID(), latitude: 25.093456, longitude: 55.151234, reference: "E2E-HIDDEN"},
};
await dc.executeGraphql("mutation InsertPrivacy($data: [Property_Data!]!) { property_insertMany(data: $data) }", {variables: {data: [
  {organizationId: f.orgA, id: privacy.approximate.id, propertyReference: privacy.approximate.reference, propertyType: "APARTMENT", emirate: "DUBAI", community: "E2E Privacy",
    address: "E2E private street address 17", unitNumber: "1701", latitude: privacy.approximate.latitude, longitude: privacy.approximate.longitude, googlePlaceId: "ChIJ_e2e_private_place",
    mapDisplayMode: "APPROXIMATE", assignedMembershipId: f.memberAgentA, createdByUid: "owner-a", updatedByUid: "owner-a"},
  {organizationId: f.orgA, id: privacy.hidden.id, propertyReference: privacy.hidden.reference, propertyType: "VILLA", emirate: "DUBAI", community: "E2E Privacy",
    latitude: privacy.hidden.latitude, longitude: privacy.hidden.longitude, mapDisplayMode: "HIDDEN", assignedMembershipId: f.memberAgentA, createdByUid: "owner-a", updatedByUid: "owner-a"},
]}});
// Media regression fixtures: one record whose file is stored, one whose file
// is missing from Storage (the state left behind by lost emulator files).
const bucketName = "demo-estateos-test.appspot.com";
const media = {
  stored: {id: randomUUID(), fileName: "stored-photo.png", storagePath: `organizations/e2e/properties/${privacy.approximate.id}/stored.png`},
  missing: {id: randomUUID(), fileName: "missing-photo.png", storagePath: `organizations/e2e/properties/${privacy.approximate.id}/missing.png`},
  missingPdf: {id: randomUUID(), fileName: "missing-brochure.pdf", storagePath: `organizations/e2e/properties/${privacy.approximate.id}/missing.pdf`},
};
await dc.executeGraphql("mutation InsertMedia($data: [InventoryMedia_Data!]!) { inventoryMedia_insertMany(data: $data) }", {variables: {data: Object.values(media).map((item, index) => ({
  organizationId: f.orgA, id: item.id, propertyId: privacy.approximate.id, storagePath: item.storagePath, fileName: item.fileName,
  contentType: item.fileName.endsWith(".pdf") ? "application/pdf" : "image/png", byteSize: "68",
  mediaKind: item.fileName.endsWith(".pdf") ? "BROCHURE" : "PROPERTY_PHOTO", status: "ACTIVE", sortOrder: index, uploadedByUid: "owner-a",
}))}});
const storageApp = initializeApp({projectId: "demo-estateos-test", storageBucket: bucketName}, "maps-e2e-storage");
const bucket = getStorage(storageApp).bucket(bucketName);
await bucket.file(media.stored.storagePath).save(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"), {contentType: "image/png"});
const authApp = initializeApp({projectId: "demo-estateos-test"}, "maps-e2e-auth");
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
    ...process.env, NEXT_TELEMETRY_DISABLED: "1",
    // NODE_ENV=test makes Next skip .env.local, and __NEXT_PROCESSED_ENV stops
    // it applying any other .env file: only the emulator settings below are used.
    NODE_ENV: "test", __NEXT_PROCESSED_ENV: "true",
    ESTATEOS_NEXT_DIST_DIR: ".tmp/maps-e2e/next", ESTATEOS_TSCONFIG_PATH: ".tmp/maps-e2e/tsconfig.json",
    APP_ORIGIN: origin, FIREBASE_PROJECT_ID: "demo-estateos-test", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-estateos-test",
    NEXT_PUBLIC_FIREBASE_API_KEY: "demo-key", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "127.0.0.1", NEXT_PUBLIC_FIREBASE_APP_ID: "demo-app",
    RATE_LIMIT_BACKEND: "sql-connect", MAPS_PIN_QUERY_LIMIT: "500", FIREBASE_STORAGE_BUCKET: bucketName,
  },
});
server.stdout.on("data", data => { serverLog = (serverLog + data).slice(-20000); });
server.stderr.on("data", data => { serverLog = (serverLog + data).slice(-20000); });

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
async function viewport(width) {
  await command("Emulation.setDeviceMetricsOverride", {width, height: width < 768 ? 844 : 1100, deviceScaleFactor: 1, mobile: width < 768});
}
async function load(path, ready, width = 1440) {
  await viewport(width);
  await command("Page.navigate", {url: origin + path});
  await waitFor(`document.readyState === "complete" && location.pathname === ${JSON.stringify(new URL(origin + path).pathname)}`, `navigation to ${path}`);
  if (ready) await waitFor(ready, `${path} content`);
  await pause(700); // Allow hydration so client controls respond.
}
async function screenshot(label) {
  const result = await command("Page.captureScreenshot", {format: "png"});
  writeFileSync(join(screens, `${label}.png`), Buffer.from(result.data, "base64"));
}
const text = () => evaluate("document.body.innerText");
async function fill(name, value) {
  await evaluate(`(()=>{const e=document.querySelector('[name='+${JSON.stringify(JSON.stringify(name))}+']');if(!e)throw Error('Missing field '+${JSON.stringify(name)});
    const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
}
async function fillId(id, value) {
  await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
}
async function clickText(label, selector = "button,a") {
  await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim().startsWith(${JSON.stringify(label)})&&!e.disabled);if(!e)throw Error('Missing control: '+${JSON.stringify(label)});e.scrollIntoView({block:'center'});e.click();})()`);
}
async function api(path, init = {}) {
  return evaluate(`(async()=>{const init=${JSON.stringify(init)};
    if(init.method&&init.method!=='GET'){const c=await (await fetch('/api/auth/csrf')).json();init.headers={...(init.headers||{}),'Content-Type':'application/json','X-CSRF-Token':c.csrfToken};}
    const r=await fetch(${JSON.stringify(path)},init);let body=null;try{body=await r.json()}catch{}
    return {status:r.status,retryAfter:r.headers.get('retry-after'),body};})()`);
}
async function signIn(uid) {
  await command("Network.clearBrowserCookies");
  await load("/api/auth/session");
  const token = await idToken(uid);
  const result = await evaluate(`(async()=>{const c=await (await fetch('/api/auth/csrf')).json();
    const r=await fetch('/api/auth/session',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':c.csrfToken},body:JSON.stringify({idToken:${JSON.stringify(token)}})});
    return {status:r.status,body:await r.json()};})()`);
  assert.equal(result.status, 200, `session for ${uid}: ${JSON.stringify(result.body)}`);
  // Choose the company through the real workspace switcher, as a user does.
  await load("/onboarding/company?select=1", "[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Open workspace'))");
  await evaluate(`(()=>{const s=document.querySelector('form select');if(s&&!s.value){const o=[...s.options].find(o=>o.value);Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,o.value);s.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
  await pause(300);
  await clickText("Open workspace", "button");
  await waitFor("!location.pathname.startsWith('/onboarding')", "the selected workspace");
}
const noHorizontalScroll = () => evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1");

let failure;
try {
  // Wait for the dev server.
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
    } else if (message.method === "Page.javascriptDialogOpening") {
      void command("Page.handleJavaScriptDialog", {accept: true});
    } else if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  });
  await command("Page.enable"); await command("Runtime.enable"); await command("Network.enable");
  // Without a Google key the app draws maps with OpenStreetMap tiles. Block
  // every external map request so the test never calls a third-party service;
  // Leaflet still renders its map, markers and clusters.
  await command("Network.setBlockedURLs", {urls: ["*tile.openstreetmap.org*", "*maps.googleapis.com*", "*places.googleapis.com*"]});

  const community = dataset.community;
  const mapped = SCALE.exact + SCALE.approximate;

  // ------------------------------------------------------------ OWNER
  await signIn("owner-a");
  pass("OWNER signs in through the real session route with an Auth Emulator token");

  // Developer head office: create, persist, refresh, edit.
  const slug = "e2e-head-office-" + randomUUID().slice(0, 6);
  await load("/developers/new", "!!document.querySelector('[name=headOfficeLatitude]')");
  await fillId("location-search", "Downtown Dubai");
  await waitFor(`[...document.querySelectorAll('[role=alert]')].some(e=>e.textContent.includes('Address lookup is not configured'))`, "the not-configured lookup message");
  await waitFor("!!document.querySelector('[data-map-provider=osm][data-map-state=ready]')", "the OpenStreetMap fallback map");
  pass("Without keys, address search reports that lookup is not configured and the map falls back to OpenStreetMap");
  await fill("name", "E2E Head Office Developments"); await fill("slug", slug);
  await fill("headOfficeAddress", "Emaar Square, Downtown Dubai");
  await fill("headOfficeLatitude", "25.195"); await fill("headOfficeLongitude", "55.279");
  await waitFor("document.querySelectorAll('.estateos-map-pin').length === 1", "the head-office pin on the OpenStreetMap preview");
  pass("Typed coordinates place a pin on the OpenStreetMap preview");
  await screenshot("developer-form-desktop");
  await clickText("Create developer");
  await waitFor(`/^\\/developers\\/[0-9a-f-]{32,36}$/.test(location.pathname) && document.body.innerText.includes('Head office')`, "developer detail");
  const developerPath = await evaluate("location.pathname");
  await load(developerPath, "document.body.innerText.includes('Head office')");
  let body = await text();
  assert.ok(body.includes("Emaar Square, Downtown Dubai") && body.includes("Coordinates: 25.195, 55.279"), body.slice(0, 2000));
  assert.ok(await evaluate(`[...document.querySelectorAll('a')].some(a=>a.textContent.includes('Open in Google Maps')&&a.href.includes('query=25.195%2C55.279'))`));
  pass("Developer head-office address and coordinates persist after a refresh, with an Open in Google Maps link");
  await load(`${developerPath}/edit`, "!!document.querySelector('[name=headOfficeLatitude]')");
  assert.equal(await evaluate("document.querySelector('[name=headOfficeLatitude]').value"), "25.195");
  await fill("headOfficeLatitude", "25.2"); await fill("headOfficeLongitude", "55.28");
  await clickText("Save changes");
  await waitFor(`location.pathname === ${JSON.stringify(developerPath)}`, "return to developer detail");
  await load(developerPath, "document.body.innerText.includes('Head office')");
  assert.ok((await text()).includes("Coordinates: 25.2, 55.28"));
  pass("Editing the head-office pin persists the new coordinates");
  await load(`${developerPath}/edit`, "!!document.querySelector('[name=headOfficeLatitude]')");
  await fill("headOfficeLatitude", "51.5072"); await fill("headOfficeLongitude", "-0.1276");
  assert.ok((await text()).includes("outside the United Arab Emirates"));
  await clickText("Save changes");
  await waitFor(`document.body.innerText.includes('Review the highlighted fields')`, "validation error");
  assert.equal(await evaluate("location.pathname.endsWith('/edit')"), true);
  pass("A UAE developer cannot save a head office outside the UAE");

  // Project with an approximate location.
  await load("/projects/new", "!!document.querySelector('[name=projectName]')");
  await fill("developerId", await evaluate(`[...document.querySelectorAll('[name=developerId] option')].find(o=>o.textContent.includes('E2E Head Office'))?.value ?? ''`));
  await fill("projectName", "E2E Marina Project"); await fill("projectCode", "E2E-" + randomUUID().slice(0, 6));
  await fill("emirate", "DUBAI"); await fill("city", "Dubai"); await fill("community", "Dubai Marina"); await fill("address", "Marina Walk");
  await fill("latitude", "25.0712345"); await fill("longitude", "55.1323456");
  await evaluate("document.querySelector('input[name=mapDisplayMode][value=APPROXIMATE]').click()");
  await clickText("Create project");
  await waitFor(`/^\\/projects\\/[0-9a-f-]{32,36}$/.test(location.pathname)`, "project detail");
  const projectPath = await evaluate("location.pathname");
  await load(projectPath, "document.body.innerText.includes('Project location')");
  body = await text();
  assert.ok(body.includes("Approximate area") && body.includes("Exact stored coordinates (administrators only): 25.071235, 55.132346"), body.slice(0, 2500));
  pass("Project location saves with six-decimal coordinates and APPROXIMATE display; owners see the exact point");
  await load(`${projectPath}/edit`, "!!document.querySelector('[name=latitude]')");
  await evaluate("document.querySelector('input[name=mapDisplayMode][value=EXACT]').click()");
  await clickText("Save changes");
  await waitFor(`location.pathname === ${JSON.stringify(projectPath)}`, "project detail after edit");
  await load(projectPath, "document.body.innerText.includes('Project location')");
  assert.ok((await text()).includes("Exact pin"));
  pass("Editing the project's map visibility persists");

  // Property through the multi-step form.
  await load("/properties/new", "!!document.querySelector('[name=propertyReference]')");
  const propertyReference = "E2E-UNIT-" + randomUUID().slice(0, 6);
  await fill("propertyReference", propertyReference);
  await clickText("3.Location", "nav button");
  await fill("emirate", "DUBAI"); await fill("community", "Jumeirah Lake Towers");
  await fill("latitude", "25.0698"); await fill("longitude", "55.1416");
  await screenshot("property-location-step");
  assert.equal(await evaluate("document.querySelector('input[name=mapDisplayMode][value=APPROXIMATE]').checked"), true, "properties default to APPROXIMATE");
  // The submit button appears on the final step.
  await clickText("5.Media", "nav button");
  await waitFor("!!document.querySelector('form button[type=submit]')", "the property submit button");
  await evaluate("document.querySelector('form button[type=submit]').click()");
  await waitFor(`/^\\/properties\\/[0-9a-f-]{32,36}$/.test(location.pathname)`, "property detail");
  const propertyPath = await evaluate("location.pathname");
  await load(propertyPath, "document.body.innerText.includes('Map location')");
  body = await text();
  assert.ok(body.includes(propertyReference) && body.includes("Exact stored coordinates (administrators only): 25.0698, 55.1416"), body.slice(0, 2500));
  pass("Property location saves through the multi-step form and persists after refresh");

  // Media whose stored file is missing can be identified and deleted.
  await load(`/properties/${privacy.approximate.id}`, "document.body.innerText.includes('Property media')");
  await waitFor("document.querySelectorAll('[data-media-state=missing]').length === 2", "missing-file tiles for the image and the PDF");
  await waitFor("[...document.querySelectorAll('img')].some(img => img.alt === 'stored-photo.png' && img.complete && img.naturalWidth > 0)", "the stored photo");
  assert.equal((await api(`/api/inventory/media/${media.missing.id}/content`)).body.error.code, "MEDIA_FILE_MISSING");
  await screenshot("media-missing");
  pass("Media records whose files are missing show a File missing tile (image and PDF) instead of a broken image");
  for (const item of [media.missing, media.missingPdf, media.stored]) {
    await evaluate(`document.querySelector('[aria-label="Delete ${item.fileName}"]').click()`);
    await waitFor(`!document.querySelector('[aria-label="Delete ${item.fileName}"]')`, `deletion of ${item.fileName}`);
  }
  const mediaRows = await dc.executeGraphql(`query { inventoryMedias(where: {propertyId: {eq: "${privacy.approximate.id}"}}) { id status } }`);
  assert.ok(mediaRows.data.inventoryMedias.every(row => row.status === "DELETED"), JSON.stringify(mediaRows.data));
  assert.equal((await bucket.file(media.stored.storagePath).exists())[0], false, "the stored object is removed");
  pass("Owners can delete media through the gallery, including records whose files are missing");

  // Listing map at scale.
  const listingsMap = `/listings?view=map&community=${encodeURIComponent(community)}`;
  await load(listingsMap, "!!document.querySelector('[data-map-status]')");
  const status = await evaluate("document.querySelector('[data-map-status]').innerText");
  assert.ok(status.includes(`Showing 500 of ${mapped} mapped listings`), status);
  assert.ok(status.includes(`${SCALE.hidden} matching records have no coordinates or a hidden location`), status);
  assert.equal(await evaluate("document.querySelectorAll('[data-pin-id]').length"), 500);
  await waitFor("document.querySelectorAll('.estateos-map-cluster').length > 0", "clustered markers on the listing map");
  const clusterTotal = await evaluate("[...document.querySelectorAll('.estateos-map-cluster')].reduce((sum, e) => sum + Number(e.textContent.replace('k', '000')), 0) + document.querySelectorAll('.estateos-map-pin, .estateos-map-area').length");
  assert.ok(clusterTotal >= 400, `clusters and markers account for the loaded pins (${clusterTotal})`);
  await screenshot("listings-map-desktop");
  await clickText(`Load ${mapped - 500} more`);
  await waitFor(`document.querySelectorAll('[data-pin-id]').length === ${mapped}`, "the next page of pins");
  assert.ok((await evaluate("document.querySelector('[data-map-status]').innerText")).includes(`Showing ${mapped} of ${mapped}`));
  pass(`Listing map pages through ${mapped} mapped of ${mapped + SCALE.hidden} listings (limit 500) and states what is not shown`);
  await evaluate("document.querySelector('[data-pin-id] button').click()");
  await waitFor("!!document.querySelector('[data-pin-summary]')", "pin summary");
  assert.ok(await evaluate("document.querySelector('[data-pin-summary]').innerText.includes('Open')"));
  pass("Selecting a result opens its preview card");
  await load(`/listings?community=${encodeURIComponent(community)}`, "document.body.innerText.includes('listings')");
  assert.ok((await text()).includes(`${mapped + SCALE.hidden} listings match these filters`));
  pass("Table view still works with the same filters");

  // Listing upgrades: status bar, sort, cards, map focus, detail and workflow.
  const created = await api("/api/inventory/listings", {method: "POST", headers: {"X-EstateOS-Organization": f.orgA}, body: JSON.stringify({
    propertyId: privacy.approximate.id, listingReference: "E2E-WORKFLOW", listingPurpose: "SALE", marketType: "SECONDARY", title: "E2E workflow listing",
    askingPriceMinor: "185000000", currency: "AED", listingStatus: "DRAFT", publicationStatus: "NOT_PUBLISHED", assignedMembershipId: f.memberAgentA,
  })});
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const workflowId = created.body.data.propertyListing.id;
  await load(`/listings?community=${encodeURIComponent(community)}&sort=PRICE_DESC`, "!!document.querySelector('[data-listing-row]')");
  const prices = await evaluate("[...document.querySelectorAll('[data-listing-row] td:nth-child(5)')].map(td => Number(td.textContent.replace(/[^0-9.]/g, '')))");
  assert.deepEqual(prices, [...prices].sort((a, b) => b - a), "rows are sorted by price, highest first");
  assert.ok(await evaluate(`[...document.querySelectorAll('nav[aria-label="Listings by status"] a')].some(a => a.textContent.startsWith('Active') && Number(a.textContent.replace(/[^0-9]/g, '')) >= ${mapped + SCALE.hidden})`));
  pass("The listing table sorts on the server and the status bar shows counts per status");
  await load(`/listings?community=${encodeURIComponent(community)}&view=cards`, "!!document.querySelector('[data-listing-cards]')");
  assert.equal(await evaluate("document.querySelectorAll('[data-listing-cards] > *').length"), 25);
  pass("Cards view shows a page of listing cards");
  const firstPin = (await api(`/api/maps/pins?resource=listings&community=${encodeURIComponent(community)}`)).body.data.pins[0];
  const [focusId, focusTitle] = [firstPin.id, firstPin.title];
  await load(`/listings?view=map&community=${encodeURIComponent(community)}&focus=${focusId}`, "!!document.querySelector('[data-pin-summary]')");
  assert.ok((await evaluate("document.querySelector('[data-pin-summary]').innerText")).includes(focusTitle));
  pass("A table row's Map link opens the map with that listing selected");

  await load(`/listings/${workflowId}`, "document.body.innerText.includes('Status history')");
  body = await text();
  assert.ok(body.includes("Property location") && body.includes("Approximate area only"));
  assert.ok(body.includes("Exact stored coordinates (administrators only): 25.071234, 55.132345"), "owners see the exact point");
  assert.ok(body.includes("Listing created"));
  assert.ok(body.includes("Local agent-a"), "the listing agent is shown");
  for (const [action, next] of [["Submit for review", "Pending Review"], ["Approve", "Approved"], ["Activate", "Active"], ["Pause", "Paused"]]) {
    await clickText(action, "[aria-label='Listing workflow'] button");
    await waitFor(`[...document.querySelectorAll('[data-listing-history] li')].some(li => li.textContent.includes('→ ${next}'))`, `the ${next} step in the history`);
  }
  assert.ok(await evaluate("[...document.querySelectorAll('[aria-label=\"Listing workflow\"] button')].map(b => b.textContent.trim()).join('|') === 'Resume|Close|Archive'"));
  await screenshot("listing-detail");
  pass("Workflow buttons move a listing Draft → Review → Approved → Active → Paused and the history records each step");
  await load(`/properties?view=map&community=${encodeURIComponent(community)}`, "!!document.querySelector('[data-map-status]')");
  assert.ok((await evaluate("document.querySelector('[data-map-status]').innerText")).includes(`Showing 500 of ${mapped} mapped properties`));
  pass("Property map view uses the same server-side paging");

  // Viewport query through the API the map calls.
  const bounds = {south: 25.05, north: 25.1, west: 55.15, east: 55.2};
  const inside = dataset.properties.filter(row => row.mapDisplayMode !== "HIDDEN" && row.latitude >= bounds.south && row.latitude <= bounds.north && row.longitude >= bounds.west && row.longitude <= bounds.east);
  const viewportResult = await api(`/api/maps/pins?resource=listings&community=${encodeURIComponent(community)}&south=${bounds.south}&north=${bounds.north}&west=${bounds.west}&east=${bounds.east}`);
  assert.equal(viewportResult.status, 200, JSON.stringify(viewportResult.body));
  assert.equal(viewportResult.body.data.mapped, inside.length);
  assert.equal(viewportResult.body.data.pins.length, inside.length);
  assert.equal(viewportResult.body.data.mappedAll, mapped);
  assert.deepEqual(viewportResult.body.data.bounds, bounds);
  const serialized = JSON.stringify(viewportResult.body);
  assert.ok(!serialized.includes("googlePlaceId") && !/"latitude":\d/.test(serialized.replaceAll(/"location":\{[^}]*\}/g, "")), "no raw coordinates outside the presented location");
  for (const pin of viewportResult.body.data.pins.filter(pin => pin.location.precision === "APPROXIMATE")) {
    assert.equal(Math.round((pin.location.latitude * 100) % 1 * 1000) / 1000, 0.5, "approximate pins sit on grid-cell centres");
  }
  assert.equal((await api(`/api/maps/pins?resource=listings&south=26&north=25&west=55&east=56`)).status, 400);
  assert.equal((await api(`/api/maps/pins?resource=leads`)).status, 400);
  pass(`Viewport queries filter on the server (${inside.length} listings in the test area) and return only presented locations`);

  const ownerLookup = await api("/api/maps/autocomplete", {method: "POST", headers: {"X-EstateOS-Organization": f.orgA}, body: JSON.stringify({input: "Dubai Marina", sessionToken: randomUUID()})});
  assert.equal(ownerLookup.status, 503);
  assert.equal(ownerLookup.body.error.code, "MAPS_NOT_CONFIGURED");
  pass("Server lookups without GOOGLE_MAPS_SERVER_KEY return 503 MAPS_NOT_CONFIGURED (no Google request)");

  // Mobile layouts.
  for (const [path, ready] of [[listingsMap, "!!document.querySelector('[data-map-status]')"], [developerPath, "document.body.innerText.includes('Head office')"], ["/properties/new", "!!document.querySelector('[name=propertyReference]')"]]) {
    await load(path, ready, 390);
    assert.equal(await noHorizontalScroll(), true, `no horizontal scroll at 390px on ${path}`);
  }
  await load(listingsMap, "!!document.querySelector('[data-map-status]')", 390);
  await screenshot("listings-map-mobile");
  pass("Map, developer and property form layouts fit a 390px mobile viewport without horizontal scrolling");

  // ------------------------------------------------------------ AGENT
  await signIn("agent-a");
  await load(listingsMap, "!!document.querySelector('[data-map-status]')");
  const agentStatus = await evaluate("document.querySelector('[data-map-status]').innerText");
  assert.ok(agentStatus.includes(`Showing ${SCALE.assignedToAgent} of ${SCALE.assignedToAgent} mapped listings`), agentStatus);
  const agentPins = await api(`/api/maps/pins?resource=listings&community=${encodeURIComponent(community)}`);
  assert.equal(agentPins.body.data.total, SCALE.assignedToAgent);
  pass("AGENT map views contain only the agent's assigned listings");

  await load(`/properties/${privacy.approximate.id}`, "document.body.innerText.includes('Map location')");
  const agentHtml = await evaluate("fetch(location.href).then(r=>r.text())");
  for (const secret of ["25.071234", "55.132345", "ChIJ_e2e_private_place"]) assert.ok(!agentHtml.includes(secret), `agent HTML leaks ${secret}`);
  assert.ok((await text()).includes("Approximate area only"));
  const agentRecord = await api(`/api/inventory/properties/${privacy.approximate.id}`);
  assert.equal(agentRecord.status, 200);
  assert.deepEqual([agentRecord.body.data.latitude, agentRecord.body.data.longitude, agentRecord.body.data.googlePlaceId], [25.075, 55.135, null]);
  await load(`/properties/${privacy.hidden.id}`, "document.body.innerText.includes('Map location')");
  const hiddenHtml = await evaluate("fetch(location.href).then(r=>r.text())");
  assert.ok(!hiddenHtml.includes("25.093456") && !hiddenHtml.includes("55.151234"));
  assert.ok((await text()).includes("Location hidden from maps"));
  const hiddenRecord = await api(`/api/inventory/properties/${privacy.hidden.id}`);
  assert.deepEqual([hiddenRecord.body.data.latitude, hiddenRecord.body.data.longitude], [null, null]);
  pass("AGENT pages and API reads never contain exact APPROXIMATE or HIDDEN coordinates or place IDs");

  const agentLookup = await api("/api/maps/geocode", {method: "POST", headers: {"X-EstateOS-Organization": f.orgA}, body: JSON.stringify({address: "Dubai Marina"})});
  assert.equal(agentLookup.status, 403);
  await load("/developers/new", "document.readyState==='complete'");
  await pause(1500);
  assert.equal(await evaluate("!!document.querySelector('[name=headOfficeLatitude]')"), false);
  pass("AGENT cannot use address lookup or open location editors");

  await load(`/listings/${workflowId}`, "document.body.innerText.includes('Status history')");
  const agentListingHtml = await evaluate("fetch(location.href).then(r=>r.text())");
  for (const secret of ["25.071234", "55.132345", "ChIJ_e2e_private_place"]) assert.ok(!agentListingHtml.includes(secret), `agent listing HTML leaks ${secret}`);
  assert.equal(await evaluate("document.querySelectorAll('[aria-label=\"Listing workflow\"] button').length"), 0, "agents cannot resume, close or archive");
  const agentApprove = await api(`/api/inventory/listings/${workflowId}/status`, {method: "POST", headers: {"X-EstateOS-Organization": f.orgA}, body: JSON.stringify({expectedStatus: "PAUSED", status: "ACTIVE"})});
  assert.equal(agentApprove.status, 403);
  pass("AGENT listing pages hide exact coordinates and workflow steps reserved for administrators");

  // ------------------------------------------------------------ ADMIN
  await signIn("admin-a");
  const adminLookup = await api("/api/maps/reverse-geocode", {method: "POST", headers: {"X-EstateOS-Organization": f.orgA}, body: JSON.stringify({latitude: 25.2, longitude: 55.27})});
  assert.equal(adminLookup.body.error.code, "MAPS_NOT_CONFIGURED", "ADMIN passes authorization and reaches the provider check");
  const crossOrgLookup = await api("/api/maps/geocode", {method: "POST", headers: {"X-EstateOS-Organization": f.orgB}, body: JSON.stringify({address: "Dubai Marina"})});
  assert.notEqual(crossOrgLookup.status, 200);
  await load(`/properties/${privacy.approximate.id}`, "document.body.innerText.includes('Map location')");
  assert.ok((await text()).includes("Exact stored coordinates (administrators only): 25.071234, 55.132345"));
  pass("ADMIN may look up addresses for their own company only and sees exact stored coordinates");

  // Shared rate limit through the real app and database. Windows are fixed
  // minutes, so a burst can straddle two windows; 260 requests guarantee that
  // one window exceeds the 120-per-minute member limit.
  const burst = await evaluate(`Promise.all(Array.from({length: 260}, () => fetch('/api/maps/pins?resource=listings&community=${encodeURIComponent(community)}&south=25&north=25.01&west=55.1&east=55.11').then(r => ({status: r.status, retry: r.headers.get('retry-after')}))))`, 300000);
  const limited = burst.filter(item => item.status === 429);
  assert.ok(limited.length >= 20, `expected 429s, got ${JSON.stringify(burst.map(item => item.status))}`);
  assert.ok(limited.every(item => Number(item.retry) >= 1 && Number(item.retry) <= 60));
  assert.ok(burst.filter(item => item.status === 200).length <= 240, "at most one limit per window is allowed");
  const counters = await dc.executeGraphql(`query { rateLimitCounters(where: {scope: {eq: "maps.pins.member"}}) { hitCount } }`);
  assert.ok(counters.data.rateLimitCounters.some(row => row.hitCount >= 120), "counts are kept in the shared database");
  pass(`Map requests are rate limited through the shared SQL Connect store (${limited.length} of 260 burst requests got 429 with Retry-After)`);

  // ------------------------------------------------------------ OTHER COMPANY
  await signIn("owner-b");
  const foreign = await api(`/api/inventory/properties/${privacy.approximate.id}`);
  assert.ok([403, 404].includes(foreign.status) || foreign.body?.data == null, JSON.stringify(foreign));
  const foreignPins = await api(`/api/maps/pins?resource=properties&community=${encodeURIComponent(community)}`);
  assert.equal(foreignPins.body.data.total, 0);
  await load(`/properties/${privacy.approximate.id}`, "document.readyState==='complete'");
  await pause(1500);
  assert.ok(!(await evaluate("document.documentElement.outerHTML")).includes(privacy.approximate.reference));
  pass("Another company cannot read the first company's properties, pins or pages");

  assert.deepEqual(exceptions.filter(message => !/ResizeObserver/.test(message)), [], "no uncaught browser exceptions");
  console.log(`\n${checks} map end-to-end checks passed. Screenshots: ${screens}`);
} catch (error) {
  failure = error;
} finally {
  try { socket?.close(); } catch { /* closed */ }
  stop(browser); stop(server);
  await deleteApp(authApp).catch(() => {}); await deleteApp(storageApp).catch(() => {}); await deleteApp(sqlApp).catch(() => {});
}
if (failure) { console.error(failure); process.exit(1); }
process.exit(0);
