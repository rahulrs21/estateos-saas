import { approximateCoordinates, describeLocation, googleMapsUrl, presentMapLocation, type DisplayLocation } from "../maps/geo";
import { isPublicListing } from "../maps/public";
import { areaText, cleanText, emirateName, formatMoney, humanize, minorToMajor } from "../ai/tools/present";
import { groupUnits, type ApprovedBranding, type UnitRecord } from "../ai/content/facts";
import { canonicalUuid } from "../organizations/server/identifiers";
import { isCrmImageRef, isStockImageRef, isStockVideoRef, isUploadImageRef, isUploadVideoRef, mapSectionWidgets, sectionWidgets, type CustomLocation, type ImageRef, type Widget, type WidgetOf, type PageData, type PageSection, type SectionOf, type SectionType, type StatSource, type VideoRef } from "./registry";
import { stockCredit, stockImage, stockImageSrcSet, stockImageUrl, stockVideo, stockVideoUrl } from "./stock";

/**
 * Linked CRM data for a landing page (docs/AI_PAGE_BUILDER.md#linked-crm-data).
 *
 * Every value here comes from a CRM record the viewer was allowed to read and
 * passes through an allowlist: no internal references, unit numbers, street
 * addresses, owner or mandate data, notes, member details or file names. Map
 * points always go through presentMapLocation with revealExact: false, so the
 * editor preview shows exactly what the public would see: EXACT keeps the
 * approved point, APPROXIMATE becomes the ~1 km grid-cell centre, HIDDEN has
 * no coordinates at all. Marketing text lives in the page data; nothing here
 * is editable in the builder, and the builder never writes CRM records.
 */

export interface LinkedMoney { amountMinor: string; currency: string; display: string }
export interface LinkedMedia { id: string; kind: "PHOTO" | "FLOOR_PLAN"; alt: string; url: string; isCover: boolean }
export interface LinkedListing {
  id: string; title: string; purpose: "SALE" | "RENT"; price: LinkedMoney & {rentalPeriod: "MONTHLY" | "YEARLY" | null};
  propertyType: string | null; bedrooms: number | null; bathrooms: number | null; size: string | null; locationText: string; emirate: string | null;
  availability: string | null; permitNumber: string | null; permitExpiryDate: string | null; permitVerificationUrl: string | null;
  /** Explicitly published, active, permitted and unexpired (maps/public.ts isPublicListing). */
  eligible: boolean; issues: string[];
}

export interface LinkedData {
  readAt: string;
  company: {name: string; tagline: string | null; disclaimer: string | null; phone: string | null; email: string | null; whatsapp: string | null; website: string | null;
    /** Office details from the brand profile (absent in snapshots published before they existed). */
    address?: string | null; hours?: string | null};
  /** Company members shown as agents on contact sections (absent in older snapshots). */
  agents?: LinkedAgent[];
  /** Website library images the page uses (absent in older snapshots). */
  uploads?: LinkedUpload[];
  project: {
    id: string; name: string; developerName: string | null; status: string; statusLabel: string | null; constructionStatus: string | null;
    launchDate: string | null; handoverDate: string | null; startingPrice: LinkedMoney | null; totalUnits: number | null; description: string | null;
    permitNumber: string | null; permitExpiryDate: string | null; permitVerificationUrl: string | null; emirate: string | null;
  } | null;
  developer: {name: string; description: string | null} | null;
  property: {id: string; type: string | null; bedrooms: number | null; bathrooms: number | null; size: string | null; plotSize: string | null; view: string | null; furnishing: string | null; availability: string | null; emirate: string | null} | null;
  listing: LinkedListing | null;
  comparison: LinkedListing[];
  unitTypes: {complete: boolean; groups: Array<{type: string | null; bedrooms: number | null; availableUnits: number; priceFrom: string | null; priceTo: string | null}>} | null;
  paymentPlans: Array<{name: string; booking: string | null; handover: string | null; installments: Array<{share: string | null; due: string; note: string | null}>}>;
  floorPlans: Array<{id: string; name: string; type: string | null; bedrooms: number | null; size: string | null; mediaId: string | null}>;
  amenities: string[];
  media: LinkedMedia[];
  location: {text: string; display: DisplayLocation; mapsUrl: string | null} | null;
  /** Readable notes on data that exists but could not be used (permissions, missing records). */
  unavailable: string[];
}

export interface LinkedUpload { id: string; url: string; alt: string; width: number | null; height: number | null; contentType?: string }
export interface LinkedAgent { id: string; name: string; title: string | null; phone: string | null; whatsapp: string | null; email: string | null }

// --- Source shapes (subsets of the permission-checked CRM service records) ---

export interface ProjectSource {
  id: string; projectName: string; projectStatus: string; constructionStatus?: string | null; archivedAt?: string | null; description?: string | null; marketingDescription?: string | null;
  developer?: {id?: string; name: string} | null; emirate?: string | null; city?: string | null; community?: string | null; area?: string | null;
  latitude?: number | null; longitude?: number | null; googlePlaceId?: string | null; mapDisplayMode?: string | null;
  launchDate?: string | null; expectedHandoverDate?: string | null; startingPriceMinor?: string | number | null; currency?: string | null; totalUnits?: number | null;
  permitNumber?: string | null; permitExpiryDate?: string | null; permitReferenceUrl?: string | null;
  projectAmenities_on_project?: Array<{amenity?: {name: string} | null}>;
}
export interface PropertySource {
  id: string; propertyType: string; bedrooms?: number | null; bathrooms?: number | null; builtUpArea?: number | null; plotArea?: number | null; areaUnit?: string | null;
  view?: string | null; furnishedStatus?: string | null; inventoryStatus: string; emirate?: string | null; city?: string | null; community?: string | null; area?: string | null;
  latitude?: number | null; longitude?: number | null; googlePlaceId?: string | null; mapDisplayMode?: string | null;
  propertyAmenities_on_property?: Array<{amenity?: {name: string} | null}>;
}
export interface ListingSource {
  id: string; title: string; listingPurpose: string; listingStatus: string; publicationStatus: string; askingPriceMinor: string | number; currency: string;
  rentalPeriod?: string | null; advertisingPermitNumber?: string | null; permitExpiryDate?: string | null; permitVerificationUrl?: string | null; archivedAt?: string | null;
  property: {
    id: string; propertyType: string; bedrooms?: number | null; bathrooms?: number | null; builtUpArea?: number | null; areaUnit?: string | null; inventoryStatus?: string | null;
    emirate?: string | null; city?: string | null; community?: string | null; area?: string | null; latitude?: number | null; longitude?: number | null;
    googlePlaceId?: string | null; mapDisplayMode?: string | null; archivedAt?: string | null;
  };
}
export interface PaymentPlanSource {
  name: string; isActive: boolean; bookingPercentageBps?: number | null; handoverPercentageBps?: number | null;
  paymentPlanInstallments_on_paymentPlan?: Array<{position: number; percentageBps: number; dueTrigger: string; constructionMilestonePercent?: number | null; postHandoverMonths?: number | null; description?: string | null}>;
}
export interface FloorPlanSource {
  id: string; name: string; propertyType: string; bedrooms?: number | null; builtUpArea?: number | null; areaUnit?: string | null;
  inventoryMedias_on_floorPlan?: Array<{id: string; contentType: string}>;
}
export interface MediaSource { id: string; contentType: string; mediaKind: string; isCover?: boolean | null }

/** Media IDs are kept in the dashed UUID form the registry validates (SQL Connect may return 32-character IDs). */
const canonicalOrNull = (id: string | null | undefined) => id ? canonicalUuid(id) : null;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const dateOnly = (value: string | null | undefined) => value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
const percent = (bps: number | null | undefined) => bps == null ? null : `${(bps / 100).toLocaleString("en-US", {maximumFractionDigits: 2})}%`;
const httpsUrl = (value: string | null | undefined) => {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString().slice(0, 2048) : null; } catch { return null; }
};

export function linkedMoney(minor: string | number | null | undefined, currency: string | null | undefined): LinkedMoney | null {
  const amount = minorToMajor(minor == null ? null : String(minor));
  if (amount == null) return null;
  const code = /^[A-Z]{3}$/.test(currency ?? "") ? currency! : "AED";
  return {amountMinor: String(minor), currency: code, display: formatMoney(amount, code)!};
}

export function emptyLinkedData(branding: ApprovedBranding, readAt: string): LinkedData {
  return {
    readAt,
    company: {
      name: branding.companyName, tagline: branding.tagline, disclaimer: branding.marketingDisclaimer,
      phone: branding.approvedContacts.phone, email: branding.approvedContacts.email, whatsapp: branding.approvedContacts.whatsapp, website: httpsUrl(branding.approvedContacts.website),
      address: branding.office?.address ?? null, hours: branding.office?.hours ?? null,
    },
    agents: [],
    project: null, developer: null, property: null, listing: null, comparison: [], unitTypes: null, paymentPlans: [], floorPlans: [], amenities: [], media: [], location: null, unavailable: [],
  };
}

function publicLocation(record: {emirate?: string | null; city?: string | null; community?: string | null; area?: string | null; latitude?: number | null; longitude?: number | null; googlePlaceId?: string | null; mapDisplayMode?: string | null}) {
  // Street addresses and unit numbers are never public, in any display mode.
  const text = describeLocation({community: record.community, area: record.area, city: record.city, emirate: record.emirate});
  const display = presentMapLocation(record, {revealExact: false}).display;
  return {text, display, mapsUrl: googleMapsUrl(display, text)};
}

function amenityNames(rows: Array<{amenity?: {name: string} | null}> | undefined) {
  return [...new Set((rows ?? []).map(row => cleanText(row.amenity?.name, 60)).filter((name): name is string => Boolean(name)))].slice(0, 40);
}

export function presentProject(record: ProjectSource): NonNullable<LinkedData["project"]> {
  return {
    id: record.id, name: cleanText(record.projectName, 180) ?? "Project", developerName: cleanText(record.developer?.name, 160),
    status: record.projectStatus, statusLabel: humanize(record.projectStatus), constructionStatus: humanize(record.constructionStatus),
    launchDate: dateOnly(record.launchDate), handoverDate: dateOnly(record.expectedHandoverDate),
    startingPrice: linkedMoney(record.startingPriceMinor, record.currency), totalUnits: record.totalUnits ?? null,
    description: cleanText(record.marketingDescription ?? record.description, 2000),
    permitNumber: cleanText(record.permitNumber, 120), permitExpiryDate: dateOnly(record.permitExpiryDate), permitVerificationUrl: httpsUrl(record.permitReferenceUrl),
    emirate: record.emirate ?? null,
  };
}

export function presentProperty(record: PropertySource): NonNullable<LinkedData["property"]> {
  return {
    id: record.id, type: humanize(record.propertyType), bedrooms: record.bedrooms ?? null, bathrooms: record.bathrooms ?? null,
    size: areaText(record.builtUpArea, record.areaUnit), plotSize: areaText(record.plotArea, record.areaUnit), view: cleanText(record.view, 80),
    furnishing: humanize(record.furnishedStatus), availability: humanize(record.inventoryStatus), emirate: record.emirate ?? null,
  };
}

export function presentListing(record: ListingSource, today: string): LinkedListing {
  const property = record.property;
  const eligible = isPublicListing({
    id: record.id, title: record.title, listingPurpose: record.listingPurpose, listingStatus: record.listingStatus, publicationStatus: record.publicationStatus,
    askingPriceMinor: record.askingPriceMinor, currency: record.currency, advertisingPermitNumber: record.advertisingPermitNumber, permitExpiryDate: record.permitExpiryDate,
    archivedAt: record.archivedAt, property: {propertyType: property.propertyType, archivedAt: property.archivedAt},
  }, today);
  const issues: string[] = [];
  if (record.publicationStatus !== "PUBLISHED") issues.push("The listing is not marked as published in Listings.");
  if (record.listingStatus !== "ACTIVE") issues.push(`The listing status is ${humanize(record.listingStatus)?.toLowerCase()}, not active.`);
  if (!record.advertisingPermitNumber?.trim()) issues.push("The listing has no advertising permit number.");
  else if (record.permitExpiryDate && record.permitExpiryDate.slice(0, 10) < today) issues.push("The listing's advertising permit has expired.");
  if (record.archivedAt || property.archivedAt) issues.push("The listing or its property is archived.");
  const price = linkedMoney(record.askingPriceMinor, record.currency) ?? {amountMinor: "0", currency: "AED", display: "Price on request"};
  return {
    id: record.id, title: cleanText(record.title, 180) ?? "Listing", purpose: record.listingPurpose === "RENT" ? "RENT" : "SALE",
    price: {...price, rentalPeriod: record.rentalPeriod === "MONTHLY" || record.rentalPeriod === "YEARLY" ? record.rentalPeriod : null},
    propertyType: humanize(property.propertyType), bedrooms: property.bedrooms ?? null, bathrooms: property.bathrooms ?? null,
    size: areaText(property.builtUpArea, property.areaUnit), locationText: describeLocation({community: property.community, area: property.area, city: property.city, emirate: property.emirate}),
    emirate: property.emirate ?? null, availability: humanize(property.inventoryStatus),
    permitNumber: cleanText(record.advertisingPermitNumber, 120), permitExpiryDate: dateOnly(record.permitExpiryDate), permitVerificationUrl: httpsUrl(record.permitVerificationUrl),
    eligible, issues,
  };
}

export function presentPaymentPlans(plans: PaymentPlanSource[]): LinkedData["paymentPlans"] {
  return plans.filter(plan => plan.isActive).slice(0, 5).map(plan => ({
    name: cleanText(plan.name, 120) ?? "Payment plan", booking: percent(plan.bookingPercentageBps), handover: percent(plan.handoverPercentageBps),
    installments: (plan.paymentPlanInstallments_on_paymentPlan ?? []).slice().sort((a, b) => a.position - b.position).slice(0, 24).map(item => ({
      share: percent(item.percentageBps),
      due: item.dueTrigger === "CONSTRUCTION_MILESTONE" ? `At ${item.constructionMilestonePercent ?? "?"}% construction`
        : item.dueTrigger === "POST_HANDOVER" ? `${item.postHandoverMonths ?? "?"} months after handover` : "On handover",
      note: cleanText(item.description, 120),
    })),
  }));
}

export function presentFloorPlans(plans: FloorPlanSource[]): LinkedData["floorPlans"] {
  return plans.slice(0, 24).map(plan => ({
    id: plan.id, name: cleanText(plan.name, 160) ?? "Floor plan", type: humanize(plan.propertyType), bedrooms: plan.bedrooms ?? null,
    size: areaText(plan.builtUpArea, plan.areaUnit), mediaId: canonicalOrNull((plan.inventoryMedias_on_floorPlan ?? []).find(media => IMAGE_TYPES.has(media.contentType))?.id),
  }));
}

/** Only active image files (no brochures or documents) can appear on a page. */
export function presentMedia(rows: MediaSource[], alt: string, url: (id: string) => string): LinkedMedia[] {
  const seen = new Set<string>();
  return rows.filter(row => IMAGE_TYPES.has(row.contentType) && (row.mediaKind === "PROPERTY_PHOTO" || row.mediaKind === "FLOOR_PLAN"))
    .filter(row => !seen.has(canonicalUuid(row.id)) && seen.add(canonicalUuid(row.id)))
    .slice(0, 60)
    .map((row, index) => ({id: canonicalUuid(row.id), kind: row.mediaKind === "FLOOR_PLAN" ? "FLOOR_PLAN" : "PHOTO", alt: `${alt} – image ${index + 1}`, url: url(row.id), isCover: Boolean(row.isCover)}));
}

export interface LinkedSources {
  project?: ProjectSource | null; property?: PropertySource | null; listing?: ListingSource | null; comparison?: ListingSource[];
  units?: {rows: UnitRecord[]; complete: boolean} | null; paymentPlans?: PaymentPlanSource[] | null; floorPlans?: FloorPlanSource[] | null;
  media?: MediaSource[]; developer?: {name: string; description?: string | null} | null; unavailable?: string[];
  agents?: AgentSource[];
  uploads?: UploadSource[];
}

/** A website library image or video (active, or archived but already on the page). */
export interface UploadSource { id: string; alt: string; width?: number | null; height?: number | null; contentType?: string }

/** Editor URL of a website library image; the route re-checks the viewer's company on every request. */
export const websiteMediaPath = (id: string) => `/api/websites/media/${encodeURIComponent(canonicalUuid(id))}/content`;

/** An active company membership with its public agent card. */
export interface AgentSource { id: string; email: string; websiteTitle?: string | null; websitePhone?: string | null; websiteWhatsapp?: string | null; userProfile?: {displayName: string} | null }

/** The chosen agent, when the member is still active and readable. */
export function contactAgent(section: SectionOf<"CONTACT">, linked: LinkedData) {
  return agentById(section.props.agentId, linked);
}

/** Agents a page shows, from contact sections and contact-card widgets on visible sections. */
export function agentsShown(data: PageData, linked: LinkedData) {
  const ids = data.sections.filter(section => section.visible).flatMap(section => section.type === "CONTACT" ? [section.props.agentId]
    : sectionWidgets(section).flatMap(item => item.widget.type === "CONTACT_CARD" ? [item.widget.props.agentId] : []));
  return [...new Set(ids.flatMap(id => { const agent = agentById(id, linked); return agent ? [agent.id] : []; }))];
}

/** The company contacts a contact section shows, in display order. */
export function contactItems(section: SectionOf<"CONTACT">, linked: LinkedData) {
  const {company} = linked;
  const {props} = section;
  const items: Array<{kind: "PHONE" | "WHATSAPP" | "EMAIL" | "ADDRESS" | "HOURS"; label: string; value: string}> = [];
  if (props.showPhone && company.phone) items.push({kind: "PHONE", label: "Call us", value: company.phone});
  if (props.showWhatsapp && company.whatsapp) items.push({kind: "WHATSAPP", label: "WhatsApp", value: company.whatsapp});
  if (props.showEmail && company.email) items.push({kind: "EMAIL", label: "Email", value: company.email});
  if (props.showAddress && company.address) items.push({kind: "ADDRESS", label: "Visit us", value: company.address});
  if (props.showHours && company.hours) items.push({kind: "HOURS", label: "Office hours", value: company.hours});
  return items;
}

/** Whether a widget has what it needs; a widget without it is left off the public page, like a section. */
export function widgetAvailability(widget: Widget, linked: LinkedData, context: RenderContext): {ok: true} | {ok: false; reason: string} {
  const missing = (reason: string) => ({ok: false as const, reason});
  switch (widget.type) {
    case "FORM": return context.hasForm ? {ok: true} : missing("Connect a CRM lead form to this page.");
    case "MAP": return widgetLocation(widget, linked)?.text ? {ok: true} : missing("Set a location for the map.");
    case "CONTACT_CARD": return agentById(widget.props.agentId, linked) || (widget.props.showCompany && (linked.company.phone || linked.company.email || linked.company.whatsapp || linked.company.address))
      ? {ok: true} : missing("Approve company contacts in the brand settings, or choose an agent.");
    case "COUNTER": return statValue(widget.props, linked) ? {ok: true} : missing("This fact is not recorded in the CRM.");
    case "IMAGE": return widget.props.image && resolveImage(widget.props.image, linked) ? {ok: true} : missing("Choose an image.");
    case "GALLERY": return resolveImages(widget.props.images, linked).length ? {ok: true} : missing("Choose images.");
    case "VIDEO": return resolveVideo(widget.props.video, linked) ? {ok: true} : missing("Choose a video.");
    case "INNER_SECTION": return widget.props.columns.some(column => column.widgets.some(item => widgetAvailability(item, linked, context).ok)) ? {ok: true} : missing("Add a widget that can be shown.");
    default: return {ok: true};
  }
}

export function widgetLocation(widget: WidgetOf<"MAP">, linked: LinkedData): LinkedData["location"] {
  return locationFor(widget.props.custom, linked);
}

/** A chosen agent who is still an active member (resolved on the server). */
export function agentById(agentId: string | null, linked: LinkedData) {
  return agentId ? (linked.agents ?? []).find(agent => agent.id === canonicalUuid(agentId)) ?? null : null;
}

function locationFor(custom: CustomLocation | null, linked: LinkedData): LinkedData["location"] {
  if (!custom) return linked.location;
  const text = custom.address || custom.label;
  const display = presentMapLocation({latitude: custom.latitude, longitude: custom.longitude, mapDisplayMode: custom.mode}, {revealExact: false}).display;
  return {text, display, mapsUrl: googleMapsUrl(display, text)};
}

/** The location a location section shows: its own pin when set, otherwise the linked record's (with that record's privacy mode). */
export function sectionLocation(section: SectionOf<"LOCATION">, linked: LinkedData): LinkedData["location"] {
  return locationFor(section.props.custom, linked);
}

/** Generalizes APPROXIMATE custom pins so a publication never holds the exact point. Idempotent. */
export function publicPageData(data: PageData): PageData {
  const generalize = (custom: CustomLocation | null) => custom && custom.mode === "APPROXIMATE" ? {...custom, ...approximateCoordinates(custom.latitude, custom.longitude)} : custom;
  return {...data, sections: data.sections.map((section): PageSection => {
    const mapped = section.type === "LOCATION" ? {...section, props: {...section.props, custom: generalize(section.props.custom)}} : section;
    // Map widgets anywhere: custom sections, added content and inner sections.
    return mapSectionWidgets(mapped, widget => widget.type === "MAP" ? {...widget, props: {...widget.props, custom: generalize(widget.props.custom)}} : widget);
  })};
}

export function presentAgent(record: AgentSource): LinkedAgent {
  return {
    id: canonicalUuid(record.id), name: cleanText(record.userProfile?.displayName, 120) ?? "Our advisor", title: cleanText(record.websiteTitle, 80),
    phone: cleanText(record.websitePhone, 32), whatsapp: cleanText(record.websiteWhatsapp, 32), email: cleanText(record.email, 254),
  };
}

/** Assembles linked data from records already read with the viewer's permissions. */
export function buildLinkedData(sources: LinkedSources, branding: ApprovedBranding, options: {readAt: string; mediaUrl: (id: string) => string; uploadUrl?: (id: string) => string}): LinkedData {
  const today = options.readAt.slice(0, 10);
  const linked = emptyLinkedData(branding, options.readAt);
  linked.unavailable.push(...(sources.unavailable ?? []));
  if (sources.project) {
    linked.project = presentProject(sources.project);
    linked.location = publicLocation(sources.project);
    linked.amenities.push(...amenityNames(sources.project.projectAmenities_on_project));
  }
  if (sources.developer) linked.developer = {name: cleanText(sources.developer.name, 160) ?? "Developer", description: cleanText(sources.developer.description, 1000)};
  else if (linked.project?.developerName) linked.developer = {name: linked.project.developerName, description: null};
  if (sources.property) {
    linked.property = presentProperty(sources.property);
    linked.location = publicLocation(sources.property);
    linked.amenities.push(...amenityNames(sources.property.propertyAmenities_on_property));
  }
  if (sources.listing) {
    linked.listing = presentListing(sources.listing, today);
    if (!sources.property) linked.location = publicLocation(sources.listing.property);
  }
  linked.comparison = (sources.comparison ?? []).slice(0, 4).map(row => presentListing(row, today));
  if (sources.units) linked.unitTypes = {complete: sources.units.complete, groups: groupUnits(sources.units.rows).map(group => ({
    type: group.type, bedrooms: group.bedrooms, availableUnits: group.availableUnits, priceFrom: group.referencePriceFrom, priceTo: group.referencePriceTo,
  }))};
  if (sources.paymentPlans) linked.paymentPlans = presentPaymentPlans(sources.paymentPlans);
  if (sources.floorPlans) linked.floorPlans = presentFloorPlans(sources.floorPlans);
  linked.amenities = [...new Set(linked.amenities)];
  const name = linked.project?.name ?? linked.listing?.title ?? linked.property?.type ?? linked.company.name;
  linked.media = presentMedia(sources.media ?? [], name, options.mediaUrl);
  linked.agents = (sources.agents ?? []).slice(0, 4).map(presentAgent);
  linked.uploads = (sources.uploads ?? []).slice(0, 60).map(row => ({
    id: canonicalUuid(row.id), url: (options.uploadUrl ?? websiteMediaPath)(row.id), alt: cleanText(row.alt, 160) ?? "", width: row.width ?? null, height: row.height ?? null,
    ...(row.contentType ? {contentType: row.contentType} : {}),
  }));
  return linked;
}

// --- Section data availability ---------------------------------------------------

export interface RenderContext { hasForm: boolean; today: string; mode: "editor" | "public" }

export function countdownDate(section: Extract<PageSection, {type: "COUNTDOWN"}>, linked: LinkedData) {
  return section.props.target === "LAUNCH_DATE" ? linked.project?.launchDate ?? null : linked.project?.handoverDate ?? null;
}

/** A displayable image: a CRM photo of the linked records or an illustrative stock photo. */
export interface ResolvedImage { id: string; url: string; srcSet: string | null; alt: string; stock: boolean; credit: {text: string; href: string} | null }

export function resolveImage(ref: ImageRef | null | undefined, linked: LinkedData, width = 1600): ResolvedImage | null {
  if (!ref) return null;
  if (isStockImageRef(ref)) {
    const item = stockImage(ref.stockId);
    return item ? {id: item.id, url: stockImageUrl(item, width), srcSet: stockImageSrcSet(item), alt: ref.alt || item.alt, stock: true, credit: stockCredit(item)} : null;
  }
  if (isUploadImageRef(ref)) {
    const upload = (linked.uploads ?? []).find(item => item.id === canonicalUuid(ref.uploadId));
    return upload ? {id: upload.id, url: upload.url, srcSet: null, alt: ref.alt || upload.alt, stock: false, credit: null} : null;
  }
  const media = linked.media.find(item => item.id === ref.mediaId);
  return media ? {id: media.id, url: media.url, srcSet: null, alt: ref.alt || media.alt, stock: false, credit: null} : null;
}

export function resolveImages(refs: ImageRef[], linked: LinkedData, width = 1600) {
  return refs.flatMap(ref => resolveImage(ref, linked, width) ?? []);
}

export function resolveVideo(ref: VideoRef | null | undefined, linked: LinkedData) {
  if (!ref) return null;
  if (isUploadVideoRef(ref)) {
    const upload = (linked.uploads ?? []).find(item => item.id === canonicalUuid(ref.uploadId));
    return upload?.contentType?.startsWith("video/") ? {id: upload.id, url: upload.url, poster: null, title: upload.alt || "Video", credit: null} : null;
  }
  const item = stockVideo(ref.stockId);
  if (!item) return null;
  const poster = stockImage(item.poster);
  return {id: item.id, url: stockVideoUrl(item), poster: poster ? stockImageUrl(poster, 1600) : null, title: item.title, credit: stockCredit(item)};
}

const crmPhoto = (media: LinkedMedia): ResolvedImage => ({id: media.id, url: media.url, srcSet: null, alt: media.alt, stock: false, credit: null});

export function galleryImages(section: Extract<PageSection, {type: "GALLERY"}>, linked: LinkedData) {
  return section.props.images.length ? resolveImages(section.props.images, linked, 1280) : linked.media.filter(media => media.kind === "PHOTO").slice(0, 12).map(crmPhoto);
}

export function comparisonListings(section: Extract<PageSection, {type: "COMPARISON"}>, linked: LinkedData) {
  const byId = new Map(linked.comparison.map(listing => [listing.id, listing]));
  return section.props.listingIds.flatMap(id => byId.get(id) ?? []);
}

const bedroomText = (value: number | null | undefined) => value == null ? null : value === 0 ? "Studio" : `${value} BR`;
const monthYear = (date: string | null | undefined) => date ? new Intl.DateTimeFormat("en-GB", {month: "short", year: "numeric", timeZone: "UTC"}).format(new Date(`${date}T00:00:00Z`)) : null;

/** The value of a stat: CRM-linked sources are read from the records (never typed), custom items show staff text. */
export function statValue(item: {source: StatSource; value: string}, linked: LinkedData): string | null {
  switch (item.source) {
    case "CUSTOM": return item.value.trim() || null;
    case "STARTING_PRICE": return linked.listing ? linked.listing.price.display : linked.project?.startingPrice ? linked.project.startingPrice.display : null;
    case "HANDOVER": return monthYear(linked.project?.handoverDate);
    case "PAYMENT_PLAN": {
      const plan = linked.paymentPlans[0];
      if (!plan) return null;
      return plan.handover ? `${(100 - Number.parseFloat(plan.handover)).toLocaleString("en-US")}/${Number.parseFloat(plan.handover)}` : plan.name;
    }
    case "BEDROOMS": {
      if (linked.listing?.bedrooms != null || linked.property?.bedrooms != null) return bedroomText(linked.listing?.bedrooms ?? linked.property?.bedrooms);
      const beds = (linked.unitTypes?.groups ?? []).map(group => group.bedrooms).filter((value): value is number => value != null);
      if (!beds.length) return null;
      const min = Math.min(...beds), max = Math.max(...beds);
      return min === max ? bedroomText(min) : `${min === 0 ? "Studio" : min}–${max} BR`;
    }
    case "UNITS": return linked.project?.totalUnits ? linked.project.totalUnits.toLocaleString("en-US") : null;
    case "SIZE": return linked.listing?.size ?? linked.property?.size ?? null;
    case "DEVELOPER": return linked.developer?.name ?? linked.project?.developerName ?? null;
    case "LOCATION": return linked.location?.text.split(",")[0]?.trim() || null;
    case "PROPERTY_TYPE": {
      if (linked.listing?.propertyType || linked.property?.type) return linked.listing?.propertyType ?? linked.property?.type ?? null;
      const types = [...new Set((linked.unitTypes?.groups ?? []).map(group => group.type).filter(Boolean))];
      return types.length ? types.slice(0, 2).join(" & ") : null;
    }
    case "CONSTRUCTION": return linked.project?.constructionStatus ?? null;
  }
}

export function resolvedStats(section: Extract<PageSection, {type: "STATS"}>, linked: LinkedData) {
  return section.props.items.flatMap((item, index) => {
    const value = statValue(item, linked);
    return value ? [{value, label: item.label, linked: item.source !== "CUSTOM", index}] : [];
  });
}

/**
 * Whether a section has the data it needs. A section without data is not
 * rendered on the public page (and is labelled in the editor), so missing
 * CRM data never becomes placeholder or invented content.
 */
export function sectionAvailability(section: PageSection, linked: LinkedData, context: RenderContext): {ok: true} | {ok: false; reason: string} {
  const missing = (reason: string) => ({ok: false as const, reason});
  switch (section.type) {
    case "HERO": case "FOOTER": case "NAVBAR": case "BANNER": return {ok: true};
    case "CUSTOM": return sectionWidgets(section).some(item => widgetAvailability(item.widget, linked, context).ok) ? {ok: true} : missing("None of the widgets has content to show yet.");
    case "STATS": return resolvedStats(section, linked).length ? {ok: true} : missing("None of these facts is recorded on the linked records. Add custom items or link a record.");
    case "FEATURE_SPLIT": return section.props.heading ? {ok: true} : missing("Add a heading.");
    case "VIDEO_SHOWCASE": return resolveVideo(section.props.video, linked) ? {ok: true} : missing("Choose a video.");
    case "PROJECT_OVERVIEW": return linked.project || linked.property || linked.listing || section.props.body ? {ok: true} : missing("Choose a project, property or listing for this page, or write the overview text.");
    case "DEVELOPER": return linked.developer ? {ok: true} : missing("No developer is linked to this page's project.");
    case "HIGHLIGHTS": return section.props.items.length ? {ok: true} : missing("Add at least one highlight.");
    case "GALLERY": return galleryImages(section, linked).length ? {ok: true} : missing("Add photos from the project or the stock library.");
    case "UNIT_TYPES": return linked.unitTypes?.groups.length ? {ok: true} : missing("No available units are recorded for this project.");
    case "PRICING": return linked.project?.startingPrice || linked.listing || linked.comparison.length ? {ok: true} : missing("No price is recorded on the linked records.");
    case "PAYMENT_PLANS": return linked.paymentPlans.length ? {ok: true} : missing("No active payment plan is recorded for this project.");
    case "FLOOR_PLANS": return linked.floorPlans.length ? {ok: true} : missing("No floor plans are recorded for this project.");
    case "AMENITIES": return linked.amenities.length ? {ok: true} : missing("No amenities are recorded on the linked records.");
    case "LOCATION": return sectionLocation(section, linked)?.text ? {ok: true} : missing("No location is recorded on the linked records. Set a location in the section settings.");
    case "LANDMARKS": return section.props.items.length ? (context.mode === "public" && !section.props.verified ? missing("Landmarks must be marked as verified.") : {ok: true}) : missing("Add the landmarks your team has verified.");
    case "COMPARISON": return comparisonListings(section, linked).length >= 2 ? {ok: true} : missing("Choose at least two listings you can access.");
    case "ENQUIRY_FORM": return context.hasForm ? {ok: true} : missing("Connect a CRM lead form to this page.");
    case "WHATSAPP_CTA": return linked.company.whatsapp ? {ok: true} : missing("Add an approved WhatsApp number in the brand settings.");
    case "CALL_CTA": return linked.company.phone ? {ok: true} : missing("Approve the company phone in the brand settings.");
    case "CONTACT": return contactItems(section, linked).length || contactAgent(section, linked) ? {ok: true}
      : missing("Approve a company phone, email or WhatsApp number or add an office address in the brand settings, or choose an agent.");
    case "TESTIMONIALS": return section.props.items.length ? (context.mode === "public" && !section.props.consentConfirmed ? missing("Confirm consent to publish the testimonials.") : {ok: true}) : missing("Add genuine client testimonials.");
    case "FAQ": return section.props.items.length ? {ok: true} : missing("Add at least one question.");
    case "COUNTDOWN": {
      const date = countdownDate(section, linked);
      if (!date) return missing(`No ${section.props.target === "LAUNCH_DATE" ? "launch" : "handover"} date is recorded for the project.`);
      return date > context.today ? {ok: true} : missing("The recorded date has passed.");
    }
  }
}

/** Every listing the page shows; each one is an advertisement that must be eligible. */
export function advertisedListings(data: PageData, linked: LinkedData) {
  const ids = new Set<string>();
  const result: LinkedListing[] = [];
  const add = (listing: LinkedListing | null | undefined) => { if (listing && !ids.has(listing.id)) { ids.add(listing.id); result.push(listing); } };
  if (linked.listing) add(linked.listing);
  for (const section of data.sections) if (section.type === "COMPARISON" && section.visible) comparisonListings(section, linked).forEach(add);
  return result;
}

/** Every image reference in a section: props (any depth) and the style background. */
export function sectionImageRefs(section: PageSection): ImageRef[] {
  const refs: ImageRef[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (typeof record.alt === "string" && (typeof record.mediaId === "string" || typeof record.stockId === "string" || typeof record.uploadId === "string")) { refs.push(record as ImageRef); return; }
    Object.values(record).forEach(walk);
  };
  walk(section.props);
  walk(section.extra);
  if (section.style.backgroundType === "IMAGE" && section.style.backgroundImage) refs.push(section.style.backgroundImage);
  return refs;
}

/** CRM media the page shows (the public image allowlist). Stock media is served by its CDN and never allowlisted. */
export function usedMediaIds(data: PageData, linked: LinkedData) {
  const ids = new Set<string>();
  for (const section of data.sections) {
    if (!section.visible) continue;
    for (const ref of sectionImageRefs(section)) if (isCrmImageRef(ref)) ids.add(ref.mediaId);
    if (section.type === "GALLERY" && !section.props.images.length) galleryImages(section, linked).forEach(media => ids.add(media.id));
    if (section.type === "FLOOR_PLANS") linked.floorPlans.forEach(plan => plan.mediaId && ids.add(plan.mediaId));
  }
  return [...ids];
}

/** CRM image references that are not approved media of the linked records. */
export function unknownImageRefs(data: PageData, linked: LinkedData) {
  const known = new Set(linked.media.map(media => media.id));
  return data.sections.flatMap(section => sectionImageRefs(section)).flatMap(ref => isCrmImageRef(ref) && !known.has(ref.mediaId) ? [ref.mediaId] : []);
}

/** Every video a section shows: the background video, a video section's video and video widgets. */
export function sectionVideoRefs(section: PageSection): VideoRef[] {
  const refs: VideoRef[] = [];
  if (section.style.backgroundType === "VIDEO" && section.style.backgroundVideo) refs.push(section.style.backgroundVideo);
  if (section.type === "VIDEO_SHOWCASE" && section.props.video) refs.push(section.props.video);
  for (const {widget} of sectionWidgets(section)) if (widget.type === "VIDEO") refs.push(widget.props.video);
  return refs;
}

/** Each website library upload on the page with the kind of slot it fills (an image or a video). */
export function uploadUses(data: PageData): Array<{id: string; kind: "image" | "video"}> {
  return data.sections.flatMap(section => [
    ...sectionImageRefs(section).flatMap(ref => isUploadImageRef(ref) ? [{id: canonicalUuid(ref.uploadId), kind: "image" as const}] : []),
    ...sectionVideoRefs(section).flatMap(ref => isUploadVideoRef(ref) ? [{id: canonicalUuid(ref.uploadId), kind: "video" as const}] : []),
  ]);
}

/** Website library images and videos referenced anywhere in the page (visible or not). */
export function uploadIdsOf(data: PageData) {
  return [...new Set(uploadUses(data).map(use => use.id))];
}

/** Website library images and videos on visible sections: the uploads a publication serves. */
export function usedUploadIds(data: PageData) {
  return uploadIdsOf({...data, sections: data.sections.filter(section => section.visible)});
}

/** Stock media on visible sections (illustrative imagery the publisher must confirm). */
export function stockMediaUsed(data: PageData) {
  const images = new Set<string>();
  const videos = new Set<string>();
  for (const section of data.sections) {
    if (!section.visible) continue;
    for (const ref of sectionImageRefs(section)) if (isStockImageRef(ref)) images.add(ref.stockId);
    for (const ref of sectionVideoRefs(section)) if (isStockVideoRef(ref)) videos.add(ref.stockId);
    if (section.type === "AMENITIES" && section.variant === "imageCards") images.add("amenity-cards");
  }
  return {images: [...images], videos: [...videos], any: images.size + videos.size > 0};
}

// --- Change detection -----------------------------------------------------------

/** Deterministic JSON (sorted keys) for fingerprints. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().filter(key => (value as Record<string, unknown>)[key] !== undefined)
      .map(key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** The CRM-derived content of linked data, without read times and preview/public media URLs. */
export function fingerprintSource(linked: LinkedData) {
  // Library uploads keep only what does not depend on where the page is shown (editor and public URLs differ).
  const uploads = linked.uploads?.length ? linked.uploads.map(item => ({id: item.id, alt: item.alt, width: item.width, height: item.height})) : linked.uploads;
  return stableStringify({...linked, readAt: undefined, unavailable: undefined, uploads, media: linked.media.map(item => ({id: item.id, kind: item.kind, alt: item.alt, isCover: item.isCover}))});
}

const sameJson = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);

/** Readable differences between the data a page was published with and the current CRM data. */
export function linkedDataChanges(published: LinkedData, current: LinkedData): string[] {
  const changes: string[] = [];
  const name = (listing: LinkedListing) => `“${listing.title}”`;
  if (!sameJson(published.company, current.company)) changes.push("Company contact details, tagline or disclaimer changed.");
  if (published.project && current.project) {
    if (!sameJson(published.project.startingPrice, current.project.startingPrice)) changes.push(`The project starting price changed (${published.project.startingPrice?.display ?? "none"} → ${current.project.startingPrice?.display ?? "none"}).`);
    if (published.project.status !== current.project.status) changes.push(`The project status changed to ${current.project.statusLabel?.toLowerCase()}.`);
    if (published.project.handoverDate !== current.project.handoverDate || published.project.launchDate !== current.project.launchDate) changes.push("Project launch or handover dates changed.");
    if (published.project.permitNumber !== current.project.permitNumber || published.project.permitExpiryDate !== current.project.permitExpiryDate) changes.push("Project permit details changed.");
    if (published.project.description !== current.project.description || published.project.developerName !== current.project.developerName) changes.push("Project description or developer changed.");
  } else if (Boolean(published.project) !== Boolean(current.project)) changes.push("The project is no longer available to you.");
  const currentListings = new Map([current.listing, ...current.comparison].filter((item): item is LinkedListing => Boolean(item)).map(item => [item.id, item]));
  for (const listing of [published.listing, ...published.comparison].filter((item): item is LinkedListing => Boolean(item))) {
    const now = currentListings.get(listing.id);
    if (!now) { changes.push(`Listing ${name(listing)} is no longer available to you.`); continue; }
    if (!sameJson(listing.price, now.price)) changes.push(`Listing ${name(listing)} price changed (${listing.price.display} → ${now.price.display}).`);
    if (listing.availability !== now.availability) changes.push(`Listing ${name(listing)} availability changed to ${now.availability?.toLowerCase() ?? "unknown"}.`);
    if (listing.permitNumber !== now.permitNumber || listing.permitExpiryDate !== now.permitExpiryDate) changes.push(`Listing ${name(listing)} permit details changed.`);
    if (listing.eligible && !now.eligible) changes.push(`Listing ${name(listing)} can no longer be advertised: ${now.issues.join(" ")}`);
  }
  if (!sameJson(published.property, current.property)) changes.push("Property details changed.");
  if (!sameJson(published.unitTypes, current.unitTypes)) changes.push("Available units or their reference prices changed.");
  if (!sameJson(published.paymentPlans, current.paymentPlans)) changes.push("Payment plans changed.");
  if (!sameJson(published.floorPlans, current.floorPlans)) changes.push("Floor plans changed.");
  if (!sameJson(published.amenities, current.amenities)) changes.push("Amenities changed.");
  if (!sameJson(published.media.map(media => media.id), current.media.map(media => media.id))) changes.push("Approved photos changed.");
  if (!sameJson(published.location, current.location)) changes.push("The location or its map display mode changed.");
  return changes;
}

export const LINKED_SECTION_TYPES: SectionType[] = ["PROJECT_OVERVIEW", "DEVELOPER", "GALLERY", "UNIT_TYPES", "PRICING", "PAYMENT_PLANS", "FLOOR_PLANS", "AMENITIES", "LOCATION", "COMPARISON", "COUNTDOWN", "FOOTER"];
export { emirateName };

/** A copy of page data without CRM image references outside `known` (used when duplicating a page for another member). */
export function withoutUnknownCrmImages(data: PageData, known: Set<string>): unknown {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk).filter(item => item !== null);
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.mediaId === "string" && typeof record.alt === "string") return known.has(record.mediaId) ? record : null;
      return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, walk(item)]));
    }
    return value;
  };
  return walk(data);
}
