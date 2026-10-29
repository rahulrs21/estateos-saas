# AI Copilot tools

The Copilot has exactly eight **read-only** tools (`src/modules/ai/tools/definitions.ts`). Claude can only *request* a tool. EstateOS validates the request and runs it on the server as the signed-in member (`src/modules/ai/server/tools.ts`), using the same services as the CRM screens.

## Rules common to every tool

- **Registry:** a name that is not one of the eight is rejected (`UNKNOWN_TOOL`) and nothing runs.
- **Validation:** each tool's JSON schema is sent to Claude with `strict: true` (`additionalProperties: false`, no numeric or length keywords). Strict mode allows at most 24 optional and 16 nullable (union-typed) parameters across all tools in a request, which the live API enforces with a 400. `anthropicTools()` keeps the first 24 optional parameters optional and sends the rest as required-but-nullable; the executor treats `null` as omitted. A unit test pins both limits, so adding a parameter means removing or merging another. The server then re-validates against a strict Zod schema that adds limits (`INVALID_ARGUMENTS` on failure). Neither schema has an `organizationId`, user, role, membership, agent id, SQL or query field; any such field is rejected.
- **Scope:** organization, role and assignee restrictions come from `requireActiveOrganizationRequest()` on every call. The services and stored operations enforce:
  - owners and administrators see company-wide data;
  - agents see only leads and inventory assigned to them;
  - managers have lead access but no inventory scope.
- **No existence oracle:** "not found" and "not permitted" return the same result (`NOT_FOUND_OR_NOT_PERMITTED`), so guessed IDs reveal nothing. Unexpected errors become `CRM_UNAVAILABLE`, with no provider or SQL detail.
- **Bounds:**
  - at most 20–25 results returned;
  - in-memory filters scan at most 3 pages of 100 rows and report `coverage.complete`;
  - 15 s per tool;
  - 40,000 characters per result.
- **Minimisation:** presenters (`tools/present.ts`, `tools/records.ts`) are allowlists. They never include:
  - customer email addresses, phone numbers or nationality;
  - contact, lead, follow-up or activity note text;
  - property internal notes, ownership and mandate references;
  - coordinates, Google place IDs or media file names;
  - member email addresses.

  Record text is stripped of control and bidi-override characters and length-capped.
- **Map privacy:** text location only. The street address is included only when the record's map mode is `EXACT`. `APPROXIMATE`, `HIDDEN` and unknown modes give emirate, city, community and area only.
- **Prices:** minor units are converted to AED and labelled with their basis (active listing asking price, monthly or annual rent, property reference price, or project starting price).
- **Links:** relative EstateOS paths (`/properties/{id}`, `/listings/{id}`, `/projects/{id}`, `/leads/{id}`). The UI renders only internal paths and https links.
- **Audit:** each call writes an `AiToolExecution` row with tool name, status, error code, result count and duration. Arguments and results are not stored.

## Tools

### searchProperties

Searches inventory the user may see.

- **Inputs:** `emirate`, `community` (any location text: community, area or district), `propertyType`, `bedrooms` (exact; 0 = studio), `minBedrooms`, `minPrice`/`maxPrice` (AED), `purpose` (`SALE`/`RENT`), `availability` (`AVAILABLE` by default, `RESERVED`, `ANY`), `marketType` (`OFF_PLAN`/`SECONDARY`), `projectId`, `projectName`, `limit` (≤ 20).
- **Without `purpose`:** property units through `listInventory("properties")`. The price filter applies to the property *reference* price.
  - Community: an exact, case-insensitive database match is tried first.
  - Fallback: a bounded word match across community, area, city and project name, with aliases (JVC, JVT, JLT, JBR, DIFC, Downtown, Marina, Dubai Hills, Palm, MBR City, Saadiyat, Yas, Reem and others).
- **With `purpose`:** `ACTIVE` listings through `listInventory("listings")`, priced by asking price, cheapest first. Rent budgets are compared as annual rent (monthly × 12).
- **Output:** results with id, reference, link, type, market, bedrooms, bathrooms, size, text location, project and developer, availability and labelled price, plus `coverage`.

### getPropertyDetails

- **Inputs:** exactly one of `propertyId` or `propertyReference`. A reference must match exactly one visible property.
- **Source:** `getInventoryRecord("properties")`, which for agents is the assigned-property query, plus up to 10 of the property's listings.
- **Output:** the summary fields above, plus building, unit number, floor, plot size, furnishing, occupancy, parking, view, assigned agent display name, amenities, features, and listings with status and asking price.

### searchProjects

- **Inputs:** `name`, `developerName`, `emirate`, `community` (also matches area and city), `projectStatus`, `handoverFrom`/`handoverTo` (dates), `minStartingPrice`/`maxStartingPrice` (AED), `limit` (≤ 20).
- **Source:** `listInventory("projects")`. Location, developer, handover and price filters are applied in memory with coverage reporting.
- **Output:** id, name, link, developer, location, status, construction status, expected and actual handover, starting price, total units and available unit count.

### getProjectDetails

- **Inputs:** exactly one of `projectId` or `projectName`. If several projects match the name, the tool returns candidates and asks for clarification.
- **Output:**
  - the summary fields, plus code, ownership, launch date, description (≤ 800 characters), phases and amenities;
  - payment plans with booking, handover and instalment percentages, triggers and months after handover;
  - available unit types (counts and reference price ranges by type and bedrooms, limited to units the user can see).

### searchLeads

- **Inputs:**
  - `search` (name), `status`, `priority`, `transactionType`;
  - `followUp` (`OVERDUE`, `TODAY` in Dubai time, `UPCOMING`, `ANY`);
  - `assignment` (`MINE`, `UNASSIGNED`, `ANY`) or `assignedAgentName`;
  - `source`, `preferredLocation`, `minBudget`/`maxBudget` (AED, overlap match), `limit` (≤ 25).
- **Source:** `listLeads`, the same stored queries and assignee rules as the Leads screen. `TODAY` uses the same stored query with a Dubai-day follow-up window. Agent names resolve through `ListLeadAssignees`; if several names match, the tool returns candidates.
- **Output:** id, link, name, status, stage, priority, buy/rent/invest, property type, bedrooms, preferred location, budget, source, next follow-up time and whether it is overdue, assigned agent display name, created and updated dates. No contact details.

### getLeadDetails

- **Inputs:** `leadId`.
- **Source:**
  - `getLead`, which is assignee-restricted;
  - `getLeadPropertyData`, giving the shortlist, primary interest and viewings (not available to managers);
  - `ListLeadFollowUps` (10);
  - `ListLeadActivities` (15).
- **Output:** the summary fields above, plus archived flag, property interest text (≤ 300 characters), shortlist, primary project and property, viewings (time, status, confirmation, outcome), follow-ups (title, due date, status, overdue, assignee) and recent activity *types* with time and actor. Note bodies are excluded.

### getDashboardSummary

- **Inputs:** none.
- **Source:** `GetLeadMetrics`, overdue and upcoming follow-up counts from `listLeads`, and `GetInventoryDashboardMetrics` (not for managers). Agents' figures are self-scoped by the stored queries.
- **Output:** total, new, qualified and won/converted leads; leads with overdue or upcoming follow-ups; total, available and reserved properties; active listings. Each figure is labelled with its scope and `asOf` time.

### getMatchingPropertiesForLead

- **Inputs:** `leadId`, `limit` (≤ 20).
- **Source:** `getLeadPropertyData`, the **existing Phase 5D engine** (`matchProperty`). It considers available units with an active listing that match the lead's location, type, bedrooms, transaction type, budget and interested project. No second matching engine exists.
- **Output:** matches with property, listing, labelled price and the engine's reasons, plus candidate coverage.

## Adding or changing a tool

1. Add the JSON and Zod schemas and a label in `tools/definitions.ts`. `tests/ai-tools.test.ts` fails if they drift apart or if strict mode is broken.
2. Implement the handler in `server/tools.ts` using an existing read service. Do not call SDK operations that bypass the service's role checks, and never accept an organization, user or role argument.
3. Present output through an allowlist presenter, and add privacy assertions to the tests.
4. Bump `AI_PROMPT_VERSION` if the instructions change.
5. Write-capable tools are out of scope for Phase 6A. They need an explicit user-approval step and separate authorization review (Phase 6B or later).
