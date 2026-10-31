# Website publishing

How landing pages move from draft to the public internet, what is checked, what the public can read, and what remains for people to verify. Builder overview: [AI_PAGE_BUILDER.md](AI_PAGE_BUILDER.md).

## Statuses

`WebsitePage.status` describes the current draft. `livePublicationId` says whether the page is live.

| Status | Meaning | Next steps |
| --- | --- | --- |
| `DRAFT` | Being edited. Any save returns the page here, including after approval or while a publication stays live. | Submit for review |
| `IN_REVIEW` | Waiting for review | Approve (owner or admin); return to draft with a note (owner, admin or manager) |
| `APPROVED` | The current version is approved and pinned (`approvedVersionNumber`; the version's `approvedAt` and `approvedBy` are set) | Publish |
| `PUBLISHED` | The live publication is the current version | Edit (back to draft; the page stays live), unpublish |
| `UNPUBLISHED` | Taken offline | Submit for review again, or republish an approved version |
| `ARCHIVED` | Hidden from lists; must be unpublished first | — |

## Workflow controls

| Action | Who | Rules |
| --- | --- | --- |
| **Preview** | Anyone who can read the page | Editor preview with an "Internal preview – not approved for public advertising" banner; the form does not submit; past versions read-only |
| **Submit for review** | Page editors | From draft or unpublished |
| **Approve** | OWNER or ADMIN | The version under review only; compare-and-set |
| **Return to draft** | OWNER, ADMIN or MANAGER | Note of 3–500 characters, shown to the author |
| **Publish** | OWNER or ADMIN | Approved version, no blocking checklist item, every attestation confirmed |
| **Republish with current CRM data** | OWNER or ADMIN | Publishes the approved version again with today's linked data, after reviewing the listed changes |
| **Roll back** | OWNER or ADMIN | Republishes any earlier approved version (with its checklist and attestations) |
| **Unpublish** | OWNER or ADMIN | Immediate: the page, its images and its sitemap entry disappear |
| **Archive** | OWNER, ADMIN or the page's creator | Only when not live |

**Audit events:** status changes, approvals, publications, unpublishing, form changes and archiving are audited (`WEBSITE_*` activity kinds).

**Publishing a version other than the current draft** (rollback or republish) keeps the draft's status. The database checks that `PUBLISHED` is used only when the live version is the current one.

## Published snapshots

Publishing (`service.ts#publish`) does the following:
1. Re-reads every linked record as the publisher (`required: true`).
2. Builds the checklist and requires every requested attestation.
3. Resolves each image the page shows to its storage object, authorized again through the inventory media service.

It then stores a `PagePublication` through `PublishWebsitePage`, a NO_ACCESS transaction that:
- re-checks that the publisher is an active OWNER or ADMIN;
- re-checks that the version is approved;
- rejects a slug that another page of the company is still live on;
- marks earlier active publications of the page `SUPERSEDED`;
- updates the page with a compare-and-set.

**The snapshot** (`snapshot.ts`) holds:
- the approved page data, titles and SEO fields;
- the public-safe linked data, including the "as recorded on" date;
- the image allowlist (media ID to storage object, server-only);
- the source record IDs for live eligibility checks;
- the Open Graph image.

**The publication row** also holds the slug at publication, a SHA-256 fingerprint of the linked data, and the checklist with the confirmed attestations and publisher.

Versions are append-only, and publications point to an immutable approved version, so later draft edits never change what is live. A slug change takes effect at the next publication.

## Validation checklist

`checklist.ts` produces items with `PASS`, `FAIL` (blocking), `WARN` or `MANUAL`.

| Group | Checks |
| --- | --- |
| Content | Title; at least one section with data; sections hidden for missing data (warning); claims reviewed (manual, with the fact-check warning count); testimonial consent and landmark verification (blocking until confirmed) |
| Images | Every CRM image is an active photo of the linked records (blocking); stock media used (manual: replace with the project's own photos where possible); no photos (warning) |
| Lead form | An enquiry form section needs a connected, active form (blocking); a page with no form and no contact button gets a warning |
| Advertising (UAE) | See below |
| Company identity | Company name; an approved phone, email or WhatsApp number (blocking); a disclaimer (blocking for property advertisements) |
| SEO | Search title and description (warnings) |

**Attestations** are stored with the publication:

| Attestation | Required |
| --- | --- |
| `CONTENT_REVIEWED` | Always |
| `ADVERTISING_PERMITS_VERIFIED` | Whenever a project, property or listing is advertised |
| `TESTIMONIALS_CONSENT` | When testimonials are shown |
| `LANDMARKS_VERIFIED` | When landmarks are shown |
| `AGENT_DETAILS_CONSENT` | When a contact section or contact-card widget shows an agent |
| `STOCK_MEDIA_ILLUSTRATIVE` | When the page uses stock photos or videos: they are illustrative and not of the advertised property |

Each item that is not passing may name where it is fixed (`fix`: the brand details, the page settings, a section, the lead form, or a project or listing in the CRM). The editor's Publish tab uses it to offer the fix in place. The server builds the checklist again when the page is published, so fixing an item in the editor is never trusted on its own.

The UI states that automated checks only confirm recorded information and do not confirm regulatory compliance.

## UAE advertising considerations

EstateOS checks what it can verify from its own records and leaves the rest to an accountable person.

**Automated:**
- **Listings shown** (source listing and comparisons) must meet the Phase 5F public-listing rule, `isPublicListing`:
  - explicitly published (`publicationStatus = PUBLISHED`);
  - `ACTIVE`;
  - not archived;
  - an advertising permit number recorded and not expired.
- **Missing permit verification link:** a warning, with a reminder to record the link where the regulator requires a QR code or verification link (for example Madmoun in Dubai).
- **Properties** are advertised through listings (which hold the price and permit), so a property-only page cannot be published.
- **Projects** must be `ACTIVE` or `COMPLETED`.
  - Dubai projects need a recorded, unexpired project permit (Trakheesi).
  - Projects in other emirates get a warning to check the emirate regulator's rules.
- **Permit numbers** of every advertised listing and project are always shown in the page footer, with "Verify permit" links when recorded.

**Manual** (`ADVERTISING_PERMITS_VERIFIED`): the publisher confirms that the permits shown were verified with the regulator and that the page meets the applicable advertising rules.

**Never done by EstateOS:** it does not generate, fetch or validate permit numbers or QR codes. It does not call any DLD, RERA or Madmoun service, and it does not claim compliance.

**Requires human or legal verification before production use:**
- current Dubai Land Department and RERA advertising rules (Trakheesi permits, Madmoun QR display and placement, permit validity per channel and per listing);
- the rules of other emirates' regulators;
- required wording of disclaimers and agency licence details (for example ORN or BRN display);
- approval of images and marketing claims;
- the privacy notice and consent wording of the lead form;
- record retention for enquiries.

Draft previews are clearly marked internal and are never publicly reachable.

## Live eligibility

Before every public view, `loadPublishedPage` reads only the status fields of the snapshot's source records (`CheckPublishedSourcesEligibility`). The page responds "not found" while any of these apply:
- a listing is no longer published or active;
- a listing's permit was removed or has expired;
- a listing or property was archived;
- a project is no longer active or completed, or its permit has expired;
- a source is gone.

It returns automatically when the issue is fixed, with the same snapshot. Other CRM changes (price, availability) never alter the live page. The editor lists them as outdated until an owner or administrator republishes.

## Public pages

`/site/{companySlug}/{pageSlug}` needs no login.

**Tenancy:** comes only from the ACTIVE publication matching both slugs. A slug of another company, an unknown slug, a draft, an unpublished or archived page, or an invalid slug format returns 404.

**What is rendered:** the snapshot only.
- **Client component props:** only the form view (enabled fields, consent, privacy link), the display location and the countdown date.
- **Never in the HTML:** form IDs, storage paths, record IDs of linked records, exact coordinates for APPROXIMATE or HIDDEN locations, addresses, unit numbers, notes or other companies' data. The browser test asserts this against the real page.

**Images:** served by `/api/public/site-media/{publicationId}/{mediaId}`.
- Only IDs in the active publication's allowlist are served.
- Other inventory files stay private.
- Cache lifetime is 5 minutes, so an unpublished page's images stop being served within minutes. The URL changes with every publication.

**Uploaded images:** website library images on visible sections are added to the publication's asset allowlist and served by the same route as CRM photos. An image removed from the library stays available to pages already published with it.

**Locations set on a page:** an "approximate area" pin is generalized to its grid cell when the page is published, so the snapshot never holds the exact point; the editor keeps the exact pin. A manual checklist item asks the publisher to confirm the location.

**Stock media:** catalogue photos and videos load from the Unsplash and Pexels CDNs, built from catalogue IDs only. The footer labels them as illustrative stock media. Visitors' browsers therefore contact those CDNs; fonts are self-hosted.

**Enquiries:** see [lead forms](AI_PAGE_BUILDER.md#lead-forms-and-enquiries).

**Caching:** pages render per request with React `cache()` deduplicating the read. There is no shared cache, so unpublishing is immediate and no private data can be served from a cache.

## SEO

| Item | Implementation |
| --- | --- |
| Title and description | The page's search title and description (title without the "EstateOS" suffix) |
| Canonical | `{APP_ORIGIN}/site/{companySlug}/{pageSlug}` |
| Open Graph and Twitter | Title, description, site name (company), `en_AE` locale, the hero photo as image (summary_large_image) |
| Robots | Live pages `index, follow`; unknown pages and every workspace builder route `noindex, nofollow` |
| Sitemap | `/sitemap.xml` lists the marketing home and live pages, built per request |
| Headings and landmarks | One `h1` (the hero headline, or a visually hidden page title), `h2` per section, `main` with the skip-link target, `section` labels, a `footer`, captions on tables |
| Images | Required alt text; lazy loading except the hero (`fetchPriority=high`); fixed aspect ratios |
| Performance | No external fonts or scripts; maps load on request |

## Custom domains (future adapter)

Not implemented. No DNS records, certificates or hosting changes were made. The design:

**1. Data model:** a `WebsiteDomain` table:

| Column | Purpose |
| --- | --- |
| `websiteId` | The website the domain serves |
| `hostname` | Unique |
| `verificationToken` | For the DNS TXT challenge |
| `status` | `PENDING`, `VERIFIED`, `ACTIVE` or `DISABLED` |
| `verifiedAt` | When ownership was proven |
| `primary` | The canonical domain for the website |

**2. Verification:** an owner adds a domain and publishes a DNS TXT record. A server job verifies it, then the hosting provider's API (App Hosting custom domains) provisions the certificate. These are paid, approval-gated cloud changes.

**3. Routing:** `src/proxy.ts` maps a verified `Host` header to `/site/{companySlug}/…` through a rewrite.
- The tenant comes from the stored domain, never from the request path alone.
- Unknown hosts get 404.
- The canonical URL, sitemap and Open Graph origin switch to the primary domain.

**4. Security:**
- per-domain Content Security Policy;
- `X-Frame-Options` rules for embedding;
- a separate cookie scope, so workspace sessions never reach customer domains;
- rate limits per hostname.

**5. Multi-page sites:** add `WebsiteNavigation` and site-level header and footer data, and allow `/` (home) and nested slugs per website.

## Hosted rollout checklist (requires approval)

1. Back up the hosted database, then deploy the additive schema and the `websites.gql` connector together with the application.
2. Set `APP_ORIGIN` to the public origin (canonical URLs, Open Graph and enquiry landing URLs depend on it) and confirm `FIREBASE_STORAGE_BUCKET`.
3. Confirm `ANTHROPIC_API_KEY` is in Secret Manager if Claude generation is wanted, and review AI allowances.
4. With a test company:
   - create, approve and publish a page;
   - submit an enquiry and check the lead, assignment and notification;
   - unpublish and confirm the 404;
   - check the sitemap and an image URL before and after unpublishing.
5. Have the agency's compliance owner review the [UAE advertising considerations](#uae-advertising-considerations) before the first real advertisement is published.
