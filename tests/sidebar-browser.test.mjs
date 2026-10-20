import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const [url, executable, profile] = process.argv.slice(2);
if (!url || new URL(url).hostname !== "127.0.0.1" || !executable || !profile) throw new Error("Run npm run test:sidebar to create the isolated fixture.");
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
mkdirSync(profile, { recursive: true });
const keepAlive = setInterval(() => {}, 1000);
const browser = spawn(executable, ["--headless=new", "--disable-gpu", "--no-proxy-server", "--no-first-run", "--disable-default-apps", "--disable-background-networking", "--disable-component-update", "--remote-debugging-port=0", "--user-data-dir=" + resolve(profile), "about:blank"], { windowsHide: true, stdio: "ignore" });
let socket;
let sequence = 0;
const requests = new Map();
const errors = [];
const apiRequests = [];
const header = "header [data-sidebar-toggle]";
let cases = 0;

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
async function click(selector) {
  const point = await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getBoundingClientRect().width>0);if(!e)throw Error('No visible control');const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{x,y,reachable:e.contains(document.elementFromPoint(x,y))}})()`);
  assert.equal(point.reachable, true, "A real pointer must reach " + selector);
  await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await command("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await pause(250);
}
async function state() {
  return evaluate(`(()=>{const b=document.querySelector('${header}'),desktop=document.querySelector('[data-slot="sidebar-container"]'),mobile=document.querySelector('[data-mobile="true"]');const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,width:r.width,display:getComputedStyle(e).display}};return {open:b.getAttribute('aria-expanded')==='true',controls:b.getAttribute('aria-controls'),targetExists:!!document.getElementById(b.getAttribute('aria-controls')),desktop:rect(desktop),mobile:rect(mobile),links:[...document.querySelectorAll('nav[aria-label="Workspace navigation"] a')].filter(e=>e.getBoundingClientRect().width>0).length}})()`);
}
async function load(width) {
  await command("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
  await command("Page.navigate", { url });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(`!!document.querySelector('#fixture-company-switch[data-fixture-ready="true"]')&&document.querySelector('${header}')?.getAttribute('aria-label')===${JSON.stringify(width < 768 ? "Open navigation" : "Collapse sidebar")}`)) break;
    await pause(100);
  }
  await pause(400);
}
async function assertOpen(mobile) {
  const current = await state();
  assert.equal(current.open, true);
  assert.equal(current.targetExists, true, "aria-controls points to visible navigation");
  assert.equal(current.links, 16);
  assert.ok((mobile ? current.mobile : current.desktop).width > 200, "Full labelled navigation is visible");
}

try {
  const portFile = join(profile, "DevToolsActivePort");
  let port;
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      const candidate = Number(readFileSync(portFile, "utf8").split("\n")[0]);
      if (Number.isInteger(candidate) && candidate > 0) { port = candidate; break; }
    } catch { /* Chrome may still hold the file while publishing its port. */ }
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
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
    else if (message.method === "Network.requestWillBeSent" && new URL(message.params.request.url).pathname.startsWith("/api/")) apiRequests.push(message.params.request.url);
  });
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Network.enable");

  for (const width of [1920, 1440, 768, 767, 375]) {
    await load(width);
    const mobile = width < 768;
    for (let company = 0; company < 2; company++) {
      for (let cycle = 0; cycle < 4; cycle++) {
        if ((await state()).open) {
          await click(mobile ? '[data-mobile="true"] button[aria-label="Close navigation"]' : header);
          assert.equal((await state()).open, false);
        }
        await click(header);
        await assertOpen(mobile);
        cases++;
      }
      await click(mobile ? '[data-mobile="true"] button[aria-label="Close navigation"]' : '[data-slot="sidebar-container"] button[aria-label="Collapse sidebar"]');
      if (!mobile) await click('[data-slot="sidebar-container"] button[aria-label="Expand sidebar"]');
      else await click(header);
      await assertOpen(mobile);
      if (mobile) await click('[data-mobile="true"] button[aria-label="Close navigation"]');
      await click("#fixture-company-switch");
      cases++;
    }
    console.log(`${basename(executable)}: ${width}px passed for both company contexts.`);
  }

  await load(1440);
  await evaluate(`(()=>{const b=document.querySelector('${header}');b.click();b.click()})()`);
  await pause(250);
  await assertOpen(false);
  cases++;

  // A sidebar preference must not become a functional dependency on cookies.
  await evaluate(`Object.defineProperty(document,'cookie',{configurable:true,get(){return ''},set(){throw new DOMException('UI preference blocked','SecurityError')}});true`);
  await click(header);
  await click(header);
  await assertOpen(false);
  await evaluate("delete document.cookie");
  cases++;

  await evaluate(`document.querySelector('${header}').focus()`);
  await command("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  await pause(250);
  assert.equal((await state()).open, false);
  await command("Input.dispatchKeyEvent", { type: "keyDown", key: "b", code: "KeyB", modifiers: 2, windowsVirtualKeyCode: 66 });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: "b", code: "KeyB", modifiers: 2, windowsVirtualKeyCode: 66 });
  await pause(250);
  await assertOpen(false);
  cases++;

  for (const width of [767.25, 767.5, 767.75]) {
    await evaluate(`(()=>{const f=document.createElement('iframe');f.id='fractional-test';f.src=${JSON.stringify(url)};f.style.cssText='position:fixed;left:0;top:0;width:${width}px;height:900px;border:0;z-index:200';document.body.append(f)})()`);
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(`!!document.querySelector('#fractional-test')?.contentDocument?.querySelector('#fixture-company-switch[data-fixture-ready="true"]')`)) break;
      await pause(100);
    }
    await pause(300);
    const open = await evaluate(`document.querySelector('#fractional-test').contentDocument.querySelector('${header}').getAttribute('aria-expanded')==='true'`);
    const presses = open ? 2 : 1;
    for (let i = 0; i < presses; i++) {
      const frame = await evaluate(`(()=>{const f=document.querySelector('#fractional-test'),b=f.contentDocument.querySelector('${header}'),r=b.getBoundingClientRect(),p=f.getBoundingClientRect();return {x:p.x+r.x+r.width/2,y:p.y+r.y+r.height/2}})()`);
      await command("Input.dispatchMouseEvent", { type: "mousePressed", x: frame.x, y: frame.y, button: "left", clickCount: 1 });
      await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: frame.x, y: frame.y, button: "left", clickCount: 1 });
      await pause(250);
    }
    assert.equal(await evaluate(`(()=>{const d=document.querySelector('#fractional-test').contentDocument,b=d.querySelector('${header}');return b.getAttribute('aria-expanded')==='true'&&[...d.querySelectorAll('nav[aria-label="Workspace navigation"] a')].filter(e=>e.getBoundingClientRect().width>0).length===16})()`), true);
    await evaluate("document.querySelector('#fractional-test').remove()");
    cases++;
  }
  assert.deepEqual(errors, [], "No browser exceptions");
  assert.deepEqual(apiRequests, [], "UI checks must not access authentication or database APIs");
  console.log(`${basename(executable)}: ${cases} sidebar checks passed (real pointer, two companies, mobile, fractional widths, rapid toggles, keyboard, blocked preference cookies).`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) await command("Browser.close").catch(() => {});
  socket?.close();
  clearInterval(keepAlive);
  browser.kill();
}
