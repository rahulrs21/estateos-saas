# Meta App Review: Lead Ads permissions (EstateOS RE)

The submission package for the Meta app **EstateOS RE** (App ID 1837332403959295), business portfolio **Estate OS by Faza Home**.

It asks for the permissions EstateOS needs so a real estate agency can connect its own Facebook Pages and receive the leads from its Facebook and Instagram lead ads in the EstateOS CRM.

- **Permissions:** `leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_manage_ads`.
- **When to submit:** after the pending WhatsApp review (submitted 2026-11-18) has its result. Then submit these as a new request, and publish the app once they're approved.
- **The text blocks** under "Copy this" are written for Meta's reviewers. Paste each into the matching box in **App Review → Requests → Edit** for that permission.

---

## 1. Before you submit (checklist)

- [ ] **Each permission has a recent API call.** In the app: **Use cases → Capture & manage ad leads → Customize → Permissions and features**. Each of the five should show that it has been used. EstateOS already used each one on staging between 23 and 24 November: connecting, listing forms, reading leads, and subscribing the Page.
  - If any shows no calls, do **Settings → Meta Lead Ads → ⋯ → Reconnect** and then **Import recent leads** once.
- [ ] **App settings → Basic** is complete:
  - app icon (1024 × 1024);
  - **Privacy Policy URL** `https://estateos-staging--estateos-staging.us-east4.hosted.app/privacy`;
  - **Terms of Service URL** `…/terms`;
  - **User data deletion**: instructions URL `…/data-deletion`;
  - category (Business and pages);
  - contact email support@fazahome.ae.
- [ ] **Business verification:** already approved for Estate OS by Faza Home.
- [ ] **Reviewer login:** the reviewer account used for the WhatsApp review still works on staging, as an Admin of the company **Demo Realty (Sample Data)**. Sign in with it once to check.
- [ ] **For the recording:** the test Page **Estate OS test lead** has the form **EstateOS test form 11/26**. In the Lead Ads Testing Tool, delete the old test lead so you can create a new one on camera.
- [ ] **Start the recording from a clean state:** in EstateOS, **Settings → Meta Lead Ads → ⋯ → Disconnect** the test Page (its leads stay), so the video shows connecting from the start.

---

## 2. Text for each permission (copy this)

### `leads_retrieval`

> EstateOS is a CRM for real estate agencies. An agency administrator connects the agency's own Facebook Page in EstateOS (Settings → Meta Lead Ads → Connect Facebook) using Facebook Login for Business, and chooses the Page in Facebook's dialog.
>
> We use leads_retrieval to read the leads submitted to that Page's lead forms (Facebook and Instagram lead ads), so that each lead becomes a lead record in the agency's CRM, assigned to an agent by the agency's distribution rules. We read the lead by its leadgen ID when our webhook is notified, and we also check the Page's active forms for recent leads every 15 minutes in case a notification is missed. We read the fields: field_data (the person's answers), created_time, form_id, ad_id, adset_id, campaign_id, platform, is_organic and custom_disclaimer_responses.
>
> The answers are shown to the agency's own staff on the lead's page ("Lead ad enquiry") so they can respond to the enquiry. Lead data is used only by the agency that owns the Page, inside its own EstateOS workspace; it is never shared with other agencies, sold, or used for advertising. A Page can be connected to only one agency at a time.

### `pages_show_list`

> When an agency administrator connects Facebook in EstateOS, we use pages_show_list (GET /me/accounts) to get the Pages the administrator chose to share in the Facebook Login for Business dialog, with each Page's name and Page access token. EstateOS connects exactly those Pages and shows their names in Settings → Meta Lead Ads, so the administrator can see which Pages are sending leads to the CRM. We do not list or use any Page the administrator did not choose.

### `pages_read_engagement`

> We use pages_read_engagement, together with pages_show_list and the Page access token, to read the basic details of the Pages the agency administrator connected (such as the Page name and ID), which EstateOS shows in Settings → Meta Lead Ads. Meta lists it as required for reading lead ads data with a Page access token. We do not read posts, comments or any other Page content.

### `pages_manage_metadata`

> We use pages_manage_metadata only to subscribe a connected Page to our app's "leadgen" webhook (POST /{page-id}/subscribed_apps with subscribed_fields=leadgen), so that new leads reach the agency's CRM within seconds, and to remove that subscription (DELETE /{page-id}/subscribed_apps) when the administrator clicks Disconnect in EstateOS. We do not change any other Page setting.

### `pages_manage_ads`

> We use pages_manage_ads to list the lead forms of a connected Page (GET /{page-id}/leadgen_forms, with each form's name, status and questions). EstateOS shows these forms in Settings → Meta Lead Ads, where the administrator can switch a form on or off, choose the branch its leads go to, and choose which question fills which CRM field (for example "What is your budget?" → Budget). The form list is also used to check each active form for recent leads every 15 minutes. We do not create, edit or delete forms, ads or campaigns.

---

## 3. Screencast script (one video for all five permissions)

**Recording tips:**
- Record in English, at 1080p if you can, and keep it under 5 minutes.
- Keep the browser's address bar visible.
- No voice is needed. Add short on-screen captions (in the screen recorder, or afterwards). The captions below are what each one should say.
- Never show a password, a token or a real customer.

| # | What to do | Caption on screen |
| --- | --- | --- |
| 1 | Open `https://estateos-staging--estateos-staging.us-east4.hosted.app` and sign in as the company admin. | "An agency administrator signs in to EstateOS (CRM for real estate agencies)." |
| 2 | Go to **Settings → Meta Lead Ads**. It's empty, with "No Facebook Page connected yet". | "The admin connects the agency's Facebook Page to receive its lead ads." |
| 3 | Click **Connect Facebook**. Facebook's Login for Business dialog opens. **Pause on the permissions screen** so all five permissions are readable. | "Facebook Login for Business asks for: pages_show_list, pages_read_engagement, pages_manage_metadata, pages_manage_ads, leads_retrieval." |
| 4 | Choose **only** the Page **Estate OS test lead**, then continue. | "The admin chooses which Page to share. Only this Page is connected." |
| 5 | The return page shows **"Connected: Estate OS test lead"**, then Settings opens. | "pages_show_list: EstateOS connects the Page the admin chose." |
| 6 | Show the Page row: name, **Receiving leads**, and the **forms table** with "EstateOS test form 11/26". | "pages_manage_metadata: the Page is subscribed to our leadgen webhook. pages_manage_ads: its lead forms are listed." |
| 7 | Click **Edit** on the form. Show the panel: on/off, branch, and **Budget → "What's your Budget?"**. Click **Save**. | "pages_manage_ads: the admin chooses how each form's questions fill the CRM." |
| 8 | In a new tab, open the **Lead Ads Testing Tool** (`developers.facebook.com/tools/lead-ads-testing`). Choose the Page and form, then click **Create lead**. | "A test lead is submitted to the Page's lead form." |
| 9 | Back in EstateOS, click **Import recent leads**. The message "1 new lead imported from Estate OS test lead" appears. | "leads_retrieval: EstateOS reads the new lead from the Page's form." |
| 10 | Open **Leads**. The new lead is at the top, with source "Meta - EstateOS test form…". Open it. | "The lead is now in the agency's CRM, ready to be assigned and followed up." |
| 11 | Scroll to the **Lead ad enquiry** card. Show the answers, then open **Ad details from Meta**. | "leads_retrieval: the person's answers and the form and lead IDs are shown to the agency's staff." |
| 12 | Back in **Settings → Meta Lead Ads**, open **⋯ → Disconnect** and confirm. | "pages_manage_metadata: disconnecting removes the webhook subscription. The agency's existing leads stay." |

When you've finished recording, connect the Page again (**Connect Facebook**) so leads keep arriving on staging.

Upload the same video for each of the five permissions in the submission.

---

## 4. How reviewers can test (copy this into "Testing instructions")

> EstateOS is a web CRM. Test environment: https://estateos-staging--estateos-staging.us-east4.hosted.app
>
> 1. Sign in with the reviewer account provided below. It is an administrator of the sample company "Demo Realty (Sample Data)", which contains only fictional data.
> 2. Go to Settings → Meta Lead Ads and click "Connect Facebook". Sign in with a Facebook account that administers a Page with a lead form, and choose that Page in Facebook's dialog.
> 3. EstateOS shows the Page as "Receiving leads" and lists its lead forms. Click "Edit" on a form to see the form settings (on/off, branch, question mapping).
> 4. Create a test lead for that Page and form with the Lead Ads Testing Tool: https://developers.facebook.com/tools/lead-ads-testing
> 5. In EstateOS click "Import recent leads" (EstateOS also checks every 15 minutes, and receives the leadgen webhook once the app is live). Open Leads: the new lead is at the top. Open it to see the "Lead ad enquiry" card with the answers from the form.
> 6. Settings → Meta Lead Ads → "⋯" → Disconnect removes the Page and its webhook subscription.
>
> Reviewer login: [the reviewer account email and password, as entered for the WhatsApp review]

Paste the reviewer email and password into Meta's form only, never into this file.

---

## 5. Data handling (for the data use questions)

- **What we store:**
  - the lead's answers, which become a CRM lead in the agency's own workspace;
  - Meta's IDs for the lead, form, ad, ad set and campaign;
  - each connected Page's **Page access token**, encrypted at rest (AES-256-GCM, bound to the agency and the connection) and never shown to users or included in logs.

  The administrator's own Facebook user token is used once during connecting and is **not stored**.
- **Who can see it:** only the members of the agency that connected the Page, under EstateOS's role rules. Agents see the leads assigned to them. Each Page belongs to one agency only, and agencies are isolated from each other.
- **Not shared or sold:** lead data isn't shared with third parties, sold, or used for advertising or profiling.
- **Deletion:**
  - an administrator can disconnect a Page at any time, which removes its token and the webhook subscription;
  - the agency can archive leads in the CRM;
  - people can request deletion of their data through the instructions at `/data-deletion`.
- **Security:**
  - webhook requests are verified with the app secret signature (X-Hub-Signature-256);
  - credentials are kept on the server only;
  - every connect and disconnect is written to the agency's audit log.

---

## 6. After approval

1. Publish the app (**Publish** in the app dashboard).
2. In the Lead Ads Testing Tool, create a test lead and click **Track status**. It should show **Success**, and the lead should appear in EstateOS within seconds, without clicking Import.
3. Other agencies can then connect their own Pages from Settings → Meta Lead Ads.
4. Before production: move the legal URLs and the app's redirect and webhook URLs from staging to the production domain.
