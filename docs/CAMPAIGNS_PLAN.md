# Phase 7F: campaigns and cost per lead (plan)

Status: **plan**; 7F.1 in progress. Decisions taken (2026-11-25), as recommended:
- owners, admins and managers see spend; agents never do;
- Meta syncs spend in 7F.2; Google and TikTok spend is entered by hand for now;
- campaigns appear automatically from leads;
- each currency is kept as it is, with no conversion;
- `ads_read` joins the Lead Ads App Review.

It builds on 7E (lead source attribution, [LEAD_ATTRIBUTION_PLAN.md](LEAD_ATTRIBUTION_PLAN.md)).

## Built in 7F.1 (deployed to staging 2026-11-25)

- **Data** (`dataconnect/schema/campaigns.gql`):
  - `Campaign`, unique per company and campaign key;
  - `CampaignSpend`: a period with an amount in minor units and its currency, and a source (`MANUAL` now; `META`, `GOOGLE`, `TIKTOK` for later syncs);
  - the audit actions `CAMPAIGN_CHANGED` and `CAMPAIGN_SPEND_CHANGED`, and the target `CAMPAIGN`, appended.
- **Operations** (`dataconnect/connector/campaigns.gql`):
  - `CampaignPerformance`: every campaign with a record or found in leads (newest name), with leads, qualified and won for the chosen days, and spend by currency, each entry counted by its share of days inside the period; one campaign when a key is given;
  - `GetCampaign`, and `CampaignOwners` for choosing a campaign's owner;
  - `CreateCampaign`, `UpdateCampaign` (at the revision read), `AddCampaignSpend`, `UpdateCampaignSpend` and `DeleteCampaignSpend`, with each change audited.
- **Rules checked in the database:**
  - reading needs OWNER, ADMIN or MANAGER; changing needs OWNER or ADMIN;
  - a campaign's hand-entered spend entries never overlap, so no day is counted twice;
  - only hand-entered entries can be changed or removed;
  - a campaign's owner must be an active member of the company.
- **Campaigns found in leads** are listed without a record. Adding spend gives one a record, named by its newest name. A campaign added by hand gets its key from its name, so leads tagged with that name join it. Renaming never changes the key.
- **Screens:**
  - **Marketing** (`/workspace/marketing`): the chosen days (the last 30 by default), status and platform filters, totals, and each campaign's spend, leads, qualified, won, cost per lead and cost per won;
  - **Add campaign**;
  - **the campaign page:** figures, spend entries (add, change, remove), details (edit), leads by channel, and **View leads**;
  - agents see "Campaigns are not available".
- **Reports:** for owners and admins reporting on the whole company (no source, stage or agent filter), Top campaigns and the CSV gain **Spend** and **Cost per lead**.
- **Money:** amounts are integers in minor units, never converted. Cost per lead is shown only when a campaign's spend is in one currency.

## Goal

For each campaign an agency runs, EstateOS shows:
- what it **cost**;
- how many leads it brought, and how many were **qualified** and **won**;
- what each lead **cost**: cost per lead, per qualified lead and per won lead.

Agencies can then compare their Meta, Google, TikTok and portal campaigns and move budget to what sells. Spend is entered by hand for any platform. For Meta, it's read automatically from the agency's ad accounts once they connect them.

## What exists today (after 7E)

| Area | Today | Gap |
| --- | --- | --- |
| Campaigns | Every lead has a source with a `campaignKey` (UTM campaign, Meta campaign, WhatsApp ad, or typed on manual leads). "Top campaigns" in Reports counts leads, qualified and won. | No campaign record: no budget, dates, status, notes or owner. |
| Spend | Nothing | No cost, so no cost per lead. |
| Meta | Lead ads give campaign, ad set and ad IDs. Names come with new leads when Meta allows. WhatsApp ads give only the ad ID and headline. | No spend. WhatsApp ads are grouped by headline, not by campaign. |
| Google, TikTok | Leads attributed through UTM tags and `gclid` / `ttclid` | No spend |
| Marketing page (`/workspace/marketing`) | A placeholder | — |

## Design

### 1. Campaign records
A new table **`Campaign`**, one row per company and campaign key:
- name, channel and platform (Meta, Google, TikTok, portal, other), status (active, paused, ended), start and end dates, planned budget, owner (a member) and notes;
- external IDs where known: the Meta campaign ID, the Google campaign ID and the TikTok campaign ID.

Campaigns appear **automatically** from leads: the first lead with a new campaign key creates the record, using the newest name it has. A member can also create one before any lead arrives, for example to enter its budget. Renaming a campaign never changes how leads are grouped; the key stays the same.

### 2. Spend
A new table **`CampaignSpend`**, one row per campaign, day and source:
- amount in minor units with its currency;
- impressions and clicks when the platform gives them;
- where it came from: entered by hand, Meta, Google or TikTok;
- unique on campaign + day + source, so a re-sync replaces a day rather than adding to it.

**Entered by hand:** a total for a date range (spread evenly over its days), or one amount per month. This works for every platform, including portals, from 7F.1.

**From Meta (7F.2):**
- an owner or admin connects the company's **ad accounts** with Facebook Login for Business: a new configuration asking only for `ads_read` (read-only, no `ads_management`);
- a daily worker job reads each account's **insights at campaign level** (spend, impressions, clicks, by day) for the last 3 days, and the last 90 days on first connect;
- rows are matched to campaigns by Meta campaign ID; campaigns not yet known are created;
- it also reads each **ad's campaign**. That gives WhatsApp ad leads their real campaign and name, replacing the headline grouping from 7E.2, and names older Meta lead ads that only had IDs.

**Currencies:**
- each ad account has one currency, and every amount is stored in its own currency;
- totals are shown per currency, and **never converted**;
- a company with a single currency, typically AED, sees one figure.

### 3. Figures
For the chosen dates, per campaign and in total:
- **leads**, **qualified** and **won**, counted the same way as the 7E report;
- **spend**;
- **cost per lead** = spend ÷ leads;
- **cost per qualified lead** and **cost per won lead** the same way;
- shown as "—" when there are no leads, never as zero or infinity.

Revenue and return on ad spend wait for the Deals and Finance phases, which will hold deal values.

### 4. Where it shows
- **Marketing page**, replacing the placeholder:
  - the campaigns list for a date range: spend, leads, qualified, won and cost per lead, with filters by platform and status, and sorting;
  - totals at the top;
  - **Add campaign** and **Add spend**.
- **Campaign page:**
  - its details and figures;
  - spend over time;
  - leads by channel;
  - a link to its leads (the leads list already filters by campaign);
  - its spend entries, which can be edited when entered by hand.
- **Reports, "Where leads come from":** spend and cost per lead in Top campaigns, and in the CSV.
- **Settings → Ad accounts** (7F.2): connect, choose accounts, see the last sync, disconnect.

### 5. Who sees what (decision 1 below)
- **Owners and admins:** everything, and they manage campaigns, spend and ad accounts.
- **Managers:** see campaigns and spend (recommended).
- **Agents:** see campaign names on their own leads, as now, but never spend.

Spend is checked in the database, like every other read.

### 6. Security
- **Least privilege:**
  - `ads_read` only, never `ads_management`;
  - EstateOS never creates, edits or pauses ads.
- **Tokens:**
  - sealed in the vault with their own purpose (`meta-ads-token`) and bound to the company and connection, server-side only;
  - disconnecting wipes the token and stops syncing, while spend already read is kept.
- **The company comes from the connection,** never from Meta's data or the browser. An ad account is connected to one company at a time.
- **Every value from Meta is untrusted:**
  - names are bounded and shown as text;
  - amounts are validated;
  - IDs must be digits.
- **Audit and limits:**
  - changes to campaigns, spend and ad accounts are audited;
  - syncs are bounded and retried with back-off, within Meta's rate limits.

### 7. Data (additive; needs a staging database deploy, with approval)
- the `Campaign` and `CampaignSpend` tables;
- the `AdAccountConnection` table (7F.2): the sealed token, the selected ad accounts, and the last sync and its result;
- new audit actions, appended.

## Build steps (each tested, then shown to you)
1. **7F.1 Campaigns and manual spend:**
   - the tables;
   - campaigns created from leads' campaign keys;
   - the Marketing page, the campaign page and manual spend;
   - cost per lead in Reports and the CSV;
   - the permissions from decision 1.

   Works without any Meta approval.
2. **7F.2 Meta ad accounts:**
   - connect with `ads_read`;
   - the daily spend sync and the 90-day first sync;
   - ad → campaign names, which also fix WhatsApp ad campaigns.

   Until App Review, Meta lets the app read only the ad accounts of people with a role on the Meta app, so it can be built and tested on staging with your own ad account.
3. **7F.3 App Review for `ads_read` Advanced Access:** the package (use case, screencast, reviewer steps), like [META_LEAD_ADS_APP_REVIEW.md](META_LEAD_ADS_APP_REVIEW.md). Then other agencies can connect their own ad accounts.
4. **7F.4 Google Ads and TikTok spend (optional, decision 2):** read-only API syncs, once their access is approved. Until then, their spend is entered by hand.
5. **7F.5 Staging:** the deploy and a live test with manual spend and your Meta ad account.

## Approvals to plan for

| Platform | What is needed | Notes |
| --- | --- | --- |
| **Meta `ads_read`** | Advanced Access through App Review | Needed to read **other businesses'** ad accounts. Standard access is enough for ad accounts of people with a role on the app, so 7F.2 can be built and tested first. Meta requires Business Verification (EstateOS RE is verified) and at least one successful call with the permission within 30 days before submitting. **Recommended:** add `ads_read` to the Lead Ads review that is waiting for the WhatsApp review, so one submission covers both, once 7F.2 has made its first call. |
| **Google Ads API** | A developer token on a Google Ads manager account, then a **Basic access** application | A new token only reaches test accounts. Basic access (15,000 operations a day) is needed for real accounts and is reviewed by Google, which can take weeks; Google is moving this process into Google Cloud Console. The `adwords` OAuth scope also needs the consent screen verified. Apply early if Google spend matters. |
| **TikTok Marketing API** | A developer app approved by TikTok, then each advertiser authorizing it | Spend comes from the integrated report. Approval timing varies. |

## Not in 7F
- Creating, editing, pausing or budgeting ads (EstateOS stays read-only towards ad platforms).
- Sending conversions back to Meta or Google (the stored click IDs make this possible later).
- Revenue and return on ad spend (needs deal values from Deals and Finance).
- Currency conversion.
- Multi-touch attribution: each lead keeps the touch that created it.

## Decisions for you
1. **Who sees spend?** Recommended: **owners, admins and managers**; agents never see spend.
2. **Which platforms get automatic spend?** Recommended: **Meta in 7F.2**; Google and TikTok entered by hand for now. If Google matters, apply for the developer token now, since its review is the slowest.
3. **Campaigns created automatically from leads' campaigns?** Recommended: **yes**, so every campaign is listed without typing, and members can still add one by hand.
4. **Currencies:** recommended: keep each account's own currency and show totals per currency, with **no conversion**.
5. **Meta App Review:** recommended: **add `ads_read` to the Lead Ads submission** once 7F.2 has made its first call, instead of a separate review later.

## Sources
- Meta: [Marketing API authorization](https://developers.facebook.com/docs/marketing-api/get-started/authorization), [access levels](https://developers.facebook.com/docs/marketing-api/access/), [permissions reference](https://developers.facebook.com/docs/permissions)
- Google: [Google Ads API access levels](https://developers.google.com/google-ads/api/docs/access-levels), [developer token](https://developers.google.com/google-ads/api/docs/first-call/dev-token)
- TikTok: [Marketing API developer application guide](https://docs.treasuredata.com/int/guides-for-creating-tiktok-marketing-api-developer-account-and-application) (third-party; confirm on developers.tiktok.com)
