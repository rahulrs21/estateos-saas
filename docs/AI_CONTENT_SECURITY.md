# AI Content Studio security, permissions and fact checking

This extends [AI security](AI_SECURITY.md) (Phase 6A); the same Anthropic key handling, provider-error mapping, logging rules and data-handling notes apply.

## Identity and tenancy

- **Identity comes from the server.** Every endpoint resolves the user from the verified session cookie and the organization from the member's stored active company, then checks the membership is ACTIVE. Mutations also require same-origin, a CSRF token and an `X-EstateOS-Organization` header that matches the server-resolved company (409 otherwise).
- **Strict request bodies.** Bodies are strict Zod objects with no organization, user, role, agent, membership, creator or model fields. Any extra field is rejected with 400, not ignored.
- **SQL Connect re-checks scope.** Every stored operation filters by `organizationId` and verifies the caller's ACTIVE membership in the database. Drafts and versions are keyed by `(organization, id)`. A draft from another company returns 404, or 403 when the foreign company is named.

## Permissions

| Role | Drafts | Generation sources | Approve | Brand / templates |
| --- | --- | --- | --- | --- |
| OWNER, ADMIN | Own drafts plus company-wide view, edit, archive and delete | All company records (existing inventory and lead rules) | Yes | Manage |
| MANAGER | Own drafts | Leads assigned to them; no inventory (existing rule), so only lead-based WhatsApp and email | No | Read |
| AGENT | Own drafts | Assigned leads and inventory; projects and developers (existing rules) | No | Read |

There is no MARKETING role in EstateOS and none was added.

### How draft scope is enforced

- The server passes `createdByUid` (the caller's uid) for non-administrators and omits it for owners and administrators.
- Each operation's membership `@check` re-verifies the rule: a member may omit it or pass another uid only if their stored role is OWNER or ADMIN.
- Approval is checked the same way, in the API and in `SetAiContentDraftStatus`.

### Draft ownership and source access are checked separately

- **Draft ownership** controls who may read, edit, restore, change the status of or delete a draft.
- **Source access** is checked again on every generation and regeneration. EstateOS re-reads each source through the CRM services as the current member, so:
  - an agent cannot regenerate from a lead or property that was reassigned away from them;
  - naming another agent's restricted lead fails with `404 SOURCE_UNAVAILABLE` before Claude is called.

  Not-found and not-permitted give the same answer, so guessed IDs reveal nothing.

### Server-only writes

Generated content is written only by NO_ACCESS operations, which client SDKs cannot call:

- `CreateAiContentDraft`
- `RegenerateAiContentDraft`
- `AddAiContentAlternative`

The server calls them after the checks above. Edits, status changes and deletes use member operations with impersonation, so the database enforces membership again.

## Data sent to Claude

The facts block is built by allowlist presenters (`content/facts.ts`), from records the services already filtered.

**Included:**

- Property: type, bedrooms, bathrooms, size, floor, furnishing, occupancy, parking, view, availability, building, project and developer names, amenities and features.
- Location: text only. The street address appears only when the record's map mode is EXACT.
- Prices: labelled listing asking price, reference price or project starting price.
- Listing: title, reference, purpose, status, advertising permit number and expiry, and the staff description (≤1,500 characters, marked as untrusted).
- Project: status, dates, payment plan percentages and grouped available units.
- Developer: name, description and website.

**Never included:**

- coordinates or place IDs;
- internal notes, or ownership and mandate references;
- media file names;
- member emails;
- customer email, phone, nationality, budget, notes or source.

**Lead facts:**

- first name only, and only when the member ticks "Address the customer by first name";
- what the customer is looking for;
- the next or last viewing (Dubai time, property reference, community);
- shortlisted references.

**Sender:** the member's own display name. No agent phone numbers exist in EstateOS, so none can be inserted.

Source references stored with a draft include record IDs, references and `updatedAt`. They never include the lead's name.

## Prompt injection

- Record text, templates and user instructions are placed in labelled blocks (`<verified_crm_facts>`, `<company_template>`, `<user_style_instructions>`). The system prompt tells Claude to treat them as data and style guidance, never as instructions.
- Claude has **no tools** in the Content Studio. An injected instruction cannot read other records, contact anyone or change data: it can only affect the wording of a draft that a person reviews.
- The structured output schema allows only the expected fields. The editor renders all text as React text nodes, never HTML. The markdown renderer is not used here, so there is no link or HTML injection path.

## Fact checking (`content/validate.ts`)

Validation runs after every generation and every saved edit or restore. Edits are checked against a compact index of the facts recorded at generation, so no new CRM read is needed. Each draft stores:

- source records with their `updatedAt`, the generation time and the facts read time;
- warnings by category (below);
- Claude's own `missingInformation` and `claimsToReview` lists;
- whether the draft was edited after generation.

| Check | Rule |
| --- | --- |
| Unverified figures | Every number in the draft must appear in the structured facts or approved branding. The check understands thousands separators, `K/M/million`, Arabic-Indic digits and the Arabic words for thousand, million and billion. Numbers inside hashtags are ignored. Numbers that appear only in free-text staff descriptions do **not** count as verified. |
| Unverified contacts | Phone numbers (international, or UAE numbers starting with 0), email addresses and web addresses must be approved branding contacts or a developer website from the facts. |
| Sensitive claims | Flagged in English and Arabic: guarantees; returns, ROI, yields or appreciation; distances, travel times or nearby places; permits, RERA, DLD or licences; visa or tax statements; discounts and offers; scarcity; superlatives. The first five categories are always flagged. The last three are flagged unless the same wording is in the facts. |
| Placeholders | `[like this]` items to fill in before use. |
| Length limits | Ad text against platform limits; Instagram caption length and hashtag count. |

The editor shows these under "Check before use", with a notice that prices and availability may have changed since generation. Internal approval means approved inside the agency only.

## Audit and logging

- **Audit log:** draft created, status changed (with the new status), draft deleted, template created, updated or deleted, and brand profile updated.
- **`ai.content` log line:** request id, mode, content type, purpose, language, status, error code, model, role, source kinds, tokens, cost estimate and duration. It contains no facts, prompt, draft text or member identifiers.
- **`AiUsageRecord`:** one row per generation (`feature = CONTENT`).

## Deliberately not done

- No sending, publishing or campaign creation.
- No changes to CRM records.
- No new roles.
- No caching of facts or drafts in EstateOS.
- No OpenAI or other provider, and no simulated responses when Claude is unavailable: generation fails with a clear error.
