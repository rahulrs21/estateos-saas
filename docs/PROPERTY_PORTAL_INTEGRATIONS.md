# Phase 5E: property portal integration foundation

EstateOS can now prepare listings for Property Finder, Bayut and dubizzle: track each company's integration status, validate listings against portal readiness rules, map EstateOS values to portal values, and preview JSON/XML exports. **Nothing is sent to any portal.** No provider specification, endpoint or partner approval has been verified, so all output uses an internal draft format (`estateos-draft-v1`).

## What exists

| Area | Location |
| --- | --- |
| Schema (tables and enums) | [schema.gql](../dataconnect/schema/schema.gql), "Phase 5E" section |
| Stored operations | [portal-integrations.gql](../dataconnect/connector/portal-integrations.gql) |
| Provider-independent pipeline | [src/modules/portals/](../src/modules/portals/): `normalize.ts`, `validation.ts`, `export.ts`, `serialization.ts`, `retry.ts` |
| Provider adapters | [src/modules/portals/adapters/](../src/modules/portals/adapters/) |
| Server service | [src/modules/portals/server/service.ts](../src/modules/portals/server/service.ts) |
| HTTP routes | `src/app/api/portals/*` (session, CSRF, origin and organization-consistency checks via the shared CRM HTTP helpers) |
| Settings UI | `/settings/property-portals` |
| Export preview | `/settings/property-portals/preview?provider=…&listingId=…` |

### Data model

| Model | Purpose |
| --- | --- |
| `PortalProvider` (enum + code registry) | The provider catalog. Implemented as an enum plus `portalAdapters` rather than a table: every provider needs adapter code, and a global table would need seeding on hosted databases while adding nothing the enum does not express. Add a provider by adding an enum value and an adapter. |
| `OrganizationPortalConnection` | One row per company and provider (unique). Status, non-secret account reference, notes, `lastVerifiedAt`, `lastErrorCode`. No credentials. |
| `PortalFieldMapping` | Company overrides of adapter default value mappings, unique per company/provider/field/source value. Keys: `PROPERTY_TYPE`, `LISTING_PURPOSE`, `FURNISHING`, `EMIRATE`, `AGENT_ID` (membership → portal agent identifier). |
| `ListingPublication` | One row per listing and provider (unique). Validation state, error/warning counts, payload hash, and fields reserved for live publishing (`externalReference`, `lastPublishedAt`, `attemptCount`, `nextRetryAt`). `PropertyListing.publicationStatus` remains the company-wide summary and is not changed by this phase. |
| `PublicationAttempt` | Append-only history per publication: action (`VALIDATE`, later `PUBLISH`/`UPDATE`/`REMOVE`), outcome, counts, error codes, payload hash. |
| `FeedGenerationJob` | Record of each feed run: provider, format, counts, byte size, error-code summary. In this phase every job is a dry run; feed content is never stored. |

All tables use `(organizationId, id)` keys. `ListingPublication` references `PropertyListing` with a tenant-composite foreign key, so a publication can never point at another company's listing. The changes are additive (new enums, tables, and new values appended to `AuditTargetType`/`ActivityKind`); no existing column changes.

### Connection statuses

`NOT_CONFIGURED`, `PENDING_APPROVAL`, `CONNECTED`, `ERROR`, `DISABLED`. A company with no row is shown as `NOT_CONFIGURED`. Administrators can record only `NOT_CONFIGURED`, `PENDING_APPROVAL` or `DISABLED` — enforced in Zod and again in the stored mutation's `@auth` expression. `CONNECTED` and `ERROR` are reserved for a future server-side verification job; any administrator change clears `lastVerifiedAt`/`lastErrorCode`, so a stale "connected" state cannot persist.

### Publication states

`NOT_PUBLISHED`, `VALIDATION_FAILED`, `READY`, `QUEUED`, `PUBLISHED`, `FAILED`, `REMOVAL_REQUESTED`, `REMOVED`. This phase writes only `READY` (zero errors) and `VALIDATION_FAILED`. Recording a validation is refused (`PUBLICATION_LOCKED`) once a publication has moved beyond those states, so a future publisher's state is never overwritten.

## Export pipeline

1. **Load** (`GetPortalExportListing` / `ListPortalExportListings`): selects only advertising fields. Property `internalNotes`, `ownershipReference`, `mandateReference`, `unitNumber` and member emails are not selected. Media are limited to `ACTIVE`, non-archived `PROPERTY_PHOTO` and `FLOOR_PLAN`; brochures and documents are excluded.
2. **Normalize** (`normalizeListing`): provider-independent shape; prices converted from integer minor units with `BigInt` (no floating point); membership IDs canonicalized.
3. **Validate** (`validateListing`): errors block `READY`, warnings do not. Rule parameters come from the adapter (`rules`).
4. **Transform** (`adapter.transform`): maps values through company override → adapter default.
5. **Serialize** (`toJson` / `toXml`): deterministic output; null/undefined omitted; XML text escaped, invalid XML characters stripped, element names validated. A SHA-256 hash of the JSON identifies the payload.

### Validation rules

| Check | Severity | Code(s) |
| --- | --- | --- |
| Listing status is `ACTIVE` | Error | `LISTING_NOT_ACTIVE` |
| Property not archived and `AVAILABLE` | Error | `PROPERTY_ARCHIVED`, `PROPERTY_UNAVAILABLE` |
| Property type / transaction type have a mapping | Error | `PROPERTY_TYPE_UNMAPPED`, `TRANSACTION_TYPE_UNMAPPED` |
| Rentals have a rental period | Error | `RENTAL_PERIOD_REQUIRED` |
| Price > 0; currency AED | Error | `PRICE_REQUIRED`, `CURRENCY_UNSUPPORTED` |
| Emirate (mapped) and community | Error | `EMIRATE_REQUIRED`, `EMIRATE_UNMAPPED`, `COMMUNITY_REQUIRED` |
| Area / sub-community | Warning | `AREA_RECOMMENDED` |
| Bedrooms for residential types (0 = studio) | Error | `BEDROOMS_REQUIRED` |
| Bathrooms for residential types | Warning | `BATHROOMS_RECOMMENDED` |
| Built-up area (plot area for plots) | Error | `SIZE_REQUIRED` |
| At least 1 active photo; 5+ recommended; cover photo | Error / Warning | `PHOTOS_REQUIRED`, `PHOTOS_RECOMMENDED`, `COVER_PHOTO_RECOMMENDED` |
| Assigned, active agent; portal agent ID mapped | Error / Warning | `AGENT_REQUIRED`, `AGENT_INACTIVE`, `AGENT_PORTAL_ID_MISSING` |
| Advertising permit in Dubai; not expired (Dubai date) | Error | `PERMIT_REQUIRED`, `PERMIT_EXPIRED` |
| Permit outside Dubai; permit expiry recorded | Warning | `PERMIT_NOT_PROVIDED`, `PERMIT_EXPIRY_MISSING` |
| Description present; 100+ characters; title 10+ characters | Error / Warning | `DESCRIPTION_REQUIRED`, `DESCRIPTION_SHORT`, `TITLE_SHORT` |

### Assumptions (to confirm against each provider's specification)

- **Permits:** Dubai advertising requires a DLD/RERA permit, so a missing permit is an error there. Other emirates are warnings until their rules are confirmed per portal.
- **Currency:** AED only.
- **Photo, description and title thresholds** (1 required / 5 recommended photos, 100-character description, 10-character title) are EstateOS defaults, not provider requirements.
- **Draft schema:** all field names and default value codes (for example `apartment`, `sale`) are placeholders. The three adapters share one draft transformation.
- **Media:** exported as stable references (`reference`, `kind`, `cover`, `position`). Files are private Firebase Storage objects with no public URLs. A public media-delivery design (signed URLs or a public CDN copy of approved photos) is required before live publishing.
- **Agents:** exported as a mapped portal agent ID plus display name. Member email and phone are not exported.

## Access and security

- Every page, route, service and stored operation requires an active OWNER/ADMIN membership in the server-resolved active company (`assertOrganizationAdministrator` plus `@auth`/`@check` in each operation). Agents, managers, other companies, unverified and anonymous users are denied.
- The organization ID always comes from the verified session; the browser's `X-EstateOS-Organization` header is only a consistency check. Strict Zod objects reject `organizationId`, `role` and any credential-like field.
- Validation results and dry-run counts are **recomputed on the server** from database data. Clients only choose the listing, provider and format. The stored record operations also enforce internal consistency (`READY` ⇔ zero errors; valid + invalid = total; recent `startedAt`).
- **Credentials:** none are stored. The settings form explicitly has no secret fields. Future API keys/tokens must live in a server-side secret manager (for example Google Secret Manager via App Hosting secrets), referenced by name and read only by the publishing worker.
- Audit logs: `PORTAL_CONNECTION_UPDATED`, `PORTAL_FIELD_MAPPING_CHANGED`, `LISTING_PUBLICATION_VALIDATED`, `FEED_GENERATION_RECORDED`, each with safe metadata (provider, status, counts; never payload content).
- No public feed URL or unauthenticated endpoint exists. `/api/portals/preview` requires a session and administrator role.

## Feed dry runs

`Run feed dry run` reviews up to 500 `ACTIVE` listings in pages of 100, validates and serializes them in memory (valid listings only), records counts, byte size and the most frequent blocking codes, and discards the content.

## Future synchronization architecture (not implemented)

1. **Approval and specification.** For each portal, obtain partner/API approval, the official feed or API specification, test credentials, and field/enum lists. Replace that adapter's `transform`, `defaultMappings`, `rules` and `xml` names; keep the shared normalizer and validator.
2. **Credentials and verification.** Store secrets in a secret manager. Add a server-only verification job that calls the provider's documented test endpoint and is the only writer of `CONNECTED`/`ERROR` and `lastVerifiedAt`.
3. **Publishing worker.** A scheduled server job (for example Cloud Scheduler → authenticated App Hosting route or Cloud Run job) selects `READY` publications whose `payloadHash` differs from the last published hash, re-validates on the server, and publishes. It writes `QUEUED` → `PUBLISHED`/`FAILED`, `externalReference`, `lastPublishedAt`, `attemptCount` and a `PublicationAttempt` row per call.
4. **Retries.** `retry.ts` classifies failures (`RETRYABLE` for 408/425/429/5xx/network errors, `AUTHENTICATION` for 401/403 → connection `ERROR`, otherwise `PERMANENT`) and computes exponential backoff (60 s base, 6 h cap, 6 attempts) for `nextRetryAt`.
5. **Updates and removals.** Listing changes produce a new payload hash → republish. Listings that become non-`ACTIVE`, unavailable, archived or have an expired permit move to `REMOVAL_REQUESTED` → `REMOVED` via the provider's removal method (`PublicationAction.REMOVE`).
6. **Feed-based portals.** If a portal pulls an XML feed instead of accepting API calls, generate the feed into private storage and serve it through an authenticated, per-company, rotatable URL agreed with the provider. Record each generation in `FeedGenerationJob` with `dryRun: false`.
7. **Summary status.** Derive `PropertyListing.publicationStatus` from the per-provider rows once live publishing exists.

## Outstanding provider requirements

For each of Property Finder, Bayut and dubizzle: partner agreement and API/feed access; official specification (fields, enums, location identifiers, media requirements, character limits); authentication method and credential issuance; sandbox environment; rate limits and error codes; permit fields and validation rules per emirate; agent/broker identifier format and registration process; removal and update semantics; webhook or status-polling options for lead and listing status.

## Local rollout and hosted migration

Run `npm run sql:validate`, `npm run sql:generate`, then restart `npm run dev:local`; the emulator applies the additive tables. The local-only `ResetEstateOS` seed operation now deletes the five new tables first. Hosted environments need a reviewed, backed-up migration and connector deployment before this application version. **No hosted migration, deployment, paid resource or live portal call was made.**

## Tests

- `npm run test:portals` — serialization (escaping, invalid names, determinism), normalization, privacy exclusions, every validation rule, mappings, adapters, feed dry runs, input validation (status/credential/tenant rejection) and retry policy.
- `npm run test:dataconnect` — `tests/sql-connect-portals.cases.mjs`: administrator-only access, cross-company rejection, verified-only statuses, stale writes, mapping upserts/removal, export field and media selection, validation/attempt persistence, publication locking, feed job consistency and audit rows.
