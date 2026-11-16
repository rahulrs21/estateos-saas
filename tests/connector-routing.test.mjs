import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import { operationNames, routedDataConnect } from "../src/lib/firebase/connector-routing.mjs";

const require = createRequire(import.meta.url);
const example = require("@dataconnect/admin-generated");
const messaging = require("@dataconnect/admin-generated-messaging");
const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
/** Operation names declared in a connector folder's .gql files. */
const declared = folder => new Set(readdirSync(join(root, "dataconnect", folder)).filter(file => file.endsWith(".gql"))
  .flatMap(file => [...readFileSync(join(root, "dataconnect", folder, file), "utf8").matchAll(/^[ \t]*(?:query|mutation) ([A-Za-z0-9_]+)/gm)].map(match => match[1])));

test("each connector stays under the hosted 800 KB limit, with room to grow", () => {
  for (const folder of ["connector", "connector-messaging"]) {
    const bytes = readdirSync(join(root, "dataconnect", folder)).filter(file => file.endsWith(".gql"))
      .reduce((total, file) => total + readFileSync(join(root, "dataconnect", folder, file)).length, 0);
    assert.ok(bytes < 720_000, `${folder} is ${bytes} bytes; split it further before it reaches 800 KB`);
  }
});

test("the operation names derived from each generated SDK are exactly the operations of its connector", () => {
  assert.equal(example.connectorConfig.connector, "example");
  assert.equal(messaging.connectorConfig.connector, "messaging");
  assert.deepEqual([...operationNames(example)].sort(), [...declared("connector")].sort());
  assert.deepEqual([...operationNames(messaging)].sort(), [...declared("connector-messaging")].sort());
  const both = [...operationNames(messaging)].filter(name => operationNames(example).has(name));
  assert.deepEqual(both, [], "no operation is in both connectors");
});

test("the handle runs each operation on its own connector and everything else on the primary", async () => {
  const calls = [];
  const fake = connector => ({
    connectorConfig: {connector}, app: {name: connector},
    executeQuery: async (name, variables, options) => { calls.push([connector, "query", name, variables, options]); return {data: connector}; },
    executeMutation: async (name, variables, options) => { calls.push([connector, "mutation", name, variables, options]); return {data: connector}; },
    useGen(value) { calls.push([connector, "useGen", value]); },
    insert(table) { return `${connector}:${table}:${this.connectorConfig.connector}`; },
  });
  const primary = fake("example"), other = fake("messaging");
  const dc = routedDataConnect(primary, [{names: new Set(["CreateInboxReplyDraft", "ListInboxMessages"]), dc: other}]);
  const options = {impersonate: {authClaims: {sub: "u1"}}};

  assert.equal(await dc.executeMutation("CreateInboxReplyDraft", {a: 1}, options).then(result => result.data), "messaging");
  assert.equal(await dc.executeQuery("ListInboxMessages", {b: 2}, options).then(result => result.data), "messaging");
  assert.equal(await dc.executeQuery("ListLeads", {c: 3}, options).then(result => result.data), "example");
  assert.equal(await dc.executeQuery("NotAnOperation", {}, options).then(result => result.data), "example", "an unknown name goes to the primary, which reports it");
  assert.deepEqual(calls.slice(0, 2).map(call => call[4]), [options, options], "the impersonation options travel with the call, unchanged");

  dc.useGen(true);
  assert.deepEqual(calls.filter(call => call[1] === "useGen").map(call => call[0]), ["example", "messaging"]);
  assert.equal("connectorConfig" in dc, true, "the generated SDK recognises it as a handle");
  assert.equal(dc.connectorConfig.connector, "example");
  assert.equal(dc.insert("membership"), "example:membership:example", "other methods run on the primary, bound to it");
});

test("a real generated function sends its operation through the handle to the right connector", async () => {
  const seen = [];
  const fake = connector => ({connectorConfig: {connector}, useGen() {}, executeQuery: async name => { seen.push([connector, name]); return {data: {}}; },
    executeMutation: async name => { seen.push([connector, name]); return {data: {}}; }});
  const dc = routedDataConnect(fake("example"), [{names: operationNames(messaging), dc: fake("messaging")}]);
  await messaging.listInboxMessages(dc, {organizationId: "o", conversationId: "c", limit: 1});
  await example.listLeads(dc, {organizationId: "o", limit: 1});
  assert.deepEqual(seen, [["messaging", "ListInboxMessages"], ["example", "ListLeads"]]);
});

test("an operation claimed by two routed connectors is refused", () => {
  const fake = () => ({executeQuery() {}, executeMutation() {}});
  assert.throws(() => routedDataConnect(fake(), [{names: new Set(["X"]), dc: fake()}, {names: new Set(["X"]), dc: fake()}]), /more than one routed connector/);
});
