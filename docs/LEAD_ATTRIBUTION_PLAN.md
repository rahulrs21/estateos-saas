# Phase 7E: lead source attribution (plan)

Status: **7E.1 built** (capture); its database change is deployed to staging (2026-11-24). Decisions taken: keep click IDs, one touch per lead, and an optional Campaign field on manual leads (7E.3).

## Built in 7E.1

- **Data:**
  - `dataconnect/schema/attribution.gql`: the enum `LeadChannel` and the table `LeadAttribution`, one row per lead, removed with its lead;
  - `GetLeadAttribution`: a member read with the lead's own visibility (its assigned agent, or an owner or admin).
- **Written with the lead, in the same transaction:**
  - `SubmitWebsiteLeadCapture` (website forms and landing pages), with new variables whose defaults keep older callers working;
  - `CaptureMetaLeadAd` (Meta lead ads).
- **Rules** (`src/modules/lead-capture/attribution.ts`, pure, unit-tested):
  - URLs keep host and path only;
  - click IDs must look like click IDs;
  - campaign names are grouped by `campaignKey`;
  - the platform comes from the click ID, then `utm_source`, then the referring site (a search engine is organic; another site is a referral; nothing is direct);
  - the agency's own site is never its own referrer.
- **First touch** (`src/modules/lead-capture/first-touch.ts`):
  - hosted forms and published landing pages remember the first visit (UTM tags, click IDs, landing page, referrer) for 30 days in the site's own browser storage;
  - a campaign visit replaces a stored visit that had no campaign;
  - storage that is blocked falls back to the current page.
- **The new embed code:**
  - `<div data-estateos-form data-src=…>` plus `/embed/lead-form.js` builds the iframe and adds the host page's UTM tags and click IDs, its address without a query (`eo_page`) and the host page's referrer origin (`eo_ref`);
  - only this server's own `/forms/…` are embedded;
  - **Copy embed code** gives the new code, old iframe codes keep working, and pasting the new code into the page editor still connects the form.
- **Meta:**
  - the lead is read with `campaign_name`, `adset_name` and `ad_name`;
  - if Meta refuses those fields, it's read again without them, so an import never fails over the names, and the campaign is grouped by its ID.
- **Privacy page:** it now names Meta lead ads and the first-touch memory.

## Goal

For every lead, EstateOS records **where it came from**:
- the channel: website form, landing page, Meta lead ad, a WhatsApp ad, or a lead added by hand;
- the campaign, ad set and ad;
- the UTM tags and click IDs;
- the landing page.

Agencies can then see, per channel and per campaign, how many leads came in and how many were won. This is the base for 7F (campaigns and cost per lead).

## What exists today (and its gaps)

| Source | Captured now | Gap |
| --- | --- | --- |
| Hosted website form (`/forms/…`) | UTM tags from the form URL or the referrer, and the landing page, in `LeadCaptureSubmission` | Not shown anywhere. Lost when a visitor lands on page A with UTMs and submits on page B. No referrer host, no click IDs (`gclid`, `fbclid`, `ttclid`). |
| Form embedded on another site (iframe) | Only the embedding site's origin, because the browser hides the parent page's query string from the iframe | **The UTM tags of the agency's own site are lost.** |
| Landing pages (`/site/…`) | UTM tags from the page URL | Same: not shown, nothing kept across pages. |
| Meta lead ads (7D) | Campaign, ad set, ad and form IDs, platform and organic, in the activity's metadata | Not filterable or reportable. No campaign or ad **names**. |
| WhatsApp from a click-to-WhatsApp ad | Nothing. The `referral` object in Meta's message webhook is ignored. | **Every WhatsApp ad enquiry loses its ad.** Common for UAE agencies. |
| Lead added by hand | The chosen lead source | No campaign. |
| Reports (`/workspace/reports`) | Leads by lead source | Nothing by channel or campaign. |

## Design

### 1. One attribution record per lead
A new table, **`LeadAttribution`**, holds one row per lead, written in the **same transaction that creates the lead**: the touch that created it. It's never changed afterwards, except to add names Meta returns later. Fields:
- **channel:** `MANUAL`, `WEBSITE_FORM`, `LANDING_PAGE`, `META_LEAD_AD`, `WHATSAPP_AD`, `WHATSAPP`, `EMAIL`, `PORTAL`, `OTHER`;
- **platform:** `meta`, `google`, `tiktok`, `snapchat`, `linkedin`, `organic` or `direct`;
- **UTM tags:** `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`, plus `campaignKey` (the campaign name trimmed and lower-cased, so "Marina_Launch" and "marina_launch" group together);
- **Meta:** campaign, ad set and ad IDs and names, and the form ID;
- **page:** landing host and path (never the query string), and the referrer **host only**;
- **click IDs:** `gclid`, `fbclid`, `ttclid` and `ctwa_clid`, used for matching ad platforms in 7F (bounded, kept with the lead);
- `capturedAt`.

The platform is worked out on the server from the click IDs and the UTM source. For example `fbclid` or `utm_source=instagram` means meta, and `gclid` means google.

### 2. Capture on every path
- **Hosted forms and landing pages:** a small first-party script keeps the **first** UTM tags, click IDs, landing page and referrer host for 30 days, in the browser's own storage on the EstateOS site. It sends them with the enquiry, so a visitor who lands with UTMs and enquires two pages later is still attributed. Nothing is sent anywhere else, and there's no third-party tracking.
- **Embedded forms:** a new embed code (keeping the old iframe code working) adds the parent page's UTM tags and click IDs to the iframe address, so the agency's own site's campaigns are kept. The *Copy embed code* buttons get the new code.
- **Meta lead ads:**
  - write the attribution from the lead;
  - also request Meta's `campaign_name`, `adset_name` and `ad_name` lead fields. If Meta refuses them with the permissions we have, we keep the IDs, and names come in 7F with `ads_read`. This is checked first, while building.
- **WhatsApp click-to-WhatsApp ads:**
  - parse the `referral` (ad ID, headline, source URL and `ctwa_clid`) from the first inbound message;
  - keep it on the conversation, and show it in the Inbox ("From an ad: *Marina 2-bed*");
  - when the conversation is linked to a lead, or a lead is created from it, that lead gets `WHATSAPP_AD` attribution.
- **Leads added by hand:** channel `MANUAL`, plus an optional **Campaign** field on the lead form, with suggestions from existing campaign names.
- **Existing leads:** a one-time backfill fills attribution from stored website submissions and Meta activity metadata, on staging and with your OK.

### 3. Where it shows
- **Lead page:** a **Source** card: channel icon, platform, campaign, ad set and ad, UTM tags, landing page and referrer. A source chip in the header is already there.
- **Leads list and Kanban:**
  - a **Channel** column;
  - new **Channel** and **Campaign** filter dropdowns, alongside Status, Agent and the others;
  - the date range applies as now.
- **Reports, "Where leads come from":**
  - leads, qualified and won by **channel** and by **campaign**, for the chosen date range;
  - a top-campaigns table;
  - a CSV download.
- **Workflows:** the trigger conditions can use channel and campaign (for example "if channel is Meta lead ad, assign to the off-plan team").

### 4. Security and privacy
- **Every value from a URL or a browser is untrusted:**
  - bounded lengths;
  - control characters removed;
  - stored as text, never shown as HTML;
  - only the host and path of URLs are kept, never query strings, which can carry personal data.
- **The company always comes from the form, the page or the connection,** never from the browser. Attribution rows are scoped to the company like the lead.
- **The same visibility rules as leads:** owners and admins see the company's reports; managers and agents see only their own leads' attribution, under the existing reporting policy.
- **The first-party storage is mentioned in the privacy page,** and is set only on EstateOS's own pages and forms.

### 5. Data (additive; needs a staging database deploy, with approval)
- the `LeadAttribution` table, indexed by company + channel + date and by company + campaign + date;
- the enum `LeadChannel`;
- a nullable `adReferral` on `InboxConversation`, for the WhatsApp ad;
- new operations for the capture paths, the reports and the backfill.

## Build steps (each tested, then shown to you)
1. **7E.1 Capture:**
   - the table;
   - attribution written in the website-form, landing-page and Meta transactions;
   - the first-party script and the new embed code;
   - unit, database and browser tests (including UTMs kept across pages and the embed passing the parent's tags).
2. **7E.2 WhatsApp ads:** parsing the referral, showing it in the Inbox, and carrying it to the linked or created lead.
3. **7E.3 Showing it:** the Source card, the Channel column, the Channel and Campaign filters, and the Campaign field on manual leads.
4. **7E.4 Reports:** channel and campaign reports, the CSV, and the workflow conditions.
5. **7E.5 Backfill and staging:** the one-time backfill for existing leads, the deploy, and a live test with a UTM link, an embedded form, a Meta test lead and a WhatsApp message.

## Not in 7E
- Ad **spend**, cost per lead and return on ad spend (7F: needs `ads_read` and ad accounts).
- Google Ads and TikTok APIs. Their leads are attributed through UTMs and `gclid`/`ttclid` only.
- Sending conversions back to Meta or Google (later, using the stored click IDs).
- Multi-touch attribution models. Each lead keeps the touch that created it.

## Decisions for you
1. **Keep click IDs (`gclid`, `fbclid`, `ttclid`, `ctwa_clid`)?** Recommended: **yes**. They're pseudonymous IDs from the ad platforms, needed later to report conversions back to Meta and Google. They're stored with the lead and covered by the privacy page.
2. **One touch per lead (the one that created it)?** Recommended: **yes** for 7E. A returning customer's new enquiry already creates a new lead with its own source.
3. **A Campaign field on leads added by hand?** Recommended: **yes**, optional, with suggestions from existing campaign names.
