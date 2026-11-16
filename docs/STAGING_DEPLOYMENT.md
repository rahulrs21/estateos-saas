# Staging deployment runbook

**Status:** repository prepared (`apphosting.yaml`, `apphosting.staging.yaml`, the start-up guard, `.gitattributes`). **No cloud resource exists yet.**

- Every step marked **Approval** needs the owner's explicit go-ahead.
- Steps marked **Owner** are done by the account owner in a console.
- Nothing here touches the development project's database or a production project.

**Purpose:** EstateOS online all day with **synthetic data only**. The things that need it:
- WhatsApp webhooks;
- mail import;
- workflows;
- website enquiries.

**What staging never does:**
- send WhatsApp to real customers;
- email anyone but the test addresses;
- use Meta Lead Ads, Google Ads or TikTok;
- hold copies of local data.

## Architecture

```
Meta (test WhatsApp account) ─┐   Google / Microsoft sign-in ─┐   website forms ─┐
                              ▼                               ▼                  ▼
            App Hosting backend (Cloud Run, us-east4, 0–1 instances, Node 24)
              Next.js app, API routes, webhooks, /api/internal/automations/tick
              runtime service account (no key file) ──► SQL Connect ► Cloud SQL Postgres
                                                     ├─► Cloud Storage (rules deny all; server-only)
                                                     └─► Secret Manager
            Cloud Scheduler, every minute ──► POST /api/internal/automations/tick
```

**The single worker tick** (`src/modules/automations/server/http.ts`) does all background work in one bounded request:
- retries inbox events;
- imports mailboxes;
- downloads WhatsApp media;
- runs workflows;
- applies call and inbox retention.

All state is in PostgreSQL, with leases, idempotent steps and dead letters. No Cloud Tasks or separate worker service is needed, and no loop runs inside Next.js.

## Connectors

A hosted SQL Connect connector may hold at most **800 KB** of operation source. EstateOS's operations reached 877 KB, so they are split into two connectors in the same service:

| Connector | Folder | Holds | Generated SDK |
| --- | --- | --- | --- |
| `example` | `dataconnect/connector/` | CRM, inventory, AI, websites, automations, portals, rate limits | `@dataconnect/admin-generated` |
| `messaging` | `dataconnect/connector-messaging/` | inbox, WhatsApp, email, calls and meetings | `@dataconnect/admin-generated-messaging` |

**How the app uses them:**
- **One handle.** The server uses a single handle (`sqlConnectHandle()` in `src/lib/firebase/sql-connect-handle.ts`). It runs each operation on the connector that holds it, by operation name (`src/lib/firebase/connector-routing.mjs`).
- **Rules unchanged.** Every operation keeps its own `@auth` rules and impersonation.
- **Which SDK.** Inbox and communications code uses the messaging SDK (`src/modules/communications/server/data.ts`). The few calls that cross over import from the other package.
- **Two internal apps.** firebase-admin keeps one handle per app and service, so the messaging connector uses a second internal admin app with the same credentials.

`tests/connector-routing.test.mjs` checks three things:
- each connector stays under 720 KB, so split again before reaching the limit;
- the generated SDKs match the folders;
- no operation is in both connectors.

When a new module adds many operations, add a third connector in the same way.

## Start-up guard

When `ESTATEOS_ENVIRONMENT` is `staging` or `production`, the server refuses to start (`src/lib/environment/hosted-guard.ts`, called from `src/instrumentation.ts`) if:
- any emulator variable is set;
- a local-only switch is set: `ESTATEOS_DEV_TOOLS`, `INBOX_WHATSAPP_GRAPH_BASE`, or the test build variables;
- the server and browser Firebase projects differ, or a project is a `demo-` project;
- `APP_ORIGIN` is not the hosted https origin;
- a `REPLACE_ME` placeholder is still set;
- on staging, `INBOX_WHATSAPP_LIVE_SENDING=enabled` is set.

The error names variables only, never their values. Local development (`ESTATEOS_ENVIRONMENT` unset) is never checked.

## Secrets

**In Secret Manager.** Create them with `firebase apphosting:secrets:set NAME --project staging`, and type each value yourself. New values for staging; never copy `.env.local`.

| Secret | Value |
| --- | --- |
| `ANTHROPIC_API_KEY` | A staging key with a monthly spend limit in the Anthropic console |
| `INBOX_TOKEN_ENCRYPTION_KEY` | New: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `AUTOMATION_WORKER_SECRET` | New: `node -e "console.log(require('crypto').randomBytes(36).toString('base64url'))"` |
| `RATE_LIMIT_KEY_SECRET` | New, generated the same way |
| `INBOX_WHATSAPP_ACCESS_TOKEN` | A System User token for the **test** WhatsApp Business Account |
| `INBOX_WHATSAPP_APP_SECRET` | The Meta app secret (App settings → Basic) |
| `INBOX_WHATSAPP_APP_SECRET_VERIFY_TOKEN` | New random text; the same value is entered in Meta's webhook setup |
| `INBOX_WHATSAPP_TEST_RECIPIENTS` | The test phone numbers, comma-separated |
| `INBOX_GOOGLE_CLIENT_SECRET` | The Google OAuth client secret |
| `INBOX_MICROSOFT_CLIENT_SECRET` | The Entra app client secret |
| `INBOX_EMAIL_TEST_RECIPIENTS` | The test email addresses, comma-separated |

**Plain values** are in `apphosting.staging.yaml`: the project, the Firebase web config, the client IDs and the origin.

**Not used on staging:** `FIREBASE_ADMIN_PRIVATE_KEY` or `FIREBASE_ADMIN_CLIENT_EMAIL` (the backend's service account is used), `COMMS_*`, `INBOX_WHATSAPP_LIVE_SENDING`.

## Steps

### Step 1: push the code (Approval)

`git push origin main`. App Hosting builds from GitHub. The staging backend deploys from `main`.

### Step 2: the staging Firebase project (Owner, Approval)

1. Firebase console → **Add project** → `estateos-staging`. Analytics are optional (off).
2. Upgrade to **Blaze**. In Google Cloud Billing → Budgets, add a budget with alerts at $10, $25 and $50.
3. Project settings → **Add app** → Web. Note the web config values (public).
4. Locally: `firebase use --add` → choose the project → alias `staging`. This only edits `.firebaserc`.

### Step 3: Authentication (Owner)

Enable the same sign-in providers as development (Email/Password, Google). Create two or three staging test users.

### Step 4: database (Approval)

These commands must never be run against another project.

```powershell
firebase dataconnect:sql:diff --project staging     # read-only
firebase deploy --only dataconnect --project staging          # creates/links Cloud SQL "estateos-fdc" (choose the no-cost trial), applies the schema, deploys connector "example"
firebase dataconnect:sql:diff --project staging     # expect: no required changes
firebase deploy --only storage --project staging              # storage.rules: deny all browser access
```

- Read every warning, and **stop on any breaking-change assessment**.
- Decline every optional drop.
- Keep `schemaValidation: COMPATIBLE`.
- Never deploy `dataconnect/seed_data.gql`.
- Never run the test suites against staging.

### Step 5: fill the placeholders

In `apphosting.staging.yaml`, replace every `REPLACE_ME`:
- the project ID;
- the web API key and app ID from step 2;
- the Google and Microsoft client IDs.

`APP_ORIGIN` is filled after step 7 (the URL is known then). Commit, and push with approval. The guard refuses to start while any placeholder remains.

### Step 6: secrets (Owner, Approval)

Run `firebase apphosting:secrets:set NAME --project staging` for each secret in the table above. Grant access to the backend when asked.

### Step 7: App Hosting backend (Approval)

1. Firebase console → App Hosting → **Create backend**:
   - repository `rahulrs21/estateos-saas`, root `/`, live branch `main`, region `us-east4`;
   - **runtime `nodejs24`**.
2. Backend → Settings → Environment → **Environment name: `staging`**, so `apphosting.staging.yaml` is used.
3. The first rollout gives the URL. Put it in `APP_ORIGIN`, commit, push, then roll out again.

Next.js 16 is newer than App Hosting's officially listed versions (13.5–15.x). If the first build fails in the adapter, stop and fix it before continuing.

### Step 8: authorized domain and sign-in redirects (Owner)

- **Firebase Auth** → Settings → Authorized domains: add the staging host.
- **Google Cloud** → APIs & Services → Credentials → OAuth client:
  - add `https://<staging>/api/inbox/oauth/google/callback`;
  - the consent screen stays in **Testing**, with the test users listed. Refresh tokens then expire after 7 days, so reconnect Gmail weekly on staging.
- **Microsoft Entra** → App registration → Authentication → Web: add `https://<staging>/api/inbox/oauth/microsoft/callback`.

### Step 9: worker schedule (Approval)

```powershell
gcloud scheduler jobs create http estateos-staging-tick --project <staging> --location us-east4 `
  --schedule "* * * * *" --uri "https://<staging>/api/internal/automations/tick" --http-method POST `
  --headers "Authorization=Bearer <AUTOMATION_WORKER_SECRET>" --attempt-deadline 60s --max-retry-attempts 0
```

- **Typing the command:** type the secret yourself; it is not saved in your shell history if you paste it into a prompt.
- **Check it works:** one manual run (`gcloud scheduler jobs run …`) must return counts.
- **Before production:** switch to an OIDC token from a dedicated service account, and retire the shared secret.

### Step 10: WhatsApp test account (Owner)

1. In Meta, use a **test** WhatsApp Business Account or number, **not the live UAE number**.
2. In EstateOS staging → Inbox settings, add the WhatsApp channel with the secret names above.
3. Point **only that account** at staging, so local development keeps the app's default webhook:
   `POST /{test-waba-id}/subscribed_apps` with `override_callback_uri=https://<staging>/api/inbox/webhooks/whatsapp/<connectionId>` and `verify_token=<the verify token>`.
4. Click **Check connection**. Leave real customers **off**.

### Step 11: smoke test (synthetic data)

1. **Access and isolation:**
   - two test users each create a company prefixed "Staging Test";
   - neither can read the other's records;
   - an agent sees only their own.
2. **Leads:** a website form on a staging page creates a lead.
3. **WhatsApp:** a message from a test phone appears in the inbox. A reply reaches that phone only. A non-test number is refused.
4. **Email:** Gmail and Outlook test mailboxes import mail, and a reply reaches a test address only.
5. **Workflows:** a workflow runs from the scheduled tick.
6. **Logs:** Cloud Logging shows tick summaries with codes and **no secret values**.

### Step 12: costs

After 48 hours, review billing, then weekly.
- Cloud SQL stays on the trial for 3 months (changing its size ends the trial).
- Logs keep the default 30-day retention.

## Rollback

- **App Hosting:** roll back to the previous rollout in the console.
- **Database:**
  - take an on-demand backup before every later migration (`gcloud sql backups create --instance=estateos-fdc --project <staging>`);
  - to restore, restore into a **new** instance and compare first.
- **Shutting staging down:**
  - delete the Scheduler job;
  - remove the backend;
  - turn off the Cloud SQL instance, or delete it after an export.

## Related

- [HOSTED_DATABASE_PLAN.md](HOSTED_DATABASE_PLAN.md) (database and IAM detail)
- [AUTOMATION_OPERATIONS.md](AUTOMATION_OPERATIONS.md) (the worker)
- [WHATSAPP_INTEGRATION_PLAN.md](WHATSAPP_INTEGRATION_PLAN.md)
- [EMAIL_INTEGRATION_PLAN.md](EMAIL_INTEGRATION_PLAN.md)
- [App Hosting: configure](https://firebase.google.com/docs/app-hosting/configure)
- [App Hosting: multiple environments](https://firebase.google.com/docs/app-hosting/multiple-environments)
- [App Hosting: frameworks](https://firebase.google.com/docs/app-hosting/frameworks-tooling)
