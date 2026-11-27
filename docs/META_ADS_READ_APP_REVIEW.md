# Meta App Review: `ads_read` (EstateOS RE)

The submission package for the permission **`ads_read`**, for the Meta app **EstateOS RE** (App ID 1837332403959295), business portfolio **Estate OS by Faza Home**.

It lets a real estate agency connect its own Meta **ad accounts** in EstateOS, so each campaign's spend is read automatically and the agency sees what each lead cost (Phase 7F, [CAMPAIGNS_PLAN.md](CAMPAIGNS_PLAN.md)). EstateOS only **reads**; it never creates, edits or pauses ads.

- **What to ask for:** **Advanced Access** to `ads_read`. Standard access already works, but only for ad accounts of people with a role on the app. Advanced Access lets any agency connect its own ad accounts.
- **Submit it together with the Lead Ads permissions** ([META_LEAD_ADS_APP_REVIEW.md](META_LEAD_ADS_APP_REVIEW.md)): one request with six permissions, sent after the WhatsApp review has its result. The text blocks below are written for Meta's reviewers. Paste each one into the matching box for `ads_read`.
- **Not needed now:** *Ads Management Standard Access* (higher Marketing API rate limits). EstateOS reads a few hundred rows per ad account every 6 hours, well within standard limits. It can be requested later, once many agencies are connected.

---

## 1. Before you submit (checklist)

- [ ] **`ads_read` has recent API calls.** In the app, the use case that holds `ads_read` (**Use cases → Measure ad performance data with Marketing API**, or wherever `ads_read` appears under **Permissions and features**) should show it has been used. EstateOS read your three ad accounts on staging on 26 and 27 November, and keeps reading them every 6 hours. Meta wants a successful call within the 30 days before you submit.
- [ ] **Business verification:** already approved for Estate OS by Faza Home.
- [ ] **The privacy policy names ad-account data.** The `/privacy` page has a line for it, added with this package. Deploy it before submitting.
- [ ] **Facebook Login for Business configuration** *EstateOS ad accounts* (ID 1632688438656505) asks for `ads_read` only, and its redirect URI `…/api/campaigns/meta/callback` is listed under **Valid OAuth Redirect URIs**. Both are done.
- [ ] **Reviewer login:** the same reviewer account as for the WhatsApp and Lead Ads reviews, an Admin of **Demo Realty (Sample Data)** on staging.
- [ ] **For the recording:** choose an ad account with spend in the last 90 days (*Faza Home Online* has a campaign from September). Before recording, **Marketing → Ad accounts → Disconnect** all three accounts, so the video shows connecting from the start. Spend already read stays.

---

## 2. Text for `ads_read` (copy this)

### How the app uses `ads_read`

> EstateOS is a CRM for real estate agencies. An agency administrator connects the agency's own Meta ad accounts in EstateOS (Marketing → Ad accounts → Connect Meta ad accounts) using Facebook Login for Business with a configuration that asks only for ads_read, and chooses the ad accounts in Facebook's dialog.
>
> We use ads_read to read, for the ad accounts the administrator chose: the account's name, currency and time zone (GET /me/adaccounts), and the account's daily ad insights at ad level (GET /act_{ad-account-id}/insights with level=ad and time_increment=1, fields campaign_id, campaign_name, adset_id, ad_id, spend, impressions, clicks). EstateOS reads the last 90 days once when the account is connected, then the last 3 days every 6 hours, because Meta still revises recent days.
>
> EstateOS adds up each campaign's daily spend and shows it to the agency's owners, administrators and managers on its Marketing page, next to the leads each campaign brought into the CRM. That gives the cost per lead, per qualified lead and per won deal. The ad-to-campaign mapping also lets EstateOS group leads from click-to-WhatsApp ads and lead ads under the campaign they came from.
>
> EstateOS never creates, edits, pauses or budgets ads (we do not request ads_management). The data is used only by the agency that owns the ad account, inside its own EstateOS workspace. It is never shared with other agencies, sold, or used for advertising. An ad account can be connected to only one agency at a time, and the administrator can disconnect it at any time.

---

## 3. Screencast script (a separate short video for `ads_read`)

**Recording tips:** as for the Lead Ads video.
- In English, under 3 minutes.
- Keep the address bar visible.
- Add on-screen captions instead of a voice.
- Never show a password or a token.

| # | What to do | Caption on screen |
| --- | --- | --- |
| 1 | Sign in to `https://estateos-staging--estateos-staging.us-east4.hosted.app` as the company admin. Open **Marketing**. | "An agency administrator opens Marketing in EstateOS (CRM for real estate agencies)." |
| 2 | Click **Ad accounts**. It shows "No ad accounts connected". | "The admin connects the agency's Meta ad accounts to see what each campaign cost." |
| 3 | Click **Connect Meta ad accounts**. Facebook's Login for Business dialog opens. **Pause on the permissions screen** so `ads_read` is readable. | "Facebook Login for Business asks only for ads_read (read-only)." |
| 4 | Choose **one** ad account (for example *Faza Home Online*) and continue. | "The admin chooses which ad accounts to share." |
| 5 | The return page shows **"Connected: Faza Home Online"**, then Ad accounts opens with the account, its currency and "Last read". | "ads_read: EstateOS lists the chosen ad account and reads its last 90 days of spend." |
| 6 | Go **Back to campaigns**. Set **From** to a date before the campaign's spend (for example 1 September) and click **Apply**. Show the campaign row with its **Spend**. | "ads_read: each campaign's daily spend (from the ad account's insights) appears next to its leads." |
| 7 | Open the campaign. Show the **Spend** card with its entries marked **Meta**, and the figures at the top. | "Spend per day, read from Meta. Cost per lead appears when the campaign has leads." |
| 8 | Back in **Ad accounts**, click **Sync now**. The message "Synced: … campaigns" appears. | "EstateOS re-reads recent days every 6 hours, or on request. It never changes anything in Meta." |
| 9 | Click **Disconnect** and confirm. The list is empty again. | "Disconnecting deletes EstateOS's access. Spend already read stays in the agency's reports." |

When you've finished recording, connect the ad accounts again so staging keeps syncing.

---

## 4. How reviewers can test (add this to "Testing instructions")

> ads_read:
> 1. Sign in to https://estateos-staging--estateos-staging.us-east4.hosted.app with the reviewer account below (administrator of the sample company "Demo Realty (Sample Data)").
> 2. Open Marketing → Ad accounts and click "Connect Meta ad accounts". Sign in with a Facebook account that can access an ad account (a test ad account works) and choose it in Facebook's dialog.
> 3. EstateOS lists the ad account and reads its last 90 days of spend. In Marketing, campaigns with spend in the chosen dates show it, with cost per lead when they brought leads. Open a campaign to see its spend entries marked "Meta".
> 4. "Sync now" reads recent days again. "Disconnect" removes the ad account and EstateOS's access to it.
>
> EstateOS only reads ad data: it never creates or changes ads, and does not request ads_management.

---

## 5. Data handling (for the data use questions)

- **What we store, per connected ad account:**
  - its ID, name, currency and time zone;
  - each campaign's **daily spend, impressions and clicks**, and campaign, ad set and ad IDs and names.

  These are business figures, not personal data of people who saw the ads.
- **The administrator's Facebook user token is stored**, unlike for Lead Ads, because spend is read again every 6 hours:
  - encrypted at rest (AES-256-GCM, bound to the agency and the ad account);
  - never shown to users or written to logs;
  - its expiry is stored too. About 60 days after connecting, the administrator is asked to connect again.
- **Who can see it:** only the owners, administrators and managers of the agency that connected the ad account. Agents never see spend. Each ad account belongs to one agency only, and agencies are isolated from each other.
- **Not shared or sold:** ad data isn't shared with third parties, sold, or used for advertising or profiling.
- **Deletion:**
  - **Disconnect** deletes the ad account's record and its token at once;
  - the agency's owner can ask EstateOS to delete the spend already read;
  - people can request deletion of their data through `/data-deletion`.
- **Security:**
  - only GET requests are sent to Meta, with the token in the Authorization header and never in a URL;
  - every connect and disconnect is written to the agency's audit log.

---

## 6. After approval

1. Publish the app, together with the Lead Ads permissions.
2. Any agency can then connect its own ad accounts from Marketing → Ad accounts.
3. Before production:
   - move the redirect URI `…/api/campaigns/meta/callback` and the legal URLs to the production domain;
   - create the same Login for Business configuration there.
4. Later, if many agencies connect: request **Ads Management Standard Access** for higher rate limits.
