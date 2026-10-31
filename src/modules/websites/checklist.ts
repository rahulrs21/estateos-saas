import {
  advertisedListings, agentsShown, sectionAvailability, stockMediaUsed, unknownImageRefs, type LinkedData,
} from "./linked";
import { SECTION_DEFINITIONS, sectionWidgets, type PageData } from "./registry";

/**
 * The publication checklist (docs/WEBSITE_PUBLISHING.md#validation-checklist).
 *
 * Automated items confirm that required information is present and recorded
 * as valid in EstateOS. They do not establish legal compliance: advertising
 * permit validity, Madmoun/QR requirements, claims and consent are confirmed
 * by the publisher through the manual attestations, which are stored with the
 * publication. EstateOS never generates permit numbers or QR codes.
 */

export type ChecklistStatus = "PASS" | "FAIL" | "WARN" | "MANUAL";
/**
 * Where an item is fixed, so the editor can offer it in place: the approved
 * brand details, the page settings, a section, the lead form, or the CRM
 * record that holds the value (which only changes in the CRM).
 */
export type ChecklistFix =
  | {kind: "BRAND"; focus: "contacts" | "disclaimer"}
  | {kind: "PAGE"}
  | {kind: "SECTION"; sectionId: string}
  | {kind: "LEAD_FORM"}
  | {kind: "RECORD"; record: "project" | "listing"; id: string};
export interface ChecklistItem { id: string; group: string; label: string; status: ChecklistStatus; detail: string; blocking: boolean; fix?: ChecklistFix }

export const ATTESTATIONS = {
  CONTENT_REVIEWED: "I have reviewed every heading, description and claim on this page, including any text written by Claude, against the CRM records.",
  ADVERTISING_PERMITS_VERIFIED: "I have verified the advertising permits shown (for Dubai: the Trakheesi permit and any Madmoun QR requirement) directly with the regulator, and the page meets the applicable advertising rules.",
  TESTIMONIALS_CONSENT: "The testimonials are genuine and we have the clients' permission to publish them.",
  LANDMARKS_VERIFIED: "The nearby places listed have been checked by our team and are described accurately.",
  AGENT_DETAILS_CONSENT: "The agents shown on this page have agreed to their name and contact details being published.",
  STOCK_MEDIA_ILLUSTRATIVE: "The stock photos and videos are used only as illustrative lifestyle imagery, do not misrepresent the advertised property, and the page states that they are illustrative.",
} as const;
export type AttestationKey = keyof typeof ATTESTATIONS;

export interface ChecklistInput {
  page: {title: string; slug: string; seoTitle: string | null; seoDescription: string | null};
  data: PageData;
  linked: LinkedData;
  form: {status: string; consentText: string; privacyPolicyUrl: string} | null;
  /** Fact-check warnings stored with the version (Claude-written or edited text). */
  contentWarnings: number;
  today: string;
}

export interface Checklist { items: ChecklistItem[]; blockers: number; attestations: AttestationKey[]; advertisement: boolean; checkedAt: string }

export function buildChecklist(input: ChecklistInput, checkedAt = new Date().toISOString()): Checklist {
  const {data, linked, today} = input;
  const items: ChecklistItem[] = [];
  const add = (group: string, id: string, label: string, status: ChecklistStatus, detail: string, fix?: ChecklistFix) =>
    items.push({id, group, label, status, detail, blocking: status === "FAIL", ...(fix && status !== "PASS" ? {fix} : {})});
  const project = linked.project ? {kind: "RECORD" as const, record: "project" as const, id: linked.project.id} : undefined;
  const visible = data.sections.filter(section => section.visible);
  const has = (type: string) => visible.some(section => section.type === type);
  const context = {hasForm: Boolean(input.form && input.form.status === "ACTIVE"), today, mode: "public" as const};

  // Content
  add("Content", "title", "Page title", input.page.title.trim() ? "PASS" : "FAIL", input.page.title.trim() ? input.page.title : "Add a page title.", {kind: "PAGE"});
  const hidden = visible.filter(section => section.type !== "FOOTER" && !sectionAvailability(section, linked, context).ok);
  const unavailable = hidden.flatMap(section => {
    const result = sectionAvailability(section, linked, context);
    return result.ok ? [] : [`${SECTION_DEFINITIONS[section.type].label}: ${result.reason}`];
  });
  const shown = visible.filter(section => section.type !== "FOOTER" && sectionAvailability(section, linked, context).ok);
  add("Content", "sections", "Visible sections", shown.length ? "PASS" : "FAIL", shown.length ? `${shown.length} section${shown.length === 1 ? "" : "s"} will be shown.` : "No section has the information it needs.");
  if (unavailable.length) add("Content", "hidden-sections", "Sections hidden on the public page", "WARN", unavailable.join(" "), {kind: "SECTION", sectionId: hidden[0].id});
  add("Content", "claims", "Claims and wording reviewed", "MANUAL",
    input.contentWarnings ? `${input.contentWarnings} automated fact-check warning${input.contentWarnings === 1 ? "" : "s"} on this version. Review them before confirming.` : "Confirm the wording is accurate.");

  // Images
  const unknown = unknownImageRefs(data, linked);
  add("Images", "images-approved", "Only approved images", unknown.length ? "FAIL" : "PASS",
    unknown.length ? `${unknown.length} image${unknown.length === 1 ? " is" : "s are"} no longer active on the linked records. Choose other photos.` : "All images are active photos of the linked records.");
  const advertisement = Boolean(linked.project || linked.property || linked.listing || linked.comparison.length);
  if (advertisement && !linked.media.some(media => media.kind === "PHOTO")) add("Images", "photos", "Property photos", "WARN", "The linked records have no approved photos. Add project photos in the CRM, or use stock images that are clearly illustrative.", project);
  const stock = stockMediaUsed(data);
  if (stock.any) add("Images", "stock-media", "Illustrative stock media", "MANUAL", `The page uses ${stock.images.length} stock photo${stock.images.length === 1 ? "" : "s"} and ${stock.videos.length} stock video${stock.videos.length === 1 ? "" : "s"}. The footer states they are illustrative. Replace them with approved project media where available.`);

  // Lead form
  if (has("ENQUIRY_FORM")) {
    if (!input.form) add("Lead form", "form", "Connected lead form", "FAIL", "Connect an active CRM lead form, or hide the enquiry form section.", {kind: "LEAD_FORM"});
    else if (input.form.status !== "ACTIVE") add("Lead form", "form", "Connected lead form", "FAIL", "The connected lead form is not active. Activate it in Settings → Website lead forms, or connect another form.", {kind: "LEAD_FORM"});
    else add("Lead form", "form", "Connected lead form", "PASS", "Enquiries go to the CRM through the connected form, with its consent notice and privacy policy.");
  } else if (!has("WHATSAPP_CTA") && !has("CALL_CTA")) {
    add("Lead form", "form", "Enquiry route", "WARN", "The page has no enquiry form or contact button.");
  }

  // Advertising (UAE)
  const listings = advertisedListings(data, linked);
  for (const listing of listings) {
    add("Advertising (UAE)", `listing-${listing.id}`, `Listing “${listing.title}”`, listing.eligible ? "PASS" : "FAIL",
      listing.eligible ? `Published, active, permit ${listing.permitNumber}${listing.permitExpiryDate ? ` valid until ${listing.permitExpiryDate}` : ""}.` : listing.issues.join(" "), {kind: "RECORD", record: "listing", id: listing.id});
    if (listing.eligible && !listing.permitVerificationUrl) {
      add("Advertising (UAE)", `listing-verify-${listing.id}`, `Permit verification link for “${listing.title}”`, "WARN",
        "No permit verification link is recorded on the listing. Where the regulator requires a QR code or verification link (for example Madmoun in Dubai), record it on the listing; EstateOS does not generate QR codes.", {kind: "RECORD", record: "listing", id: listing.id});
    }
  }
  if (linked.property && !linked.listing) {
    add("Advertising (UAE)", "property-listing", "Advertised through a listing", "FAIL",
      "A property is advertised through its listing, which holds the price and advertising permit. Choose a published listing as this page's source.");
  }
  if (linked.project) {
    const project = linked.project;
    const active = project.status === "ACTIVE" || project.status === "COMPLETED";
    const record = {kind: "RECORD" as const, record: "project" as const, id: project.id};
    add("Advertising (UAE)", "project-status", "Project status", active ? "PASS" : "FAIL", active ? `${project.statusLabel}.` : `The project is ${project.statusLabel?.toLowerCase() ?? "not active"}; only active or completed projects can be advertised.`, record);
    const expired = Boolean(project.permitExpiryDate && project.permitExpiryDate < today);
    if (project.emirate === "DUBAI") {
      add("Advertising (UAE)", "project-permit", "Project advertising permit (Dubai)", !project.permitNumber || expired ? "FAIL" : "PASS",
        !project.permitNumber ? "Record the project's advertising permit (Trakheesi) number on the project before publishing."
          : expired ? `The project permit expired on ${project.permitExpiryDate}.` : `Permit ${project.permitNumber}${project.permitExpiryDate ? ` valid until ${project.permitExpiryDate}` : " (no expiry date recorded)"}.`, record);
    } else {
      add("Advertising (UAE)", "project-permit", "Project advertising permit", project.permitNumber && !expired ? "PASS" : expired ? "FAIL" : "WARN",
        project.permitNumber && !expired ? `Permit ${project.permitNumber}.` : expired ? `The project permit expired on ${project.permitExpiryDate}.` : "No permit is recorded. Check the requirements of the emirate's regulator before publishing.", record);
    }
  }
  if (advertisement) add("Advertising (UAE)", "permits-verified", "Permits verified with the regulator", "MANUAL", "Automated checks only confirm the permit details recorded in EstateOS.");

  // Company identity
  const contact = linked.company.phone || linked.company.email || linked.company.whatsapp;
  add("Company identity", "company", "Company name", "PASS", linked.company.name);
  add("Company identity", "contact", "Approved contact details", contact ? "PASS" : "FAIL",
    contact ? "An approved phone, email or WhatsApp number is shown in the footer." : "Approve the company phone or email, or add a WhatsApp number.", {kind: "BRAND", focus: "contacts"});
  const footer = data.sections.find(section => section.type === "FOOTER");
  const disclaimer = (footer?.type === "FOOTER" ? footer.props.disclaimer.trim() : "") || linked.company.disclaimer;
  add("Company identity", "disclaimer", "Disclaimer", disclaimer ? "PASS" : advertisement ? "FAIL" : "WARN",
    disclaimer ? "A disclaimer is shown in the footer." : "Add a marketing disclaimer to the company's brand details (used on every page) or to this page's footer.", {kind: "BRAND", focus: "disclaimer"});

  // Testimonials and landmarks
  const testimonials = visible.find(section => section.type === "TESTIMONIALS");
  if (testimonials?.type === "TESTIMONIALS" && testimonials.props.items.length) {
    add("Content", "testimonials", "Testimonial consent", testimonials.props.consentConfirmed ? "MANUAL" : "FAIL",
      testimonials.props.consentConfirmed ? "Confirm the testimonials are genuine and permitted." : "Tick “Consent confirmed” in the testimonials section, or hide it.", {kind: "SECTION", sectionId: testimonials.id});
  }
  const landmarks = visible.find(section => section.type === "LANDMARKS");
  if (landmarks?.type === "LANDMARKS" && landmarks.props.items.length) {
    add("Content", "landmarks", "Nearby places verified", landmarks.props.verified ? "MANUAL" : "FAIL",
      landmarks.props.verified ? "Confirm the nearby places are accurate." : "Tick “Verified by our team” in the landmarks section, or hide it.", {kind: "SECTION", sectionId: landmarks.id});
  }

  const agents = agentsShown(data, linked);
  const customLocation = data.sections.find(section => section.visible && ((section.type === "LOCATION" && section.props.custom) || sectionWidgets(section).some(item => item.widget.type === "MAP" && item.widget.props.custom)));
  if (customLocation) add("Content", "custom-location", "Location set on the page", "MANUAL", "The location section uses a pin set on this page, not the linked record. Confirm it is correct; approximate areas are generalized when published.", {kind: "SECTION", sectionId: customLocation.id});
  if (agents.length) add("Content", "agent-consent", "Agent details", "MANUAL", "Confirm the agents shown have agreed to their name and contact details being published.");

  // SEO
  add("SEO", "seo-title", "Search title", input.page.seoTitle?.trim() ? "PASS" : "WARN", input.page.seoTitle?.trim() ? input.page.seoTitle : "The page title will be used.", {kind: "PAGE"});
  add("SEO", "seo-description", "Search description", input.page.seoDescription?.trim() ? "PASS" : "WARN", input.page.seoDescription?.trim() ? "Set." : "Add a description of up to 160 characters for search results and sharing.", {kind: "PAGE"});

  const attestations: AttestationKey[] = ["CONTENT_REVIEWED"];
  if (advertisement) attestations.push("ADVERTISING_PERMITS_VERIFIED");
  if (testimonials?.type === "TESTIMONIALS" && testimonials.props.items.length) attestations.push("TESTIMONIALS_CONSENT");
  if (landmarks?.type === "LANDMARKS" && landmarks.props.items.length) attestations.push("LANDMARKS_VERIFIED");
  if (agents.length) attestations.push("AGENT_DETAILS_CONSENT");
  if (stock.any) attestations.push("STOCK_MEDIA_ILLUSTRATIVE");
  return {items, blockers: items.filter(item => item.blocking).length, attestations, advertisement, checkedAt};
}

/** All requested attestations must be confirmed; extra or unknown keys are rejected by the request schema. */
export function missingAttestations(checklist: Checklist, confirmed: string[]) {
  const given = new Set(confirmed);
  return checklist.attestations.filter(key => !given.has(key));
}
