# Page component registry

`src/modules/websites/registry.ts` defines everything a landing page can contain. A page is validated structured data, never markup. The same schema validates:
- editor saves, on the client and the server;
- Claude output, after mapping;
- stored versions on every read;
- publication snapshots before public rendering.

## Page data

```json
{
  "schemaVersion": 1,
  "theme": {"style": "PREMIUM_DARK", "accent": "GOLD", "customAccent": null, "font": "DISPLAY", "headingFont": "PLAYFAIR", "bodyFont": "INTER", "scale": "LARGE", "radius": "ROUND"},
  "sections": [
    {
      "id": "hero-main", "type": "HERO", "variant": "fullBleed", "visible": true,
      "devices": {"desktop": true, "tablet": true, "mobile": true},
      "layout": {"spacing": "NORMAL", "background": "DEFAULT", "align": "START"},
      "style": {"backgroundType": "VIDEO", "backgroundColor": null, "backgroundImage": null, "backgroundVideo": {"stockId": "video-dubai-shore"},
                "overlay": 55, "overlayTone": "DARK", "textTone": "AUTO", "textColor": null, "height": "SCREEN", "width": "WIDE",
                "animation": "FADE_UP", "spacingTablet": null, "spacingMobile": null},
      "props": {"eyebrow": "New launch", "headline": "Register your interest", "subheadline": "", "primaryCta": {"label": "Enquire now", "action": "ENQUIRE"},
                "secondaryCta": null, "image": null, "showPrice": true, "showLocation": true, "badge": "", "showFacts": true}
    }
  ]
}
```

| Field | Rules |
| --- | --- |
| Envelope | Strict objects: any unknown key is rejected. Up to 40 sections. Fields added after the first release have defaults, so older stored pages still validate. |
| `id` | 3–41 characters of `a-z0-9-`, unique within the page |
| `type` | One of the 25 types below |
| `variant` | One of that type's variants |
| `visible` | Hide or show |
| `devices` | Per-device visibility. Container queries: mobile under 48 rem, tablet 48–64 rem, desktop 64 rem and above. |
| `layout.spacing` | `NONE`, `COMPACT`, `NORMAL` or `SPACIOUS` on desktop; `style.spacingTablet` and `style.spacingMobile` override it |
| `layout.background` | `DEFAULT`, `MUTED`, `ACCENT` or `DARK` |
| `layout.align` | `START` or `CENTER` |
| `style` | The editor's Style and Advanced tabs, see below. Defaults to no background media. |
| Single-use types | At most one per page: all except key facts, feature with image, highlights, gallery, video and banner |

**Section style** (`sectionStyleSchema`), from fixed enums or validated values only:

| Field | Values |
| --- | --- |
| `backgroundType` | `NONE` (the layout background), `COLOR`, `IMAGE` or `VIDEO` |
| `backgroundColor`, `textColor` | `#rrggbb` only. Without a text colour, text is chosen for contrast. |
| `backgroundImage` | An image reference (below) |
| `backgroundVideo` | `{stockId}` from the stock video catalogue |
| `overlay`, `overlayTone` | 0–90 % of a `DARK`, `LIGHT` or `ACCENT` overlay over media backgrounds |
| `textTone` | `AUTO`, `LIGHT` or `DARK` |
| `height` | `AUTO`, `MEDIUM`, `TALL` or `SCREEN` |
| `width` | `BOXED`, `WIDE` or `FULL` |
| `padding`, `margin` | Optional px values per device and side: `{desktop, tablet, mobile}`, each `{top, right, bottom, left}` or null. Padding is 0–400 and margin −400–400; whole numbers only. Tablet inherits desktop and mobile inherits tablet. Without padding the spacing preset applies; unset top and bottom sides keep the preset's value. Rendered as CSS variables with fixed utility classes. |
| `contentVertical` | `AUTO`, `TOP`, `CENTER` or `BOTTOM`: where content sits in a section with a height |
| `contentOffset` | `{x, y}` in px (−600 to 600): moves all of the section's content |
| `elementOffsets` | Up to 40 entries of prop path → `{x, y}` (for example `headline`, `items.2.title`, `primaryCta`, or the hero's `buttons`, `facts` and `priceLine`). Keys must match a strict path pattern. Rendered as relative positioning, so surrounding layout does not move. |
| `elementStyles` | Up to 40 entries of prop path → element style (same keys as `elementOffsets`), see below. |
| `animation` | `NONE`, `FADE_UP`, `FADE`, `ZOOM` or `SLIDE_LEFT`. CSS scroll-driven animations: off for reduced motion and in browsers without `animation-timeline`. |

**Element style** (`elementStyleSchema`): the look of one heading, eyebrow, paragraph, button, image or group. Every field is optional and null keeps the theme or section value:
- `color` and `background` (button fill, text highlight, or a group's or panel's background) and `accent` (a form panel's button and focus colour): `#rrggbb`;
- `font` (`HEADING` or `BODY`), `weight` (`LIGHT`–`BOLD`), `italic`, `textCase`;
- `size` 10–120 px and `sizeMobile` 10–96 px (without it, large type is reduced on phones automatically);
- `letterSpacing` −10–50 (hundredths of an em) and `lineHeight` 80–250 %;
- `align` (`LEFT`, `CENTER`, `RIGHT`), `maxWidth` 80–1600 px, `spaceBefore` / `spaceAfter` −400–400 px;
- `radius` 0–80 px (everything except text), `opacity` 10–100 %;
- `devices`: shown on desktop, tablet and mobile (hidden elements are faded in the editor).

The renderer turns these into fixed inline properties (`elementCss` in `theme.ts`); no page text reaches CSS. Widgets use the same schema for their own text, image or button (`widget.style.text`).

**Image references** are one of:
- `{mediaId, alt}`: an active photo of the page's linked records;
- `{stockId, alt}`: an entry in the curated stock catalogue (`stock.ts`);
- `{uploadId, alt}`: an active image in the company's website library (checked on save; archived images may stay where they already were).

## Safety rules

- **Plain text only:** every text field rejects `<`, `>`, control characters other than tab and newlines, `javascript:` and `vbscript:` URLs and `data:text/html`.
  - Text is rendered by React (escaped); nothing is used as HTML.
- **Buttons name an action, never a URL:** `ENQUIRE`, `WHATSAPP`, `CALL`, `EMAIL`, `GALLERY` or `LOCATION`.
  - The renderer builds links from approved company contacts and fixed anchors.
  - A button whose contact is not approved is not shown.
- **Images are IDs, never URLs:**
  - CRM media IDs must be active photos of the page's linked records. The server rejects new unknown IDs on save, and the publication checklist blocks unknown ones.
  - Stock IDs must be in the code catalogue. The renderer builds the Unsplash or Pexels CDN URL from the catalogue, so a page can never point at an arbitrary host.
- **No CSS:** themes and layouts choose from fixed tokens (`theme.ts`). The only free values are `#rrggbb` colours, checked by a strict pattern and applied as inline style values.
  - Preset accent colours meet WCAG AA on their style's background.
  - With a custom accent, contrast is the editor's responsibility; button text on it is chosen for contrast.
- **No code:** no scripts, event handlers or embeds. The only external resources are catalogue stock images and videos; fonts are self-hosted. The only outbound links are:
  - approved contacts;
  - the Google Maps link built from the display location;
  - HTTPS permit verification links recorded in the CRM;
  - the lead form's HTTPS privacy-policy URL.

## Section types

"Linked data" is read-only CRM data (see [linked data](AI_PAGE_BUILDER.md#linked-crm-data-and-marketing-content)). A section whose data is missing is left off public pages.

| Type | Variants | Editable props | Linked data / shown when | Claude |
| --- | --- | --- | --- | --- |
| `NAVBAR` | transparent, solid | logo image and height (20–96 px), brand text (empty uses the company name), menu links (up to 8: text and a section ID of this page; empty lists the main sections automatically), menu position (left, centre, right), button, company phone, a menu button on phones and tablets, sticky | Company name and approved phone; links only to sections shown on the page | Added automatically |
| `HERO` | fullBleed, split, splitForm, centered | eyebrow, badge, headline, subheadline, two buttons, photo, show price, location and key facts | Price, location and key facts (optional) | Yes |
| `STATS` | strip, cards | heading, up to 6 items, each a CRM source (price, handover, payment plan, bedrooms, units, size, developer, location, type, construction) or custom text | CRM values only for CRM sources; a typed value is ignored. Items without a value are hidden. | Yes |
| `FEATURE_SPLIT` | split, overlap | eyebrow, heading, body, up to 6 bullets, image, image side, button | None | Yes |
| `VIDEO_SHOWCASE` | wide, contained | eyebrow, heading, body, stock video, poster | None | Yes |
| `BANNER` | centered, left | eyebrow, heading, body, two buttons; usually with a background photo or video | None | Yes |
| `PROJECT_OVERVIEW` | withFacts, imageRight, text | heading, body (empty uses the project description), show facts | Developer, construction, handover, units, type, bedrooms, size, view; needs a project, property or listing | Yes |
| `DEVELOPER` | card, banner | heading, body | Developer name and profile | Yes |
| `HIGHLIGHTS` | grid, list | heading, intro, columns, up to 8 items (title, text, icon) | Needs at least one item | Yes |
| `GALLERY` | bento, grid, carousel | eyebrow, heading, intro, columns, chosen photos, CRM or stock (none means all CRM photos), full-screen viewer (on by default; bento shows “+N” on its last tile) | Approved photos or chosen stock | Yes |
| `UNIT_TYPES` | table, cards | heading, intro | Available units grouped by type and bedrooms, with indicative reference prices | Yes |
| `PRICING` | cards, banner | heading, intro, note | Listing asking price, project starting price, comparison prices | Yes |
| `PAYMENT_PLANS` | milestones, timeline, table | heading, intro | Active payment plans (booking, instalments, handover) | Yes |
| `FLOOR_PLANS` | grid, list | heading, intro | Floor plans with their images | Yes |
| `AMENITIES` | imageCards, icons, list | heading, intro, columns | Project and property amenities | Yes |
| `LOCATION` | mapRight, mapTop | heading, body, offer interactive map, optional location set on the page (label, address, pin, exact or approximate) | Location text and display point (EXACT, APPROXIMATE or none) | Yes |
| `LANDMARKS` | list, grid | heading, intro, up to 12 places (name, category, note), **verified** | Staff-entered; public only when verified; no distances | No |
| `COMPARISON` | table | heading, intro, 2–4 listing IDs | Listings the member can access; each must be advertisable | No |
| `ENQUIRY_FORM` | imageSplit, card, split | heading, intro, button label, image, up to 4 points | The connected lead form's fields, consent and privacy link | Yes |
| `WHATSAPP_CTA` | banner, card | heading, body, button label, pre-filled message | Approved WhatsApp number | Yes |
| `CALL_CTA` | banner, card | heading, body, button label | Approved company phone | Yes |
| `CONTACT` | cards, split, minimal | eyebrow, heading, intro, which company contacts to show, agent, button | Approved company phone, WhatsApp, email, office address and hours; the chosen agent's card (name, title, phone, WhatsApp, work email) read from the membership | No |
| `CUSTOM` | default | Rows → columns → widgets, see below | Per widget | No |
| `TESTIMONIALS` | cards, quote | heading, up to 6 quotes (quote, author, context), **consent confirmed** | Staff-entered; public only with consent confirmed | No |
| `FAQ` | accordion, list | heading, up to 12 questions and answers | Needs at least one item | Yes |
| `COUNTDOWN` | banner | heading, body, target (launch or handover date) | Recorded date in the future | Yes |
| `FOOTER` | detailed, simple | disclaimer (empty uses the brand disclaimer), show contacts | Company name, tagline, approved contacts, permits, disclaimer and "as recorded on" date | Yes |

**Compliance footer:** the renderer always shows the company identity, the permits of every advertised listing and project, the disclaimer and the record date, whether or not the page has a footer section. When the page uses stock media, the footer also says that photos and videos are illustrative stock media and not of the advertised property.

## Custom sections

A `CUSTOM` section holds 1–6 rows. Every other section except the navigation bar and footer can hold up to 3 rows of its own (`extra`: `{position: BEFORE | AFTER, rows}`), shown before or after its built-in content.

**Rows are containers:**
- **Layout:** `1`, `1-1`, `1-2`, `2-1`, `1-3`, `3-1`, `1-1-1`, `1-2-1`, `1-1-1-1`, `1-1-1-1-1` or `1-1-1-1-1-1` (one to six columns).
- **Widths:** optional `widths`, one whole percentage (5–95) per column, adding up to 100; null uses the layout's proportions.
- **Spacing:** a gap.
- **Devices:** `stackOnTablet` (columns from desktop only), `mobile` (`STACK` or `KEEP` side by side) and `reverseOnMobile`.
- **Container style:** `background` (`#rrggbb`), `backgroundImage` with a dark `overlay` (0–90 %), `padding`, `radius` (0–80 px), `minHeight` (0–1200 px) and `align` of the columns.

Widths become grid tracks in custom properties with fixed utility classes; no page text reaches CSS. Each column has up to 12 widgets, an optional `#rrggbb` background, padding and vertical alignment.

| Widget | Props | Shown publicly when |
| --- | --- | --- |
| `HEADING` | text, level (H2–H4), size, small label | Always |
| `TEXT` | plain text (line breaks kept), size, softer colour | Always |
| `IMAGE` | image reference, shape, rounded, caption | The image resolves |
| `BUTTON` | CTA (action allowlist), solid or outline, full width | The action has an approved target |
| `ICON_LIST` | up to 12 points with icons | Always |
| `ICON_BOX` | icon, title, text, card background | Always |
| `COUNTER` | CRM fact source or custom text, label | The value is recorded (CRM values are never typed) |
| `VIDEO` | stock video, poster, shape | Always (counts as stock media) |
| `SPACER` / `DIVIDER` | height 8–240 px / short or full | Always |
| `MAP` | linked record's location or a location set on the widget | A location exists |
| `FORM` | button label | A lead form is connected; at most one form (section or widget) per page |
| `CONTACT_CARD` | agent, show company contacts | An agent or an approved contact exists |
| `GALLERY` | 1–12 image references, 2–4 columns, full-screen viewer | At least one image resolves |
| `INNER_SECTION` | layout, widths and device settings like a row, with 1–6 columns of other widgets (inner sections do not nest) | One of its widgets can be shown |

Every widget also has a style: alignment, text colour, padding and margin (px), entrance animation and device visibility. IDs of rows, columns and widgets are unique across the page. A widget path identifies it in the editor: `rows.0.columns.1.widgets.2` in a custom section, `extra.rows.0.columns.0.widgets.1` in content added to a built-in section, and `…widgets.2.props.columns.0.widgets.0` inside an inner section. Public pages carry no editor attributes. Every rule that applies to widgets also applies to added content and inner sections: map privacy, uploads in the publication allowlist, stock media, agents and one lead form per page.

## Stock media

`stock.ts` is a curated, code-reviewed catalogue of 55 photos (Unsplash) and 8 videos (Pexels), tagged by subject: skyline, marina, beach, island, Abu Dhabi, night, villa, rooms, pool, gym, spa, park, advisor and architecture. Both licences allow commercial use without attribution; credits are kept in the catalogue.
- Pages store only catalogue IDs. The renderer builds URLs, `srcset` widths and video files.
- Stock media is **illustrative**. Publishing a page that uses it requires the `STOCK_MEDIA_ILLUSTRATIVE` attestation, and the checklist adds a manual item to replace it with the project's own photos where possible.
- The files are hotlinked from the providers' CDNs. A later step can copy chosen files into Firebase Storage.

## Design styles

| Style | Look |
| --- | --- |
| `LUXURY_MINIMALIST` | Warm off-white, serif headings, square corners |
| `PREMIUM_DARK` | Near-black with light text and display headings |
| `MODERN_CORPORATE` | White and slate, sans headings |
| `ELEGANT_LIGHT` | Soft warm light, serif headings |
| `CONTEMPORARY` | Clean white, sans headings |
| `HIGH_CONVERSION` | White with warm accents, compact scale |

**Theme options:**
- **Accents:** gold, navy, emerald, teal, terracotta, slate, rose or indigo, each with a light-background and a dark-background value, or a custom `#rrggbb` accent.
- **Fonts:** separate heading and body fonts: Playfair Display, Cormorant Garamond, DM Serif Display, Inter, Manrope, Montserrat, Poppins or the system stack. `next/font` self-hosts them (`fonts.ts`), so visitors' browsers contact no font service.
- **Scales:** compact, comfortable or large.
- **Buttons:** rounded, pill or square (`theme.buttonShape`).
- **Corners:** square, soft or rounded.

## Adding a section type

1. Add the type to `SECTION_TYPES`, its props schema to `PROPS`, its definition (variants, group, `aiAllowed`, `single`, `linked`) and its `defaultProps`.
2. Add availability rules in `sectionAvailability` (`linked.ts`) when it shows CRM data, and presenters if it needs new linked data. They must be allowlists.
3. Render it in `SectionBody` (`page-renderer.tsx`). Use only text props and linked data; build any link from approved data. Wrap editable text in `T` with its prop path so it can be edited on the canvas.
4. Add its Content fields to `FIELD_SPECS` (`components/editor/section-panel.tsx`) and an icon to `SECTION_ICONS` (`components/editor/panels.tsx`).
5. Decide whether Claude may write it. If so, map it in `ai.ts`; it then appears in `AI_SECTION_TYPES` automatically.
6. Add checklist items when it carries claims that need human confirmation.
7. Extend `tests/websites.test.ts`: validation, unsafe text rejection, availability and rendering.
8. Bump `PAGE_PROMPT_VERSION` if Claude's instructions change. Keep `PAGE_SCHEMA_VERSION` unless stored pages need migration; a new version needs a migration path in `parseStoredPageData`.
