# Phase 7D: Meta Lead Ads (plan)

Status: **7D.1** (data and webhook core) is live on staging. **7D.2** (connecting Pages, the settings screen, the 15-minute check and Import recent leads) is built and tested locally. 7D.3 to 7D.5 are not built. The 15-minute check and **Import recent leads**, planned for 7D.5, moved into 7D.2, because Meta sends no real webhooks while the app is unpublished.

## Built in 7D.1

- **Database** (`dataconnect/schema/lead-ads.gql`, operations in `dataconnect/connector/lead-ads.gql`, all server-only):
  - tables `MetaLeadConnection` (`pageId` unique across all companies), `MetaLeadForm` and `MetaLeadEvent` (`organizationId` + `leadgenId` unique);
  - new enum values: lead source `META_LEAD_ADS`, activity `AD_LEAD_CAPTURED` (plus three for connecting, disconnecting and form changes, used from 7D.2), and audit targets `META_LEAD_CONNECTION` and `META_LEAD_FORM`.
- **Webhook** `GET/POST /api/lead-ads/webhooks/meta` (`src/modules/lead-ads/server/webhook.ts`):
  - the GET answers Meta's subscription check;
  - the POST checks the signature, records each lead once, answers 200, then imports the lead just after the response.
- **Import** (`src/modules/lead-ads/server/process.ts`):
  1. reads the lead from Meta with the Page token (in the `Authorization` header, never in a URL);
  2. registers its form and lead source on first sight;
  3. maps the answers (`src/modules/lead-ads/meta.ts`);
  4. creates the lead with the same contact matching and round robin as website leads (shared in `lead-capture/server/intake.ts`), in one transaction that also marks the event processed.
- **What can go wrong, and what happens:**
  - Meta refuses the token: the event fails and the Page is marked "needs reconnect". It becomes active again when Meta answers.
  - Meta is unreachable, or rate-limits: the event is retried by the every-minute worker (1, 5, 15 and 60 minutes), then left dead.
  - The form is switched off, or the person left no email and no phone: the lead is recorded as ignored, not imported.
- **Lead page:** the timeline shows "Meta ad lead received · From a Facebook or Instagram lead ad". The full Ad enquiry card is 7D.4.
- **Tests:**
  - `npm run test:lead-ads`: signature, subscription check, parsing, mapping, budgets, error handling.
  - SQL Connect integration (`tests/sql-connect-lead-ads.cases.mjs`):
    - only owners and admins can connect;
    - a Page belongs to one company;
    - members cannot call these operations;
    - a lead is recorded once and created once;
    - no capture crosses companies;
    - failed leads are retried.
  - Inbox end-to-end (`INBOX_E2E_ONLY=lead-ads npm run test:inbox:e2e`): real signed webhooks against the app and a fake Graph API, including a revoked token, a redelivery, a form switched off and a lead with no contact details.

## Built in 7D.2

- **Settings → Meta Lead Ads** (`/settings/meta-lead-ads`, owners and admins only):
  - connected Pages with their status, forms, last lead and last check;
  - **Connect Facebook**, **Import recent leads**, **Reconnect** and **Disconnect** (with a confirmation);
  - leads that could not be imported.
- **Connecting** (`src/modules/lead-ads/server/connect.ts`):
  1. `POST /api/lead-ads/meta/connect` sets a sealed, single-use, 10-minute state cookie and opens Facebook's sign-in (`config_id` when `META_LEAD_ADS_LOGIN_CONFIG_ID` is set, otherwise the five permissions as `scope`).
  2. `GET /api/lead-ads/meta/callback` trusts only that sealed state, because the session cookie is SameSite=strict and isn't sent on Facebook's return. It re-checks the member's role and swaps the code for the person's long-lived token with the app secret.
  3. For every Page shared in Facebook's window, it seals the Page token for its connection, subscribes the Page (`leadgen`) and imports the last 7 days.
  - Pages that another company already uses are skipped.
  - The person's own token is never stored.
- **The safety net** (`server/poll.ts`):
  - every 15 minutes the worker reads each connected Page's active forms and their recent leads;
  - **Import recent leads** does the same for the last 7 days;
  - both work while the Meta app is unpublished, when Meta sends no real webhooks;
  - leads are recorded once, so a webhook, a check and an import never create two leads.
- **Disconnecting:** asks Meta to stop the Page's notifications, deletes the connection and its form settings, and keeps the leads and their lead source.
- **Database:**
  - one new column, `MetaLeadConnection.lastPolledAt`;
  - operations `MetaLeadOverview`, `ReconnectMetaLeadConnection`, `DisconnectMetaLeadConnection`, `MetaLeadConnectionsDue` and `MarkMetaLeadConnectionPolled`.
- **Tests:**
  - the SQL Connect cases cover roles, reconnecting the same Page only, disconnecting with its forms, and the due list;
  - the inbox end-to-end suite runs the whole flow in a browser against a fake Facebook sign-in and Graph API: connect, a Page another company already uses, import, the worker's check, a cancelled sign-in, a forged return, and disconnect.

**Owner steps for 7D.2 (Meta app EstateOS RE):**
1. Facebook Login for Business → **Settings** → Valid OAuth Redirect URIs: add `https://<staging>/api/lead-ads/meta/callback`.
2. Facebook Login for Business → **Configurations** → create one for Lead Ads:
   - token type: user access token;
   - assets: Pages;
   - permissions: the five listed below.

   Set its ID as `META_LEAD_ADS_LOGIN_CONFIG_ID`. It's a plain value, not a secret.

**Server settings:**
- `META_LEAD_ADS_VERIFY_TOKEN`: new, at least 16 random characters, a secret on hosted servers.
- The app secret: `META_APP_SECRET`, or `INBOX_WHATSAPP_APP_SECRET` (the same Meta app) if it is not set.
- The app ID: `META_APP_ID`, or `INBOX_META_APP_ID` (the same Meta app) if it is not set.
- `META_LEAD_ADS_LOGIN_CONFIG_ID`: the Login for Business configuration (optional; without it the permissions are asked for as `scope`).
- Test-only, ignored in production: `META_GRAPH_BASE` and `META_OAUTH_BASE`. Optional: `META_GRAPH_VERSION`.
- Without the verify token the subscription check answers 503; without the app secret the webhook does too.

## Goal

When someone submits an instant form on a Facebook or Instagram ad, a lead appears in the right EstateOS company within seconds, with:
- the form's answers;
- the Page, form, ad, ad set and campaign IDs it came from;
- the company's normal assignment rules applied.

Each company connects its own Facebook Pages from Settings, in the same way as Gmail and WhatsApp. EstateOS never asks for a Facebook password, and never stores a token in plain text.

## How it works

```
 Ad form submitted ──► Meta ──signed webhook (Page "leadgen")──► POST /api/lead-ads/webhooks/meta
                                                                    │ 1. verify X-Hub-Signature-256 (app secret)
                                                                    │ 2. store event, unique leadgen_id  → 200 OK fast
                                                                    ▼
                                  process now; retry from the every-minute tick if Meta or the database fails
                                                                    │ 3. page_id → the ONE company that connected that Page
                                                                    │ 4. GET /{leadgen_id} with that Page's token (encrypted at rest)
                                                                    │ 5. map answers → create contact + lead in one transaction
                                                                    ▼
                                       lead + "Ad lead received" activity + assignment + notification
 Safety net: every 15 minutes the tick reads each enabled form's recent leads (GET /{form_id}/leads)
             and imports any whose webhook never arrived. Idempotent by leadgen_id.
```

### 1. Connecting a Page (Facebook Login for Business)
- **Settings → Lead sources → Meta Lead Ads → Connect Facebook** (owner or admin only).
- This is a server-side OAuth code flow, with a sealed `state` cookie, as for Gmail and Outlook.
- The person picks the Pages to share.
- The server:
  1. exchanges the code for a user token, then for a long-lived token;
  2. reads `/me/accounts` for the chosen Pages' **Page tokens**;
  3. subscribes each Page to the app (`POST /{page-id}/subscribed_apps`, `subscribed_fields=leadgen`);
  4. stores each Page token **encrypted** with the existing token vault (AES-256-GCM, bound to the company and the connection), never returned by any query.
- **A Page can belong to only one company at a time.** Connecting a Page that another company already uses is refused, so leads can never land in two companies.
- **Disconnecting:**
  - unsubscribes the Page (`DELETE /{page-id}/subscribed_apps`);
  - deletes the stored token;
  - keeps the leads already created;
  - is written to the audit log, as is connecting.

### 2. Receiving leads
- **One app-wide webhook URL**, `/api/lead-ads/webhooks/meta`, because Meta allows only one callback URL per app for Page events.
  - Signatures are checked with the Meta app secret (the same app as WhatsApp).
  - The verify token is a new staging secret.
  - Body size is limited.
  - The company is never taken from the payload: it comes from the stored Page connection.
- Each `leadgen_id` is stored once per company (a unique key), so Meta retries and the 15-minute safety net cannot create duplicates.
- Failures are retried from the existing every-minute tick, with dead letters after repeated failures, like inbox events. Owners see failed leads in Settings with **Retry**.
- **Local development:**
  - the app's single webhook URL will point at **staging**;
  - locally, a development-only simulator (dev tools; off on hosted servers) feeds sample Meta payloads through the same code;
  - **Import recent leads** pulls real test leads on demand.

### 3. Turning an answer into a lead
- **Standard questions map to lead fields:** full name (or first and last name), email, phone number, city (preferred location).
- **Custom questions** ("Budget?", "Bedrooms?", "When are you buying?") are all kept in the lead's **Ad enquiry** card in the order they were asked, like the Website enquiry card. A form setting can map a custom question to budget, bedrooms, property type or buy/rent.
- **Each Meta form becomes a lead source,** "Meta · {form name}", for reports and the Source filter. It also gets settings: on/off and destination branch.
- **The same rules as website leads apply:**
  - exact email or phone match to one contact, otherwise a new contact;
  - round-robin assignment;
  - notifications;
  - the "New lead assignment" workflow.
- **Attribution stored:** page, form, ad, ad set and campaign IDs, `platform` (Facebook or Instagram), `is_organic`, and the time Meta created the lead. Ad and campaign *names* and spend belong to 7E and 7F (they need the ads permissions).
- Meta-side consent answers (`custom_disclaimer_responses`) are kept with the enquiry as evidence.

### 4. Settings screen (same style as the new Website lead forms page)
- **Connected Pages:** status (receiving, needs reconnect, error), last lead, Page and form count, Disconnect.
- **Forms table per Page:** status, leads received, last lead, on/off, branch, question mapping (side panel).
- **Failed leads:** reason, Retry, Dismiss.
- **Checklist:** Page connected → subscribed → CRM access → test lead received, with a link to Meta's Lead Ads Testing Tool.

## Data (additive SQL Connect schema; needs a staging database deploy, with approval)
- `MetaLeadConnection`: company, Page ID (unique while active), Page name, status, encrypted token and key ID, connected by, subscribed at, last lead at, last error, revision.
- `MetaLeadForm`: company, connection, Meta form ID, name, enabled, branch, field mapping (JSON), last synced at.
- `MetaLeadEvent`: company, leadgen ID (unique per company), Page and form IDs, status, attempts, last error (no personal data), lead ID.
- **New enum values (append-only):**
  - lead source type `META_LEAD_ADS`;
  - activity `AD_LEAD_CAPTURED`;
  - audit actions for connect and disconnect.
- **New operations:**
  - server-only (`NO_ACCESS`) for webhook processing;
  - member-scoped for settings, with owner and admin checks in the database.

## Security
- Signature check before anything is stored. The company comes from our stored connection, never from Meta's payload or the browser.
- Page tokens are encrypted at rest and never logged or returned. Webhook payloads aren't logged (they contain personal data); only IDs and outcome codes are.
- Least privilege: only the scopes listed below. Owner or admin to connect.
- Tests prove that a Page connected by company A can never create a lead in company B.
- Disconnecting, or Meta revoking access, stops imports. Token errors move the Page to "needs reconnect" and stop retries.
- Data deletion: the existing `/data-deletion` page covers it; a deletion callback can be added before going live.

## Meta permissions
`pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `leads_retrieval`, and `pages_manage_ads` (to list a Page's forms).
- **Development mode:** these work without App Review for people with a role on the app, which is enough for staging tests with the test Page.
- **Before other agencies can connect:** **App Review** with a screencast, plus **business_management** if Pages owned by a business portfolio need it; to be confirmed while building.

## What the account owner does (console steps; I'll guide each)
1. ✅ Create a test Page in the portfolio **Estate OS by Faza Home** (the verified one that owns the app). Done 2026-11-23: **"Estate OS test lead"** (Page ID 1537430489447687), full control for the account owner. Don't use the live Faza Home Page.
2. In the Meta app "EstateOS RE":
   - add **Facebook Login for Business**, with the staging and local redirect URLs;
   - add the **Webhooks → Page** subscription (field `leadgen`), with the staging URL and verify token.
3. Add the staging secret for the webhook verify token (you type the value).
4. If the portfolio restricts **Leads Access** (Business Settings → Integrations → Leads Access), allow the EstateOS RE app for the test Page.
5. Approve the staging database deploy for the new tables.

## Build steps (each tested, then shown to you before the next)
1. **7D.1 Data and webhook core:**
   - schema and operations;
   - signature check, event storage, processing and retries;
   - lead creation, with a fake Graph server for tests;
   - unit and emulator tests, including tenant isolation and duplicates.
2. **7D.2 Connect flow:**
   - Facebook Login, Page selection, subscription, encrypted tokens;
   - disconnect and audit.
3. **7D.3 Settings UI:** Pages, forms, mapping panel, failed leads, checklist; browser tests.
4. **7D.4 Lead page:** an Ad enquiry card (answers, platform, IDs) and the activity in the timeline; the Meta source in filters and reports.
5. **7D.5 Safety net and staging:** the 15-minute form poll and **Import recent leads**; deploy to staging; live test with the Testing Tool and a real test-Page form.

## Not in 7D
- Ad and campaign names, spend and cost per lead (7E, 7F).
- Creating or editing ads or forms from EstateOS.
- Sending conversions back to Meta (Conversions API for CRM; later).
- Google and TikTok lead forms (after Meta, using the same design).

## References
- [Leads webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/)
- [Retrieving leads](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/retrieving)
- [Webhooks for Lead Ads, CRM quickstart](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/quickstart/webhooks-integration.md)
- [Permissions reference](https://developers.facebook.com/documentation/development/permissions)
