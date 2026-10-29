import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const [origin, executable, profile] = process.argv.slice(2);
if (!origin || new URL(origin).hostname !== "127.0.0.1" || !executable || !profile) throw new Error("Run node scripts/test-leads-ui.mjs to create the isolated component fixture.");
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const keepAlive = setInterval(() => {}, 1000);
mkdirSync(profile, { recursive: true });
const browser = spawn(executable, ["--headless=new", "--disable-gpu", "--no-proxy-server", "--no-first-run", "--disable-default-apps", "--disable-background-networking", "--disable-component-update", "--remote-debugging-port=0", "--user-data-dir=" + resolve(profile), "about:blank"], { windowsHide: true, stdio: "ignore" });
let socket;
let sequence = 0;
const requests = new Map();
const exceptions = [];
let checks = 0;
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { requests.delete(id); reject(new Error("Browser timeout: " + method)); }, 15000);
    requests.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression, description) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error("Timed out waiting for " + description + ": " + (await evaluate("document.body.innerText")).slice(-1600));
}
async function load(path, width = 1440) {
  await command("Emulation.setDeviceMetricsOverride", { width, height: 1100, deviceScaleFactor: 1, mobile: width < 768 });
  await command("Page.navigate", { url: origin + path });
  await waitFor(`!!document.querySelector('#fixture-ready[data-ready="true"]')`, "the real lead component to hydrate");
  await pause(250);
}
async function click(selector) {
  const point = await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getBoundingClientRect().width>0);if(!e)throw Error('No visible control: '+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
  await pause(150);
}
async function clickText(label, scope = "document") {
  const marker = "lead-ui-browser-control";
  await evaluate(`(()=>{const e=[...${scope}.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(label)}&&e.getBoundingClientRect().width>0&&!e.disabled);if(!e)throw Error('Missing visible action: '+${JSON.stringify(label)});e.setAttribute('data-browser-action',${JSON.stringify(marker)})})()`);
  await click(`[data-browser-action="${marker}"]`);
  await evaluate(`document.querySelector('[data-browser-action="${marker}"]')?.removeAttribute('data-browser-action')`);
}
async function fill(name, value) {
  await evaluate(`(()=>{const e=[...(document.querySelector('[role="dialog"]')??document).querySelectorAll('[name='+${JSON.stringify(JSON.stringify(name))}+']')].find(e=>e.getBoundingClientRect().width>0&&!e.disabled);if(!e)throw Error('Missing field '+${JSON.stringify(name)});const prototype=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
}
async function fixtureState() {
  return (await fetch(origin + "/fixture")).json();
}
async function screenshot(label) {
  const result = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const target = join(dirname(dirname(profile)), `phase4b-leads-${basename(executable)}-${label}.png`);
  writeFileSync(target, Buffer.from(result.data, "base64"));
  console.log("Screenshot: " + target);
}
async function rejectNext() {
  await fetch(origin + "/fixture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ failNext: true }) });
}
function pass(message) { checks++; console.log(`${basename(executable)}: ${message}`); }

try {
  let port;
  for (let attempt = 0; attempt < 150; attempt++) {
    try { const candidate = Number(readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]); if (Number.isInteger(candidate) && candidate > 0) { port = candidate; break; } } catch { /* Browser still starting. */ }
    await pause(100);
  }
  if (!port) throw new Error("The isolated test browser did not start.");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const pending = requests.get(message.id);
      if (!pending) return;
      requests.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error))); else pending.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  });
  await command("Page.enable");
  await command("Runtime.enable");

  await load("/leads");
  await screenshot("desktop");
  assert.equal(await evaluate(`['Total leads','New leads','Qualified leads','Won leads'].every(text=>document.body.innerText.includes(text))`), true);
  await clickText("Next");
  await waitFor(`new URL(location.href).searchParams.get('page')==='2'`, "server pagination navigation");
  await waitFor(`!![...document.querySelectorAll('a')].find(e=>e.textContent==='Fixture Prospect 12')`, "the second page's data");
  pass("KPI labels and server-rendered next page are available.");

  await load("/leads");
  await fill("search", "Fixture Prospect 12");
  await fill("priority", "NORMAL");
  await clickText("Apply filters");
  await waitFor(`new URL(location.href).searchParams.get('search')==='Fixture Prospect 12'`, "search/filter URL submission");
  assert.equal(await evaluate(`document.body.innerText.includes('Fixture Prospect 12')&&!document.body.innerText.includes('Fixture Prospect 11')`), true);
  assert.equal(new URL(await evaluate("location.href")).searchParams.get("page") ?? "1", "1");
  pass("Search and priority filters return matching rows and reset pagination.");

  await load("/leads");
  await clickText("Create lead");
  await waitFor(`!!document.querySelector('[role="dialog"] input[name="fullName"]')`, "the create lead dialog");
  const beforeValidation = (await fixtureState()).requests.length;
  await click('[role="dialog"] button[type="submit"]');
  await waitFor(`!!document.querySelector('[aria-invalid="true"]')`, "accessible validation errors");
  assert.equal((await fixtureState()).requests.length, beforeValidation, "Invalid form never sends a write request");
  pass("Invalid creation is rejected and identifies the invalid field accessibly.");

  const name = "Browser Prospect " + basename(executable);
  await fill("fullName", name);
  await fill("email", "browser@example.test");
  await fill("phone", "+971501234567");
  await fill("propertyInterest", "A residence for the family");
  await fill("preferredLocation", "Dubai Marina");
  await fill("budgetMin", "700000");
  await fill("budgetMax", "1100000");
  await fill("priority", "HIGH");
  await fill("initialNote", "Discuss a viewing next week.");
  await rejectNext();
  await click('[role="dialog"] button[type="submit"]');
  await waitFor(`document.body.innerText.includes('Fixture rejected the change.')`, "the server rejection message");
  assert.equal(await evaluate(`document.querySelector('[role="dialog"] input[name="fullName"]').value`), name);
  assert.equal((await fixtureState()).leads.some(lead => lead.fullName === name), false);
  pass("A rejected creation preserves entered values and shows an honest error.");

  await click('[role="dialog"] button[type="submit"]');
  await waitFor(`!document.querySelector('[role="dialog"]')`, "successful dialog completion");
  let state = await fixtureState();
  const lead = state.leads.find(lead => lead.fullName === name);
  assert.ok(lead, "Successful request contains the real form's values");
  const request = state.requests.findLast(request => request.path === "leads");
  assert.equal(request.body.budgetMin, 700000);
  assert.equal(request.body.budgetMax, 1100000);
  assert.equal(request.body.priority, "HIGH");
  assert.equal(request.body.initialNote, "Discuss a viewing next week.");
  assert.equal(request.organization, "10000000-0000-4000-8000-000000000001");
  assert.equal(request.csrf, "component-test-only");
  assert.equal("role" in request.body || "organizationId" in request.body, false);
  pass("Creation serializes rich CRM fields, company consistency and the existing CSRF exchange.");

  await load("/leads/" + lead.id);
  assert.equal(await evaluate(`document.querySelector('h1')?.textContent.includes(${JSON.stringify(name)})&&document.body.innerText.includes('Dubai Marina')`), true);
  assert.equal(await evaluate(`document.body.innerText.includes('Lead score')&&!!document.querySelector('[disabled]')`), true);
  await fill("note", "Confirmed the customer's preferred viewing time.");
  await clickText("Add note");
  await waitFor(`document.body.innerText.includes("Confirmed the customer's preferred viewing time.")`, "a saved note in the timeline");
  assert.equal((await fixtureState()).activities.some(entry => entry.leadId === lead.id && entry.note === "Confirmed the customer's preferred viewing time."), true);
  pass("The detail view displays property requirements, disabled AI score and a saved note.");

  await clickText("Edit lead");
  await waitFor(`!!document.querySelector('input[name="fullName"]')`, "the edit form");
  await fill("fullName", name + " Updated");
  await fill("budgetMax", "1250000");
  await click('[role="dialog"] button[type="submit"]');
  await waitFor(`!document.querySelector('input[name="fullName"]')`, "successful edit completion");
  state = await fixtureState();
  assert.equal(state.leads.find(row => row.id === lead.id).fullName, name + " Updated");
  assert.equal(state.leads.find(row => row.id === lead.id).budgetMax, 1250000);
  await load("/leads/" + lead.id);
  assert.equal(await evaluate(`document.querySelector('h1')?.textContent.includes('Updated')`), true);
  pass("Editing retains the record identity and the detail view reflects a reload.");

  await clickText("Change interested inventory");
  await clickText("Search", "document.querySelector('[role=dialog]')");
  await waitFor(`!![...document.querySelectorAll('[role="dialog"] option')].find(e=>e.textContent==='UI-UNIT-101')`, "authorized property choices");
  await evaluate(`(()=>{const e=document.querySelector('[role="dialog"] select[id$="-property"]');e.value='30000000-0000-4000-8000-000000000002';e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await waitFor(`document.querySelector('[role="dialog"] select[id$="-project"]').selectedOptions[0]?.textContent==='Fixture Marina Project'`, "the selected property's project");
  await clickText("Save interest");
  await waitFor(`!document.querySelector('[role="dialog"]')`, "primary interest saved");
  assert.equal((await fixtureState()).leads.find(row=>row.id===lead.id).primaryProperty.propertyReference, "UI-UNIT-101");
  pass("Primary property search selects its related project even when the project name was not in search results.");

  await rejectNext();
  await clickText("Save property");
  await waitFor(`document.body.innerText.includes('Fixture rejected the change.')`, "shortlist rejection");
  assert.equal((await fixtureState()).leads.find(row=>row.id===lead.id).propertyInterests?.length ?? 0, 0);
  await clickText("Save property");
  await waitFor(`document.body.innerText.includes('Interest & feedback')`, "saved property shortlist");
  await clickText("Interest & feedback");
  await fill("status", "INTERESTED");
  await fill("notes", "Customer wants a marina view.");
  await clickText("Save changes");
  await waitFor(`!document.querySelector('[role="dialog"]')`, "interest notes saved");
  state=await fixtureState();
  const savedInterest=state.leads.find(row=>row.id===lead.id).propertyInterests[0];
  assert.equal(savedInterest.status,"INTERESTED");
  assert.equal(savedInterest.notes,"Customer wants a marina view.");
  const shortlistRequest=state.requests.findLast(row=>row.path===`leads/${lead.id}/properties`);
  assert.ok(shortlistRequest.body.expectedUpdatedAt);
  assert.equal(shortlistRequest.organization,"10000000-0000-4000-8000-000000000001");
  assert.equal(shortlistRequest.csrf,"component-test-only");
  pass("Shortlist errors preserve state; interest/notes use CSRF, organization consistency and stale-write protection.");

  await clickText("Schedule viewing");
  const appointmentInput=new Date(Date.now()+2*86400000+4*3600000).toISOString().slice(0,16);
  await fill("scheduledAt",appointmentInput);
  await fill("notes","Meet in the reception lobby.");
  await fill("customerConfirmation","CONFIRMED");
  assert.equal(await evaluate(`document.querySelector('[role="dialog"] select[name="assignedMembershipId"]').value`),"10000000-0000-4000-8000-000000000002");
  await clickText("Schedule viewing","document.querySelector('[role=dialog]')");
  await waitFor(`!document.querySelector('[role="dialog"]')`, "viewing scheduled");
  state=await fixtureState();
  const scheduleRequest=state.requests.findLast(row=>row.path===`leads/${lead.id}/viewings`);
  assert.equal(scheduleRequest.body.assignedMembershipId,"10000000-0000-4000-8000-000000000002");
  assert.equal(scheduleRequest.body.customerConfirmation,"CONFIRMED");
  assert.equal(Date.parse(state.leads.find(row=>row.id===lead.id).propertyViewings[0].scheduledAt), Date.parse(appointmentInput+':00+04:00'));
  await load("/leads/"+lead.id);
  assert.equal(await evaluate(`document.body.innerText.includes('Meet in the reception lobby.')&&document.body.innerText.includes('Customer confirmed')&&document.body.innerText.includes('Assigned to Fixture Agent')`),true);
  await clickText("Update viewing");
  await fill("status","COMPLETED");
  await waitFor(`!!document.querySelector('[role="dialog"] select[name="outcome"]')`, "outcome field for a completed viewing");
  await fill("outcome","POSITIVE");
  await fill("notes","Customer attended and requested a second viewing.");
  await evaluate(`document.querySelector('[role="dialog"] input[name="createFollowUp"]').click()`);
  await waitFor(`!!document.querySelector('[role="dialog"] input[name="followUpAt"]')`, "follow-up fields");
  const followUpInput=new Date(Date.now()+3*86400000+4*3600000).toISOString().slice(0,16);
  await fill("followUpAt",followUpInput);
  await clickText("Save viewing");
  await waitFor(`!document.querySelector('[role="dialog"]')`, "viewing outcome saved");
  state=await fixtureState();
  const completed=state.leads.find(row=>row.id===lead.id).propertyViewings[0];
  assert.equal(completed.status,"COMPLETED"); assert.equal(completed.outcome,"POSITIVE");
  assert.equal(Date.parse(completed.followUp.dueAt), Date.parse(followUpInput+':00+04:00'));
  assert.equal(completed.followUp.title,"Follow up after viewing UI-UNIT-101");
  pass("Viewing scheduling records assignee and confirmation, converts Dubai time to UTC, survives reload and saves the outcome with a follow-up.");

  await clickText("Remove");
  await clickText("Remove from shortlist","document.querySelector('[role=dialog]')");
  await waitFor(`!document.querySelector('[role="dialog"]')&&document.body.innerText.includes('No saved properties yet')`, "shortlist removal");
  assert.equal(await evaluate(`document.body.innerText.includes('Customer attended and requested a second viewing.')`),true);
  await load("/leads/"+lead.id,375);
  await waitFor(`document.body.innerText.includes('Available matching properties')`, "mobile property panel");
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),true,"Mobile property panel must fit the viewport");
  await clickText("Change interested inventory");
  await waitFor(`!!document.querySelector('[role="dialog"]')`, "mobile primary interest dialog");
  assert.equal(await evaluate(`(()=>{const r=document.querySelector('[role="dialog"]').getBoundingClientRect();return r.width<=innerWidth&&r.left>=0})()`),true);
  pass("Removing a shortlist item keeps viewing history, and property controls fit mobile screens.");

  await load("/leads?view=KANBAN&pageSize=25");
  const cardSelector = `[data-lead-id="${lead.id}"]`;
  await waitFor(`!!document.querySelector(${JSON.stringify(cardSelector)})`, "a real kanban lead card");
  const moveSelector = cardSelector + " select";
  const stageId = "10000000-0000-4000-8000-000000000101";
  await rejectNext();
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(moveSelector)});e.value=${JSON.stringify(stageId)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await waitFor(`document.body.innerText.includes('Fixture rejected the change.')`, "the kanban rejection");
  assert.equal((await fixtureState()).leads.find(row => row.id === lead.id).pipelineStageId, "10000000-0000-4000-8000-000000000100");
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(cardSelector)})?.closest('[data-stage-id]')?.getAttribute('data-stage-id')`), "10000000-0000-4000-8000-000000000100");
  pass("A rejected optimistic Kanban move rolls the card back to its original stage.");

  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(moveSelector)});e.value=${JSON.stringify(stageId)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await waitFor(`document.querySelector(${JSON.stringify(cardSelector)})?.closest('[data-stage-id]')?.getAttribute('data-stage-id')===${JSON.stringify(stageId)}`, "the saved Kanban stage");
  await load("/leads?view=KANBAN&pageSize=25");
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(cardSelector)})?.closest('[data-stage-id]')?.getAttribute('data-stage-id')`), stageId);
  pass("The keyboard-accessible Kanban stage action sends a write and survives a reload.");

  await load("/leads", 375);
  await screenshot("mobile");
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`), true, "Mobile list must not overflow the viewport");
  await clickText("Create lead");
  await waitFor(`!!document.querySelector('[role="dialog"] input[name="fullName"]')`, "the mobile create dialog");
  assert.equal(await evaluate(`(()=>{const r=document.querySelector('[role="dialog"]').getBoundingClientRect();return r.width<=innerWidth&&r.left>=0})()`), true);
  await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor(`!document.querySelector('[role="dialog"]')`, "Escape dismissing the mobile dialog");
  pass("Mobile list/dialog fit the viewport and the dialog supports Escape.");

  assert.deepEqual(exceptions, [], "The lead components must not throw browser exceptions");
  console.log(`${basename(executable)}: ${checks} lead component browser scenarios passed. Synthetic UI responses only; database/auth boundaries are covered separately by SQL emulator tests.`);
} finally {
  socket?.close();
  clearInterval(keepAlive);
  if (browser.exitCode === null && process.platform === "win32") {
    try { execFileSync("taskkill", ["/PID", String(browser.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }); } catch { /* Already stopped. */ }
  } else browser.kill();
  if (browser.exitCode === null) {
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 3000);
      browser.once("exit", () => { clearTimeout(timer); resolve(undefined); });
    });
  }
}
