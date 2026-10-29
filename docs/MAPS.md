# UAE maps (Phase 5F)

Phase 5F adds Google Maps support to developers, projects, properties and listings: address autocomplete, geocoding and reverse geocoding; a draggable pin preview in forms; clustered, viewport-driven map views on `/properties` and `/listings`; map sections on property, project and developer pages; and reusable public map components for future agency websites. Every map follows the record's **map display mode**, which the server applies before any coordinate reaches a browser. API lookups and map reads are rate limited through a shared, database-backed limiter.

## Location data

| Field | Developer | Project | Property | Building | Notes |
| --- | --- | --- | --- | --- | --- |
| country | existing | existing (`AE` default) | implied `AE` | — | Properties use the UAE-only `Emirate` enum. |
| emirate, community, area | — | existing | existing | — | `Emirate` enum; Google `sublocality_level_1` / `neighborhood`. |
| city | — | `varchar(120)` | `varchar(120)` | — | Google `locality`. |
| address | `headOfficeAddress` (existing) | existing | existing | — | Formatted address, editable. |
| latitude / longitude | **new** `headOfficeLatitude` / `headOfficeLongitude` `numeric(9,6)` | existing | existing | existing | Must be paired; UAE records must fall inside the UAE bounding box. |
| place ID | **new** `headOfficeGooglePlaceId` | `googlePlaceId` | `googlePlaceId` | — | Set only when a Google place was selected; cleared when the pin moves. |
| mapDisplayMode | — (always exact) | default `EXACT` | default `APPROXIMATE` | inherits project | `EXACT`, `APPROXIMATE` or `HIDDEN`. |

A developer head office is business contact information, so it is shown exactly to every member who can see developers. Editing it never changes project locations or the developer/project relationship.

### Validation

Validation runs in three places: the browser form, the Zod schemas in `src/modules/inventory/validation.ts`, and the `@auth` expressions of the stored mutations.

- Latitude and longitude are both present or both blank.
- Properties, and projects or developers whose country is `AE`, must lie inside the UAE bounding box (22.4–26.5° N, 51.0–56.6° E). This catches swapped and mistyped coordinates; it is not a legal boundary.
- Place IDs must match `^[A-Za-z0-9_-]{8,255}$`.
- When Google returns an incomplete place (no emirate, city, community or street address), the form fills what it has and tells the user which fields to complete. Results outside the UAE are not applied to UAE records.

## Display modes and privacy

`presentMapLocation` in `src/modules/maps/geo.ts` is the single policy:

| Mode | Map / link shown to every viewer | Administrators (OWNER/ADMIN) additionally see |
| --- | --- | --- |
| `EXACT` | The stored pin; Google Maps link includes the place ID. | — |
| `APPROXIMATE` | A ~800 m circle at the centre of a fixed 0.01° grid cell. The place ID is withheld. | The exact coordinates and an "Open exact location" link. |
| `HIDDEN` | No map location. The Google Maps link, if any, searches the visible community/emirate text only. | The exact coordinates and link. |

Enforcement points:

- **Database:** the map-pin queries in `dataconnect/connector/inventory-maps.gql` never return `HIDDEN` rows or rows without coordinates.
- **Service:** `listInventoryMapPins` passes every remaining point through `presentMapLocation` and never returns raw coordinates.
- **Viewport queries:** requested bounds are snapped *outward* to whole 0.01° cells (`snapBoundsToGrid`) before filtering. An `APPROXIMATE` record is then inside the area exactly when its published cell is, so shrinking the bounds cannot locate it more precisely than its cell.
- **Record reads:** for non-administrators, `listInventory` and `getInventoryRecord` (also used by `GET /api/inventory/...`) return coordinates through `redactStoredLocation`: unchanged for `EXACT`, snapped with no place ID for `APPROXIMATE`, and null for `HIDDEN`. Buildings follow their project's mode.
- **Views:** detail views strip `latitude`, `longitude` and `googlePlaceId` before records reach client components and send only the presented location.
- Snapping to a fixed grid (rather than random jitter) means repeated requests cannot be averaged to recover the exact point.
- Tenant and role scope are unchanged: map queries repeat the list operations' membership checks. Agents see pins only for properties or listings assigned to them; other companies' records are never returned.

## Map providers

`MapCanvas` picks a renderer with `NEXT_PUBLIC_MAP_PROVIDER` (`src/modules/maps/client/map-provider.ts`):

| Setting | With a Google browser key | Without one |
| --- | --- | --- |
| `auto` (default) | Google Maps (falls back to OpenStreetMap if Google fails to load or rejects the key) | OpenStreetMap |
| `google` | Google Maps | Not-configured state |
| `osm` | OpenStreetMap | OpenStreetMap |
| `none` | Not-configured state | Not-configured state |

OpenStreetMap maps use Leaflet 1.9 (`src/modules/maps/components/leaflet-canvas.tsx`) with tiles from `tile.openstreetmap.org` and the required attribution, and cluster markers with supercluster. They support the same features as the Google renderer: exact pins, approximate circles, draggable form pins, clustering, viewport queries and list sync. They receive only presented locations, so the display-mode rules are identical. The public OpenStreetMap tile servers have a [fair-use policy](https://operations.osmfoundation.org/policies/tiles/) that does not allow heavy production traffic; use a Google key or a commercial tile provider for production, or set `none`. Address search and geocoding always need Google.

## Google Maps integration

| Variable | Scope | Used for |
| --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | Public, referrer-restricted | Drawing maps (Maps JavaScript API). Also address lookups when no server key is set (then it must allow Places API (New) and Geocoding API). |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | Public | Map ID for advanced markers and clustering. Falls back to `DEMO_MAP_ID`, which is for development only. |
| `GOOGLE_MAPS_SERVER_KEY` | **Optional**, server only, never `NEXT_PUBLIC_` | Places API (New) autocomplete and place details, Geocoding API, via `POST /api/maps/{autocomplete,place,geocode,reverse-geocode}`. Recommended in production. |
| `MAPS_PIN_QUERY_LIMIT` | Server | Pins per map request, 50–1000, default 500. |

**Lookup providers.** With a server key, lookups run on the server (`src/modules/maps/server/service.ts`) behind the CSRF/session/membership checks, the OWNER/ADMIN role check and the shared rate limits. Without one, the server answers `MAPS_NOT_CONFIGURED`. If a browser key exists, the client then switches to the Maps JavaScript API (`src/modules/maps/client/browser-lookup.ts`: `AutocompleteSuggestion`, `Place.fetchFields`, `Geocoder`). In that mode Google's per-key quotas are the only limit, so prefer a server key. Autocomplete is restricted to the UAE and uses session tokens, so a search and its place-details call are billed as one session. Only the typed text, a place ID or a pin position is sent to Google, never tenant data.

**Errors.** `MapsProviderError` classifies failures from both providers. No message includes the key, and server logs (`maps.provider_error`) record only Google's status code.

| Reason | Cause | API response |
| --- | --- | --- |
| `REJECTED` | Invalid key, API not enabled, key restrictions, billing (`PERMISSION_DENIED`, `REQUEST_DENIED`, HTTP 401/403, `FAILED_PRECONDITION`) | 503 `MAPS_PROVIDER_REJECTED` |
| `QUOTA` | `RESOURCE_EXHAUSTED`, `OVER_QUERY_LIMIT`, `OVER_DAILY_LIMIT`, HTTP 429 | 429 `MAPS_QUOTA_EXCEEDED`, `Retry-After: 60` |
| `INVALID_REQUEST` | `INVALID_ARGUMENT`, `INVALID_REQUEST` | 400 |
| `NOT_FOUND` | Unknown place, no location | 404 (geocoding returns an empty list) |
| `UNAVAILABLE` | Network failure, 8 s timeout, 5xx | 503 `MAPS_UNAVAILABLE`, `Retry-After: 10` |

In the browser, a rejected browser key is reported by Google through `window.gm_authFailure`. The map then shows "Google Maps rejected the browser key" with the checks to make, instead of Google's error overlay. A script that fails to load shows "The map could not be loaded". With no browser key, maps show "Map preview is not configured", and forms still accept typed addresses and coordinates.

### Google Cloud setup (requires approval; may incur charges)

1. In the environment's Google Cloud project, enable **Maps JavaScript API**, **Places API (New)** and **Geocoding API**, and attach a billing account.
2. Create the **browser key**. Application restriction: HTTP referrers `http://localhost:3000/*` (development) and the exact production origin (matching `APP_ORIGIN`). API restriction: Maps JavaScript API, plus Places API (New) and Geocoding API only if no server key will be used.
3. Recommended: create the **server key**, restricted to Places API (New) and Geocoding API. App Hosting has no fixed egress IP by default, so rely on the API restriction, quotas, and storing the key only in Secret Manager. Never commit it.
4. Create a **Map ID** (Google Maps Platform → Map management, JavaScript) and set `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`.
5. Set per-API daily quotas and budget alerts.
6. Local: add the variables to `.env.local` and restart `npm run dev:local` (rebuild after changing `NEXT_PUBLIC_` values). Hosted: store `GOOGLE_MAPS_SERVER_KEY` as an App Hosting secret and declare the public values in `apphosting.yaml`.
7. Verify once with real keys (not yet done): autocomplete, place selection, "Locate address", "Fill address from pin", pin dragging, cluster rendering, and an invalid-key test.

## Listing and property maps at scale

`/properties?view=map` and `/listings?view=map` reuse each page's filters (emirate, community, property type, status, price and others).

- The first page of pins is rendered by the server. After the user pans or zooms, `GET /api/maps/pins?resource=…&south&north&west&east&offset&<filters>` returns the pins inside the visible area, filtered and paged on the server. The browser never asks for a whole tenant's inventory.
- Each response carries `total` (all matches, including unmapped and hidden), `mapped` (mapped matches in the area), `mappedAll` (mapped matches anywhere), `limit`, `offset` and `hasMore`. The status line always says how many are shown, how many are outside the area, and how many have no visible location. "Load more" fetches the next page (up to 2,000 pins in the browser; beyond that the user zooms in or narrows filters). Nothing is dropped silently.
- Markers are grouped with the official `@googlemaps/markerclusterer` (SuperCluster algorithm) using advanced markers. Cluster badges show the listing count, and selecting a cluster zooms into it. Approximate locations appear as area dots and show their circle while selected.
- The results list is the accessible equivalent of the map and stays in sync with it. Selecting a marker opens the preview card and scrolls the list to it. Selecting a list row opens the same card, then pans and zooms the map to bring the marker out of its cluster.
- Database limits: `limit` ≤ 1000 and `offset` ≤ 20000 in the stored operations' `@auth`.

## Rate limiting

`src/lib/rate-limit/` is a reusable distributed limiter: fixed windows, opaque HMAC-style bucket keys and pluggable stores.

- **Shared store (default, `RATE_LIMIT_BACKEND=sql-connect`):** `RateLimitCounter` rows in the app database are updated by one `INSERT … ON CONFLICT DO UPDATE … RETURNING` statement (`dataconnect/connector/rate-limits.gql`, `NO_ACCESS`, Admin SDK only). Concurrent hits from any number of instances are counted exactly. This uses the existing SQL Connect service, so no Redis or other new service is needed. Expired windows are purged in the background.
- **Local fallback (`RATE_LIMIT_BACKEND=memory`):** per-process counters for local development and tests, refused in production. If the shared store errors, the limiter logs `rate_limit.store_error` and uses per-instance memory counters for that request rather than allowing everything.
- **Subjects:** member, client IP and company. `RATE_LIMIT_TRUSTED_PROXY_HOPS` sets how many proxies' `X-Forwarded-For` entries to trust (App Hosting: 1). With 0, forwarded headers are ignored and per-IP limits are skipped, never keyed on a spoofable value. IPv6 clients are grouped by /64. Raw IDs and IPs are never stored or logged; `RATE_LIMIT_KEY_SECRET` salts the keys.
- **Responses:** 429 `RATE_LIMITED` with `Retry-After`. Blocks and store errors are logged as structured JSON (`rate_limit.blocked`, `rate_limit.store_error`) with running per-scope totals for Cloud Logging metrics or alerts.

| Scope | Member | IP | Company |
| --- | --- | --- | --- |
| Autocomplete | 60 / min | 120 / min | 2,000 / hour |
| Place details + geocoding + reverse geocoding (shared) | 30 / min | 60 / min | 600 / hour |
| Map pins (`/api/maps/pins`) | 120 / min | 240 / min | — |

A Redis-compatible store can be added by implementing `RateLimitStore.increment`. Provisioning Redis (for example Memorystore) is a paid resource that needs approval and is not required.

## Public client-facing maps

There is no public website module yet (Phase 7). The reusable pieces are:

- `src/modules/maps/public.ts`: allowlist sanitizers that take raw rows of **one** company and return the only shapes a public page may receive.
  - `isPublicListing` requires `publicationStatus = PUBLISHED`, `listingStatus = ACTIVE`, an unarchived listing and property, and an unexpired advertising permit number.
  - `toPublicListingPin(s)` returns title, purpose, price, type, bedrooms, bathrooms, size, community and emirate text, the presented location and the permit number. Street addresses, unit numbers, area/sub-community, references, agents and owners are never copied.
  - `toPublicProjectMap` covers ACTIVE or COMPLETED projects. Building markers are included only when the project is `EXACT`.
- `src/modules/maps/components/public-maps.tsx`: `PublicListingMap` (clustered, with a list and preview card showing the permit number) and `PublicProjectMap`. They are mobile-friendly and make no CRM API calls.

Location follows `presentMapLocation(…, {revealExact: false})` for every visitor: `EXACT` shows the approved point, `APPROXIMATE` the grid-cell centre with no place ID, `HIDDEN` no coordinates. Tests render the components to HTML and check that hidden or approximate exact coordinates, place IDs and internal fields appear neither in the props nor in the HTML.

**Integration point (Phase 7).** A public route must resolve the agency from its own published-site configuration (custom domain or site slug stored server-side), never from a URL organization ID. It should then read with a dedicated `NO_ACCESS` operation executed by the Admin SDK that returns only that company's published listings, pass the rows through `toPublicListingPins`, and render `PublicListingMap`. Keep these routes outside the CRM `(workspace)` routes and their session checks, and give them their own per-IP rate limit.

## Using it

- **Forms:** on a property's Location step, a project's Location section or a developer's Head office section, search for a place, pick a suggestion, then review the filled fields and pin. Drag the pin or click the map to adjust it. "Fill address from pin" reverse-geocodes the point without moving it; "Locate address" geocodes the typed address. Choose the map visibility (projects and properties) before saving.
- **Detail pages:** property and project pages show a map section with the display mode and an "Open in Google Maps" link. Projects also show building markers, and developer pages show the head office.

## Database rollout (not performed on hosted data)

All changes are additive.

- **Phase 5F (first part):** the `MapDisplayMode` enum, `city`, `googlePlaceId` and `mapDisplayMode` on `project` and `property`, and one property index.
- **Phase 5F completion:**
  - `developer.head_office_latitude`, `head_office_longitude` (`numeric(9,6)`) and `head_office_google_place_id` (nullable).
  - The new `rate_limit_counter` table with a `window_ends_at` index.
  - Map-pin queries gain optional bounds and offset variables.
  - Developer mutations gain optional head-office variables.

Existing callers keep working. Before a hosted rollout, with approval:

1. `npm run sql:validate`, then review the SQL that `firebase dataconnect:sql:diff` reports for the target instance. Expect only `CREATE TYPE`, `CREATE TABLE`, `ALTER TABLE … ADD COLUMN` and `CREATE INDEX` statements.
2. Optionally check for stored coordinates outside the UAE: `SELECT id FROM property WHERE latitude IS NOT NULL AND (latitude NOT BETWEEN 22.4 AND 26.5 OR longitude NOT BETWEEN 51.0 AND 56.6);` (and the same for projects with `country = 'AE'`).
3. Apply the migration and deploy the schema and all connector files together, then deploy the app with the regenerated SDK.
4. Configure the keys and `RATE_LIMIT_KEY_SECRET` / `RATE_LIMIT_TRUSTED_PROXY_HOPS=1`.

## Tests

- `npm run test:maps`: display-mode policy, viewport snapping, validation, provider error classification (server and browser), incomplete places, the Google client against a mocked `fetch` (the key never appears in results or errors), and the public sanitizers and components (no hidden/approximate coordinates or internal fields in props or rendered HTML). No real Google requests.
- `npm run test:rate-limit`: windows, bucket keys, multi-check decisions, fallback, eviction, trusted-proxy IP parsing.
- `npm run test:dataconnect` (isolated emulator):
  - Location persistence, including developer head offices.
  - Database coordinate checks.
  - A generated 620-listing dataset: limits, offset paging without gaps, viewport and price filters, agent scope, cross-tenant isolation.
  - The shared rate-limit store from four concurrent app instances, which allows exactly the limit in total.
- `npm run test:maps:e2e`: the real app in headless Chrome against isolated Auth and SQL Connect emulators, with no Google keys and without loading `.env.local`.
  - OWNER, ADMIN, AGENT and other-company sessions.
  - Developer, project and property location create, refresh and edit.
  - The 620-listing map paging.
  - Viewport API filtering.
  - Privacy of agent HTML and API responses.
  - Lookup authorization and not-configured responses.
  - Shared rate limiting through the app.
  - 390 px mobile layouts.

## Limitations and follow-up

- Live Google calls and real map rendering (pins, dragging, clustering, viewport refresh, `gm_authFailure`) have not been exercised; they need approved keys. Browser tests cover the not-configured paths only.
- The approximate grid is fixed at ~1 km; it is not configurable per company.
- The browser keeps at most 2,000 pins; larger areas require zooming or filters.
- Public map routes are not implemented (no public website module yet); see the integration point above.
