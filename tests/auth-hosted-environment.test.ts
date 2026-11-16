import assert from "node:assert/strict";
import { test } from "node:test";
import { assertHostedEnvironment, estateOsEnvironment, hostedEnvironmentProblems } from "../src/lib/environment/hosted-guard";

const staging = {
  ESTATEOS_ENVIRONMENT: "staging",
  FIREBASE_PROJECT_ID: "estateos-staging",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "estateos-staging",
  APP_ORIGIN: "https://estateos-staging--estateos-staging.us-east4.hosted.app",
};

test("local development and the browser tests are never checked", () => {
  assert.equal(estateOsEnvironment({}), "local");
  assert.deepEqual(hostedEnvironmentProblems({DATA_CONNECT_EMULATOR_HOST: "127.0.0.1:9399", ESTATEOS_DEV_TOOLS: "1", GCLOUD_PROJECT: "demo-estateos"}), [], "no ESTATEOS_ENVIRONMENT: local");
  assert.deepEqual(hostedEnvironmentProblems({ESTATEOS_ENVIRONMENT: "local", DATA_CONNECT_EMULATOR_HOST: "127.0.0.1:9399"}), []);
  assert.doesNotThrow(() => assertHostedEnvironment({}));
});

test("a correctly configured staging server starts", () => {
  assert.deepEqual(hostedEnvironmentProblems(staging), []);
  assert.deepEqual(hostedEnvironmentProblems({...staging, FIREBASE_ADMIN_PROJECT_ID: "estateos-staging", INBOX_WHATSAPP_LIVE_SENDING: ""}), []);
  assert.deepEqual(hostedEnvironmentProblems({...staging, ESTATEOS_ENVIRONMENT: "production", INBOX_WHATSAPP_LIVE_SENDING: "enabled"}), [], "production may reach real customers (the owner's switch still applies)");
});

test("a hosted server never starts against an emulator, the developer tools or a test fake", () => {
  for (const name of ["DATA_CONNECT_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "ESTATEOS_DEV_TOOLS", "INBOX_WHATSAPP_GRAPH_BASE"]) {
    const problems = hostedEnvironmentProblems({...staging, [name]: "127.0.0.1:9399"});
    assert.equal(problems.length, 1, name);
    assert.match(problems[0], new RegExp(`^${name} is set`));
  }
});

test("the server and the browser must use the same, real Firebase project, and the origin must be the hosted https one", () => {
  assert.match(hostedEnvironmentProblems({...staging, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "estateos-development-f8c93"}).join(" "), /different projects/);
  assert.match(hostedEnvironmentProblems({...staging, FIREBASE_ADMIN_PROJECT_ID: "estateos-production"}).join(" "), /FIREBASE_ADMIN_PROJECT_ID/);
  assert.match(hostedEnvironmentProblems({...staging, FIREBASE_PROJECT_ID: "demo-estateos", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-estateos"}).join(" "), /demo project/);
  assert.match(hostedEnvironmentProblems({...staging, FIREBASE_PROJECT_ID: ""}).join(" "), /FIREBASE_PROJECT_ID is not set/);
  assert.match(hostedEnvironmentProblems({...staging, APP_ORIGIN: "http://example.com"}).join(" "), /https origin/);
  assert.match(hostedEnvironmentProblems({...staging, APP_ORIGIN: "https://example.com/app"}).join(" "), /without a path/);
  assert.match(hostedEnvironmentProblems({...staging, APP_ORIGIN: "https://localhost:3000"}).join(" "), /this computer/);
});

test("staging never sends WhatsApp to real customers, and an unknown environment is refused", () => {
  assert.match(hostedEnvironmentProblems({...staging, INBOX_WHATSAPP_LIVE_SENDING: "enabled"}).join(" "), /never sends WhatsApp messages to real customers/);
  assert.equal(estateOsEnvironment({ESTATEOS_ENVIRONMENT: "prod"}), null);
  assert.deepEqual(hostedEnvironmentProblems({ESTATEOS_ENVIRONMENT: "prod"}), ["ESTATEOS_ENVIRONMENT must be local, staging or production."]);
});

test("a staging file whose placeholders were not filled in never starts", () => {
  const problems = hostedEnvironmentProblems({...staging, NEXT_PUBLIC_FIREBASE_APP_ID: "REPLACE_ME_STAGING_WEB_APP_ID", INBOX_GOOGLE_CLIENT_ID: "REPLACE_ME_GOOGLE_CLIENT_ID"});
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Placeholder values are still set \(INBOX_GOOGLE_CLIENT_ID, NEXT_PUBLIC_FIREBASE_APP_ID\)/);
  assert.ok(!problems[0].includes("REPLACE_ME_GOOGLE"), "names only");
});

test("the refusal names variables, never their values", () => {
  const secretLike = "do-not-print-this-value";
  const original = console.error;
  const logged: string[] = [];
  console.error = (...items: unknown[]) => { logged.push(items.map(String).join(" ")); };
  try {
    assert.throws(() => assertHostedEnvironment({...staging, DATA_CONNECT_EMULATOR_HOST: secretLike, NEXT_PUBLIC_FIREBASE_PROJECT_ID: secretLike}), (error: Error) => {
      assert.match(error.message, /EstateOS will not start \(staging\)/);
      assert.ok(!error.message.includes(secretLike));
      return true;
    });
  } finally { console.error = original; }
  assert.ok(logged.length === 1 && !logged[0].includes(secretLike), "the log line has names only");
});
