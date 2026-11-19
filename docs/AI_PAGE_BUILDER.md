# AI landing page and website builder (Phase 6D)

Agency staff build single-page real estate campaigns from CRM records:
1. Choose a project, listing or property.
2. Start from Claude, a template, a blank page or a copy of an existing page.
3. Edit the page in a three-panel visual editor and preview it on desktop, tablet and mobile.
4. Connect an existing CRM lead form.
5. Submit the page for review; an owner or administrator approves and publishes it to `/site/{companySlug}/{pageSlug}`.

Enquiries become leads through the existing Phase 4 website capture.

Related documents:
- [Component registry](PAGE_COMPONENT_REGISTRY.md): the page data format and the 20 section types.
- [Website publishing](WEBSITE_PUBLISHING.md): workflow, checklist, UAE advertising, public pages, SEO and custom domains.
- [AI security](AI_SECURITY.md#phase-6d-landing-page-builder): threats and controls.

Nothing was deployed. Hosted SQL Connect, App Hosting, DNS and paid services were not changed.

## Architecture

| Layer | Code | Role |
| --- | --- | --- |
| Registry | `src/modules/websites/registry.ts` | Zod schemas for the page, theme and 20 section types; plain-text rules; slugs |
| Linked data | `linked.ts` | Public-safe presenters for CRM records, section data availability, change detection |
| Templates | `templates.ts` | 7 built-in templates built from the registry |
| Claude | `ai.ts` | Structured-output schema, prompts, mapping to sections, fact check |
| Checklist | `checklist.ts` | Publication checklist and attestations |
| Snapshot | `snapshot.ts` | Published snapshot format, public paths, live eligibility |
| Rendering | `components/page-renderer.tsx`, `page-islands.tsx`, `theme.ts` | One renderer for the editor, previews and public pages |
| Editor UI | `components/page-editor.tsx`, `editor-fields.tsx`, `publish-panel.tsx`, `new-page-wizard.tsx`, `websites-overview.tsx` | Workspace screens |
| Server | `server/sources.ts`, `store.ts`, `service.ts`, `generate.ts`, `public.ts`, `http.ts` | Authorized reads, stored operations, generation, publishing, public reads |
| Database | `dataconnect/schema/schema.gql` (end of file), `dataconnect/connector/websites.gql` | 7 additive tables, 33 stored operations |

Everything in the first five rows is pure and unit-tested without I/O (`tests/websites.test.ts`).

### Routes

| Path | Purpose |
| --- | --- |
| `/websites` | Pages of the company website; pending enquiries for owners and administrators |
| `/websites/new` | New page wizard (accepts `?projectId=`, `?listingId=`, `?propertyId=` and `?mode=` as pre-fill only) |
| `/websites/{websiteId}` | Website settings (name, default style, agent drafts) |
| `/websites/{websiteId}/pages/{pageId}/edit` | Visual editor |
| `/site/{companySlug}/{pageSlug}` | Public page (no login) |
| `/sitemap.xml` | Marketing home and live pages |

The first release has one website per company, created automatically on first use. The `Website` table and the `websiteId` in addresses allow several sites later.

### API

All workspace endpoints need a verified session. Mutations also need same-origin, the CSRF token and an `X-EstateOS-Organization` header matching the server-resolved company. The company and role always come from the session.

| Method and path | Who | Purpose |
| --- | --- | --- |
| `GET /api/websites` | Members | Website, pages in scope, permissions, pending enquiries (admins) |
| `PUT /api/websites/settings` | Owner, admin | Name, default style, allow agent drafts |
| `POST /api/websites/pages` | See [permissions](#permissions) | Create from a template, blank or duplicate |
| `POST /api/websites/pages/generate` | Same | Create with Claude |
| `GET /api/websites/pages/{id}[?version=n]` | Page readers | Editor payload: page, version data, linked data, checklist, history, live status |
| `PUT /api/websites/pages/{id}` | Page editors | Save a new version (body up to 256 KiB) |
| `POST /api/websites/pages/{id}/{action}` | Varies | `generate`, `restore`, `submit`, `approve`, `reject`, `publish`, `unpublish`, `archive`, `form` |
| `GET /api/websites/pages/{id}/enquiries` | Owner, admin | Leads from this page and its pending enquiries |
| `POST /api/websites/pending/{id}/{retry\|dismiss}` | Owner, admin | Pending enquiry recovery |
| `POST /api/public/sites/{companySlug}/{pageSlug}/enquiries` | Public | Enquiry submission |
| `GET /api/public/site-media/{publicationId}/{mediaId}` | Public | Images and videos of live pages only (videos streamed with byte ranges) |

## Database (additive)

Defined at the end of `schema.gql`:

| Table | Purpose |
| --- | --- |
| `Website` | One per company now. `designSettings` holds visual defaults only; company identity stays on `Organization` and `AiBrandProfile` (not duplicated). `allowAgentDrafts` gates agent drafts. |
| `WebsitePage` | Title, slug (unique per company), description, page type, plain source IDs (no foreign keys, so CRM records can still be archived), status, SEO fields, style, `revision` (compare-and-set), version counters, approved version, live publication |
| `PageVersion` | Append-only page data (`structuredPageData`, validated JSON, up to 200,000 characters), schema version, kind, fact-check record, model; only the approval stamp is ever set later |
| `PagePublication` | Approved version plus the public-safe snapshot, slug at publication, source fingerprint, checklist and attestations; `ACTIVE`, `SUPERSEDED` or `UNPUBLISHED` |
| `PageLeadFormBinding` | The existing `LeadCaptureForm` that receives a page's enquiries |
| `WebsitePageEnquiry` | Links a lead created by the existing capture transaction to its page and publication, with UTM source, medium and campaign |
| `PendingWebsiteEnquiry` | A validated enquiry whose lead transaction failed, kept for retry |

Also added:
- **Enums:** `WebsiteStatus`, `WebsitePageType`, `WebsitePageStatus`, `PageVersionKind`, `PagePublicationStatus` and `PendingEnquiryStatus`.
- **Audit and activity values:** `WEBSITE`, `WEBSITE_PAGE`, `PAGE_PUBLICATION`, `WEBSITE_ENQUIRY` and nine `WEBSITE_*` activity kinds.

The local-only reset (`dataconnect/seed_data.gql`) empties the new tables in a separate `ResetEstateOSWebsites` step: one mutation can hold at most 50 deletes.

**Hosted rollout (requires approval):**
1. Back up the database.
2. Deploy the schema and the `websites.gql` connector together with the application.
3. Smoke-test with a dedicated test company.

No existing table changes, so no data migration is needed.

## Permissions

| Role | Pages | Inventory-linked pages | Review | Approve, publish, unpublish, rollback | Lead forms, enquiries, settings |
| --- | --- | --- | --- | --- | --- |
| OWNER, ADMIN | All company pages | Yes | Yes | Yes | Yes |
| MANAGER | Read all; create and edit their own | No (no inventory scope in EstateOS) | Return to draft with a note | No | No |
| AGENT | Only their own, and only when **Allow agents to create page drafts** is on | Their assigned inventory only | No | No | No |

**Enforcement:**
- The database enforces these rules in every stored operation (membership `@check` with the `createdByUid` scope pattern from the Content Studio).
- The services enforce them again.
- Linked records are always read through the existing inventory services as the member, so agent and manager scope, record-level access and map privacy apply unchanged.
- No marketing role exists in EstateOS, so publishing is limited to OWNER and ADMIN.

## Linked CRM data and marketing content

The editor separates the two kinds of content.

- **Linked CRM data (read-only in the builder):** prices, availability, unit types, payment plans, floor plans, amenities, photos, developer, location, permits and approved company contacts.
  - It is read from the records each time the editor loads, and frozen into the snapshot at publication.
  - The inspector labels it **From CRM**.
  - The builder never writes CRM records.
- **Marketing content (editable):** headlines, introductions, highlights, FAQs, button labels, layout, theme and section order. It is stored in page versions.

`linked.ts` presenters are allowlists:
- **Never included:** unit numbers, street addresses, internal references, notes, owner or mandate data, member details, file names, brochures or documents.
- **Images:** only active JPEG, PNG or WebP files of the linked records.
- **Map points:** always pass through `presentMapLocation(..., {revealExact: false})`.
  - EXACT keeps the approved point.
  - APPROXIMATE becomes the ~1 km grid-cell centre.
  - HIDDEN has no coordinates at all.

  The editor preview therefore shows exactly what the public would see.

A section whose data is missing is not rendered on the public page and is labelled in the editor (for example *Payment plans – no active payment plan is recorded*). Nothing is filled with placeholder figures.

**When linked data changes after publication:**
- The editor compares a fingerprint of the current linked data with the live publication's and lists the differences (prices, availability, permits, plans, units, photos, location, contacts).
- The live page keeps its published values until an owner or administrator chooses **Republish with current CRM data**. Nothing is republished automatically.
- If a linked listing is no longer advertisable, or a project becomes inactive or its permit expires, the public page goes offline (see [publishing](WEBSITE_PUBLISHING.md#live-eligibility)).

## Claude generation

Claude generation reuses the Phase 6A/6B infrastructure:
- the Anthropic client;
- `generateStructured`, with structured outputs, adaptive thinking, streaming and cache breakpoints;
- the monthly allowance (`reserveQuota`, released when Claude was never reached);
- per-minute limits (`ai.pages.member|ip|company`);
- `AiUsageRecord` with `feature = PAGES`, `contentType = LANDING_PAGE` and prompt version `6e.1` (page structures and style tones; `6d.2` before).
- An output budget of at least 16,000 tokens, because a full page now has 12–18 sections of rich copy.

**Flow** (`server/generate.ts`):
1. Verified session, company and CSRF.
2. Strict request schema.
3. Rate limits.
4. Every linked record re-read with the caller's permissions (`required: true`).
5. Approved branding (`AiBrandProfile`).
6. Allowance.
7. One structured request.
8. Zod re-validation.
9. Mapping and registry validation.
10. Fact check.
11. Storage by a NO_ACCESS operation.

**What Claude receives:** a minimal fact sheet (`aiFacts`):
- project, listing and property facts;
- unit groups, payment-plan summaries, floor-plan names and amenities;
- the number of approved photos, location text and privacy mode;
- which contacts exist;
- the approved brand name, tagline and tone.

Record descriptions are sent separately as `<untrusted_record_text>`, and the staff brief as `<staff_brief>`. No IDs, URLs, coordinates, media, leads or contacts are sent.

**What Claude returns:** a flat JSON structure (`PAGE_GENERATION_JSON`):
- a title, SEO title and SEO description;
- a style and an accent from enums;
- sections with an enum type, a variant name and plain-text fields;
- per section, an `imageTag` (a stock subject such as `MARINA` or `POOL`, or `NONE`) and, for key facts, `statSources` chosen from the CRM fact list;
- missing information and claims to review.

All properties are required and none is nullable, which keeps the schema within structured-output limits. Claude never returns props, URLs, media IDs, CSS, HTML or code. The system prompt asks for a complete, persuasive page in the style of premium Dubai launch pages, with concrete copy built only from the fact sheet.

**Mapping** (`mapGeneratedPage`):
- **Removed and reported:** unknown or non-AI types. Testimonials, landmarks and comparisons are never written by Claude.
- **Duplicates:** single-use sections keep only the first copy.
- **No CRM data:** sections without data are left out and listed as omitted.
- **Text:** stripped of angle brackets and control characters, and cut to registry limits.
- **Buttons:** actions whose contact is not approved fall back to the enquiry form.
- **Images:** chosen by the mapper, never by Claude. The linked records' photos are used first, in order; Claude's `imageTag` then picks unused stock photos of that subject.
- **Hero:** a full-screen photo hero when the records have photos, otherwise a stock video hero.
- **Key facts:** only CRM sources are mapped; their values always come from the CRM.
- **Rhythm:** a navigation bar is added first, and section backgrounds alternate so the page reads as distinct bands.
- **Required section## Editor

`/websites/{id}/pages/{pageId}/edit` is a full-screen visual editor modelled on Elementor (`components/editor/`). The canvas is the same renderer as the public page.

**Top bar**
- Back to Websites, page title and save state ("Unsaved changes" or "Saved · version N").
- Desktop, tablet and mobile preview widths. Container queries make sections reflow as on real screens.
- Undo and redo, **Preview** (hides the editing chrome), **Claude** (redesign with a brief), **Save** and **Publish**.

**Left panel** (collapsible)
- **Elements:** every section type as a tile, grouped (Layout, Introduction, Property & project, Media, Location, Conversion, Trust, Footer) with a search box.
  - Drag a tile onto the canvas; a blue line shows where it will land. Clicking a tile adds it after the selected section.
  - Single-use types already on the page are greyed out.
- **Navigator:** the section list. Click to select, drag to reorder, and show or hide each section; a note marks sections that are left off the public page and why. The arrow beside a section opens its **elements**, as drawn on the canvas and nested in their groups (for example Buttons › Primary button); click one to edit it. **Drag an element row** onto another to reorder: list items (facts, highlights, questions…) move within their list; the hero text (badge, eyebrow, headline, subheadline, price line, buttons), the hero buttons and section headings (eyebrow, heading, intro) store the chosen order in the section style (`elementOrder`, applied only where set, so other pages render as before). Elements in different parts of the layout cannot swap places (the editor says so; use the move handle instead). Each element row has duplicate, hide and delete buttons, and **right-click** on any row opens the same menu as on the canvas.
- **Site style:** design style, accent swatches or a custom colour, heading and body fonts, type scale and corners.
- **Page:** title, address, description, search title and description with counts, and the linked record.
- **Publish:** the existing workflow panel (status, checklist, lead form, Claude's content checks, versions, publications and enquiries). Checklist items are fixed in place:
  - **Approved contact details** and **Disclaimer:** owners and administrators approve the company phone and email, add WhatsApp or the marketing disclaimer in a form under the item (the same brand settings as Content Studio). A disclaimer for one page goes in its footer.
  - **Lead form:** connect or create a form under the item.
  - **Page title** and **search** items open the Page tab; **testimonials**, **landmarks**, hidden sections and a page-set location open their section.
  - **Permits, project status, listings and photos** link to the CRM record in a new tab, because those values change only in the CRM; **Re-check** re-reads the checklist without losing unsaved edits.

When a section is selected, the left panel shows its settings in three tabs:
- **Content:** per-type fields from `FIELD_SPECS`, including image and video pickers, list editors and a **From CRM** box for linked values.
- **Style:** layout variant, height, content width, alignment, background (theme colour, custom colour, photo or video with an overlay), text tone and colour, and an entrance animation.
- **Advanced:**
  - **Position:** content position (default, top, middle or bottom) and **Move all content** with arrow buttons or exact px values. Alt + arrow keys nudge the selected element (or all content when nothing is selected) by 4 px, or 20 px with Shift. **Reset** clears every customised element of the section.
  - **Spacing:** the vertical padding preset, plus custom **padding** and **margin** (top, right, bottom, left in px, with a link button for all four sides) for the device being previewed. Empty sides inherit from the larger device or the preset, shown as placeholders.
  - **Visibility** per device, and the section ID.

**Single elements** (Elementor-style): click any element on the canvas, or pick it in the Navigator: a heading, eyebrow, paragraph, button, image, the enquiry form, a list item (a highlight, key fact or FAQ), a CRM card (units, prices, payment steps, floor plans, amenities), a gallery photo, the map, the video, or a group (the hero's buttons, key facts, price line). The panel switches to that element with a breadcrumb back to its section, in three tabs like a section:
- **Content:** its text (also editable on the canvas); a button's words and what it does; an image; each field of a list item (title, text, icon, the CRM fact it shows); for a group, the elements inside it; for the enquiry form, its button text and the fields of the connected lead form, with a link to edit them (fields belong to the lead form so every page using it stays consistent). Elements that show CRM data say so and are styled and moved here.
- **Style:** typography (font, size with a separate phone size, weight, letter case, italic, letter spacing, line height); colour and a highlight or button colour (forms: background, text and button colour); alignment; corner radius, maximum width and opacity.
- **Advanced:** move it with arrow buttons, exact px values, Alt + arrow keys or the **drag handle** on the canvas (one undo step per drag); space above or below (which, unlike moving, pushes the content below); and visibility per device.
- **Copy style** and **Paste style** between elements, and **Reset element**. A list item (for example one key fact) also has **Duplicate next to it** and **Delete**.
- **Key facts:** every fact has a value field, in the fact's own panel and in the Key facts list. A CRM value shows as the field's placeholder (or "not recorded"); typing makes it the fact's own text (Custom). A fact's **label** and **value** are elements of their own ("Fact 1 value"), so each can be coloured, sized and moved, and both can be typed on the canvas like a headline. A colour set on the whole fact reaches its label and value. On the showcase layouts, over a background photo or video, fact values use the readable text colour instead of the accent.
- Text typed on the canvas is saved as typed, even where the style shows it in capitals (labels, eyebrows).
- **Right-click menu of an element** (canvas or Navigator): Edit, Duplicate, **Copy**, **Paste**, Copy style, Paste style, Hide, Reset, Delete, Edit section. Paste puts a copied list item right after the target (a fact after a fact), adds it at the end when pasted on the list, or replaces an element of the same kind (text on text, a button on a button), with the copied style; other combinations are refused with a message. Every result is validated like any other change.
- **Hero background:** when the hero has a background photo or video (Style › Background media), the Content tab edits that background, so the photo you change is the one you see. Escape returns to the section; Delete never removes the section while an element is selected.

Also selectable: the hero badge, highlight cards, key-fact items, and form panels (the hero's split form, the enquiry form section and the form widget). A form panel has its own background, text colour, button and focus colour, corner radius and width; its fields, borders and labels follow the background automatically. By default the hero's form panel keeps the theme's colours, so it stays readable over a photo, video or dark background.

Widgets in custom sections have the same typography and colour controls in their Style tab.

**Canvas**
- **Inline editing:** click any heading, paragraph, button label or list item and type. Text is plain text (`contentEditable="plaintext-only"`); Enter or clicking away commits and Escape cancels. Public pages contain no editable regions.
- **Section toolbar** on hover or selection: drag handle, move up and down, duplicate, settings and delete. A "+" button between sections opens the Elements panel and inserts there.
- **Right-click menu:** edit, duplicate, copy style, paste style, move up or down, hide or show, delete.
- **Shortcuts:** Ctrl+S saves, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y undo and redo, Ctrl+D duplicates, Delete removes and Escape deselects. Moves are announced in a live region.
- A banner marks the canvas as an internal preview, not approved for public advertising.

**Lead form and contact details**
- The enquiry form section's Content tab connects a lead form, or creates one (default fields, consent text, privacy link, thank-you message) and connects it, through the existing lead-form APIs. Until a form is connected the canvas shows a sample form; public pages show nothing.
- The **Contact details** section shows the approved company contacts (phone, WhatsApp, email, office address and hours) and, optionally, an agent card. Owners and administrators edit company contacts in a drawer (the same brand settings as Content Studio) and set an agent's public title, phone and WhatsApp. Pages store only the agent's membership ID; inactive members are never shown. Publishing asks for the agent-consent attestation.

**Uploads**
- The image picker has **Uploads**, **Project** and **Stock** tabs. Uploads accept JPEG, PNG and WebP up to 10 MB (button or drag and drop), checked by content signature, with size limits enforced while streaming and per-member, per-IP and per-company rate limits.
- Library images can be reused on any page of the company. The uploader or an owner or administrator can remove one; published pages that use it keep showing it.
- The video picker (a background video, a video section or a video widget) has **Uploads** and **Stock** tabs. Uploads accept MP4 and WebM up to 50 MB, checked by content signature (an MP4 `ftyp` box that is not a still-image brand such as HEIC; a WebM EBML header), with a separate hourly allowance of 30 videos per company. Pages store only the library ID; an image slot only takes an image and a video slot only a video (checked on save).
- Videos are streamed from Storage and honour a single HTTP byte range (206, or 416 past the end), which Safari needs for playback; images are sent whole. Publishing adds uploaded videos on visible sections to the publication allowlist, like images, and the sharing image is always an image.

**Locations**
- A location section, or a map widget, can use the linked record's location or a location set on the page: a place name, address, "Find on map" (one address lookup per click) and a pin placed on the map, shown as an exact pin or an approximate area.

<a id="convert-to-custom-section"></a>
**Convert to custom section**
- A built-in section (Hero, Feature, Highlights, Key facts, Project overview, Banner, Enquiry form, WhatsApp and Call prompts, Video, and a Gallery with its own photos) can be turned into a custom section from its right-click menu (canvas or Navigator) or its Advanced tab, after a confirmation. Undo with Ctrl+Z.
- Each part becomes a widget in rows and columns: headings (the hero headline stays the page's H1), text, buttons, images, icon lists and boxes, the video, the image grid and the lead form. Prices, locations and key facts become **counters**, which keep reading the CRM. Element styles move to their widgets; moved elements start at their normal place.
- The section keeps its ID (links and the navigation menu keep working), visibility, devices, background and spacing. A full-screen hero's photo becomes the section background. Rows already added inside the section stay. A page still shows the lead form once: a split-form hero keeps its form only when there is no enquiry form section.
- Not converted, with the reason shown: sections drawn from CRM records (units, prices, payment and floor plans, amenities, developer, location map, comparison), FAQ (no accordion widget yet), testimonials, nearby places, the countdown, contact details, the navigation bar and the footer. The converter (`convert.ts`) is a pure function, and its result is validated with the whole page.

**Custom sections, columns and containers**
- **Add a section** (the button under the page, or the "+" between sections) first asks for a structure, as in Elementor: one column, 50 / 50, 33 / 67, 67 / 33, 25 / 75, 75 / 25, three columns, 25 / 50 / 25, or four to six columns. **Or add a ready-made section** opens Elements.
- **Rows:** in the Content tab, each row has its layout and **column widths** (a slider and a % field per column; changing one takes the difference from its neighbour, so the row adds up to 100 %).
- **Devices:** tablet columns or stacked; on phones stacked, side by side, or stacked in reverse order.
- **Container style:** background colour or image with an overlay, padding, corners, minimum height and column alignment. Each column has a background, padding and content position.
- **Inner section:** a widget that holds its own columns, for columns inside a column.
- **Adding widgets:** drag them from Elements onto any column, including an inner section's columns. Drop a widget on the middle of a built-in section (a hero, overview and so on) to add it inside that section, before or after its content. Near a section's edge, a new custom section is created.
- **Moving placed widgets:** drag a widget by its handle (top left, on hover) to another column, into another section, or between sections.
- **Built-in sections** list their added rows under **Columns and widgets in this section** in the Content tab.
- Click a widget on the canvas to edit it in its own Content, Style and Advanced tabs, with a breadcrumb back to the section. Delete and Ctrl+D act on the selected widget; Escape deselects it. The Navigator lists every widget.

**Navigation bar**
- Logo upload with a height, or the brand name.
- Menu links you choose (text and the section they go to; links to hidden or removed sections are left out), or the automatic list.
- Menu position (left, centre or right), the button, the approved company phone, sticky.
- A menu button on phones and tablets, which works without JavaScript on public pages.
- The links, logo and button can be styled on their own.

**Gallery viewer**
- On public pages, a gallery photo opens a full-screen viewer: next and previous buttons, arrow keys, swiping, Escape or a click outside to close, and a photo counter. Photos are plain links to the image, so they also work without JavaScript.
- The viewer shows only the image URLs the page already serves through its publication allowlist. In the editor, a click selects the gallery instead, and **Open photos full screen** switches the viewer off.

**On phones and tablets**
- Below 1024 px, the editor panel is a drawer.
- A bottom bar has **Add**, **Elements**, **Edit** (the selected section), **Layers** and **Publish**.
- The top bar is compact, and drawer controls are sized for touch.

**Saved sections**
- Right-click a section and choose **Save to library**. It appears under **My sections** in Elements for everyone in the company who edits pages, and is inserted with new IDs. Project photos are removed when saving because they belong to one record.

**Also:** a global button shape in Site style, a 75 % canvas zoom, and a keyboard shortcut list (press `?`).

**Media pickers**
- **Project photos:** active photos of the linked records.
- **Stock library:** the curated catalogue, filterable by subject. Stock media is labelled as illustrative on the page and needs an attestation before publishing.

**Saving and history**
- Saving creates a new version with a compare-and-set on the page revision.
  - A concurrent change returns 409 and keeps local edits.
  - The client validates with the registry schema before saving, and the server validates again.
  - Image references must be photos of the linked records or catalogue stock IDs.
- Undo and redo keep 50 steps.
- The browser warns before leaving with unsaved changes.
- **Restore** copies an older version into a new version, and **Preview** of a past version is read-only.

## Page structures

`structures.ts` separates a page's **structure** (which sections, in which order, with which variants) from its **design style** (colours, type and look), so two pages about the same project can look completely different.

| Structure | Sections | Used by default for |
| --- | --- | --- |
| `SIGNATURE` | Claude's choice in the original order (full-screen hero, key facts, overview, features, gallery, plans, location, FAQ) | (choose it: the original layout) |
| `STORY` | Editorial hero over a wide photo, overview, three feature chapters, photo carousel, amenities, payment plan, location, developer, FAQ | Editorial Magazine, Warm Organic |
| `SHOWCASE_3D` (Cinematic showcase) | Wordmark hero (the record name, large, over the photo), statement overview with big figures, numbered residences, two dark amenity bands, numbered service rows, photo carousel, milestones, location, FAQ; floating menu | 3D Depth |
| `BENTO` | Split hero, fact tiles, highlight tiles, bento gallery, amenity icons, units, milestones, location, FAQ | Bento Grid |
| `GALLERY_FIRST` | Full-screen photo, bento gallery, overlap feature, coverflow, video, amenity photos, location, banner | Glass Aurora |
| `MINIMAL` | Typographic hero with a wide photo, fact strip, overview with facts, photo grid, unit and payment tables, location, FAQ | Swiss Minimal |
| `QUICK_LAUNCH` | Split hero, fact ticker, highlights, the enquiry form early, photos, payment plan, WhatsApp banner, FAQ | Bold Statement |
| `INVESTOR` | Split hero, fact cards, prices, payment plan, units table, overview, developer, location, FAQ | Modern Corporate |
| `PRESTIGE` | Centred-logo menu, full-screen photo with the headline low and the buttons beside it, overview beside a portrait, numbered photo grid, amenity photos, units and plan tables, developer, FAQ | Luxury Minimalist |
| `NOIR` | Statement over the photo with the key facts, overlapping feature, mosaic, film, amenities list, payment timeline, location | Premium Dark |
| `BOUTIQUE` | Big serif headline centred over the photo with the key facts, two features, carousel, amenity photos, units, location | Elegant Light |
| `LISTING` (Property card) | Frosted detail card and fact bar over the photo, mosaic, overview with facts, feature, amenities, floor plans, payment plan, location | Contemporary |
| `CAMPAIGN` | Enquiry form beside the headline and key facts in the first screen, highlights, carousel, payment plan, units, WhatsApp banner | High-Conversion |

**Choosing.** The request may name a `style` and a `structure` (both strict enums). The structure used is the one chosen, else the chosen style's own (`resolveStructure`); with neither, Claude chooses both from the lists in the task prompt and returns `structure` in its output (an enum in the JSON schema). A style or structure chosen by staff always wins over Claude's.

**Applying.** Claude is told the structure's exact sections and order and the style's copy tone. After it answers, `mapGeneratedPage` applies the structure on the server, so it holds even if Claude strays:
- sections the structure does not list (or extra repeats) are left out and reported in `removed`;
- sections are sorted into the structure's order, the n-th repeat taking the n-th place;
- each section takes the structure's variant (lists are used in turn), style and layout;
- structures with an `IMAGE` hero move the hero photo from the background into the layout and use a solid, sticky navigation bar;
- `PLAIN` structures keep every section on the page background;
- structures whose next section shows the key facts hide the hero's own fact strip (`heroFacts: false`), so facts are never shown twice.

`SIGNATURE` changes nothing: the page is mapped exactly as before. The same CRM rules apply to every structure: sections whose data is missing are omitted, and Claude never writes prices, dates or plans.

## Style gallery

The new-page wizard shows every style and structure visually (`components/style-gallery.tsx`):
- **Design style:** "Let Claude choose", the seven new styles and the six signature styles. Each card is a live miniature of a sample page in that style and its structure.
- **Page structure:** "Match the design style" (the default), or one of the eight structures, drawn as a wireframe and marked "Recommended" for the chosen style.
- **Preview:** opens the full sample page at desktop, tablet or phone width, with **Use this design**.

The previews are built in the browser by `style-samples.ts`: a fictional project ("Azure Bay Residences") with sample copy goes through the same `mapGeneratedPage` and `PageRenderer` as a generated page, so a preview shows the real layout, variants and look; only the words and photos differ. The photos are curated stock photos, the form is a preview that never submits, no company record, lead or contact is read, and nothing is stored. Miniatures render when they scroll into view, use small photos, play no video and run no animation. The editor's **Claude** dialog offers the same style and structure choices as lists.

## Templates

`templates.ts` has eight built-in templates, each a complete page (7 sections for "coming soon", 10–17 for the others):
- new project showcase (the wizard's default): a sticky navigation bar, a hero with the enquiry form beside the headline and the CRM key facts, then overview, amenities, investment, payment plan, floor plans, gallery, location, a call-back form, an advisor banner, FAQ and footer, in the order buyers usually read a new-project page;
- off-plan project launch;
- luxury apartment campaign;
- villa or townhouse listing;
- property investment enquiry;
- rental property campaign;
- developer project showcase;
- coming soon / register interest.

A typical template has a transparent navigation bar, a full-screen hero (photo or video), key facts, an overview with an image, feature sections, amenities with photos, a bento gallery, payment-plan milestones, unit types, floor plans, a video showcase, location, the developer, a call-to-action banner, an FAQ, the enquiry form and the footer.
- **Photos:** the linked records' own photos where there are any, otherwise labelled stock photos and videos.
- **Facts:** templates contain no figures, dates, payment terms, testimonials or distances. Prices, handover dates, payment plans and units always come from the CRM, and sections without data are left off the public page.
- **FAQ:** generic process answers only (how to register, what happens next), with no claims about the project.
- Templates are code shared by every company, so no company's data can be copied across companies.

**Blank page** starts with a navigation bar, a full-screen hero showing the key facts, an enquiry form and a footer; add the rest from Elements.

**Duplicate** copies a page the member can read in the same company. It re-authorizes the linked records and drops photos the member cannot use.

ndo and redo keep 50 steps (Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y; Ctrl+S saves).
- The browser warns before leaving with unsaved changes.
- **Restore** copies an older version into a new version.

## Templates

`templates.ts` has eight built-in templates:
- new project showcase;
- off-plan project launch;
- luxury apartment campaign;
- villa or townhouse listing;
- property investment enquiry;
- rental property campaign;
- developer project showcase;
- coming soon / register interest.

Templates are layout and neutral wording only. They contain no figures, dates, payment terms, testimonials or distances, and they are code shared by every company, so no company's data can be copied across companies.

**Duplicate** copies a page the member can read in the same company. It re-authorizes the linked records and drops photos the member cannot use.

## Lead forms and enquiries

Pages reuse the Phase 4 website lead forms and distribution. There is no second ingestion system.
- An owner or administrator connects an existing, non-disabled form of the same company (the database checks both).
- The enquiry form section shows that form's enabled fields, consent text and privacy-policy link.

`POST /api/public/sites/{companySlug}/{pageSlug}/enquiries` handles a submission:
1. Resolves the live publication and its bound form on the server. The request names no company.
2. Requires the page to show an enquiry form section.
3. Calls `captureWebsiteSubmission`, the same path as `/forms/{publicId}`:
   - strict validation against the form's fields and required consent;
   - 16 KiB body limit, honeypot and minimum fill time;
   - 30 submissions per form per minute;
   - idempotency key (a retry never creates a second lead);
   - exact single-match contact association (duplicate detection);
   - the existing distribution rule, notifications, activity, audit and consent evidence, all in one SQL transaction.
4. Records the server-built page URL as the landing page. If the visitor did not describe their interest, `propertyInterest` is set to "Landing page: {title} · Project/Listing: {name}".
5. Stores UTM attribution and links the lead to the page (`WebsitePageEnquiry`).

**Never silently lost:** if the lead transaction fails after the enquiry was validated (for example no active default pipeline), the validated enquiry is stored as a `PendingWebsiteEnquiry`. The visitor sees the success message, because the enquiry was received, and owners and administrators see it on `/websites`.
- **Retry** reuses the original idempotency hash, so it can never create a duplicate lead.
- **Dismiss** records who dismissed it.

This applies to `/forms/{publicId}` too. The visitor sees an error only if the pending record also cannot be stored.

**Fix found during testing:** website capture failed whenever the form had no transaction-type field (the default form configuration), because `null` overrode the column's `BUY` default. The variable is now omitted so the default applies.

## Maps

Location sections use the Phase 5F components and privacy rules:
- **Location text:** community, area, city and emirate only.
- **Google Maps link:** from the display location.
- **Interactive map:** `MapCanvas`, loaded only when a visitor clicks **Show interactive map**, so page views cause no paid map loads by themselves.
- **HIDDEN locations:** no coordinates in the HTML, API responses or client props.
- **APPROXIMATE locations:** the generalized grid point, not the exact point with a blurred marker.
- **Nearby landmarks:** staff-entered only, require **Verified by our team**, and have no distance field. EstateOS stores no verified place data, and Claude never writes landmarks.

## Testing

| Suite | Command | Covers |
| --- | --- | --- |
| Unit | `npm run test:websites` (part of `npm test`) | Registry, HTML/JS rejection, templates, reordering, AI mapping and clipping, fact check, linked data, map privacy, internal-field exclusion, missing images, permits and checklist, live eligibility, change detection, rendering (escaping, one `h1`, container classes, preview banner), request schemas, slugs, snapshots |
| Integration | `npm run test:dataconnect` | Roles and agent drafts, tenant isolation, compare-and-set versions, append-only history, review and approval, server-only publication, superseding, live-slug protection, public reads, sitemap, form binding, enquiry links, pending enquiries |
| Browser | `npm run test:websites:e2e` (`AI_E2E_LIVE=1` adds one live Claude generation) | The full owner flow from the Required Final Result, roles, public page security, enquiries, outdated data, offline on expired permit, restart persistence, unpublish |
| Persistence | `npm run test:persistence` | A page, version and publication survive a hard kill of the local database |

Results are recorded in [PROJECT_HANDOVER.md](PROJECT_HANDOVER.md#phase-6d-verification-status).

## Limitations

- **Single pages only:** multi-page sites and site-wide headers are not built; the navigation bar links to sections of the same page. The schema and routes leave room for more.
- **No custom domains:** see [publishing](WEBSITE_PUBLISHING.md#custom-domains-future-adapter).
- **Images:**
  - Images come from the linked records' active photos or the stock catalogue; there is no page-level upload or logo image. The brand's `logoReference` is not rendered because it is an unverified URL.
  - Stock photos and videos are hotlinked from Unsplash and Pexels. If a provider removes a file it stops showing; copying chosen files into Storage is future work.
  - Videos are stock only; project videos and YouTube or Vimeo embeds are not supported.
  - CRM photos are not resized. Next's optimizer would cache them for 4 hours after an unpublish, so they are served as uploaded, lazy-loaded with fixed aspect ratios.
- **Roles:** managers cannot link inventory (EstateOS gives them no inventory scope), and there is no dedicated publisher or marketing role.
- **Recovery:** pending enquiry retry lists the newest 50.
- **Outdated-data comparison:** uses the data visible to the viewer, so an agent may see differences caused by their narrower scope.
- **Editor:** no column or widget-level layout (sections are the building blocks), no free positioning and no custom CSS, by design.
- **Not built:** page analytics beyond enquiry counts (no visit tracking), A/B testing, scheduled publishing, multi-language pages and an Arabic layout.
