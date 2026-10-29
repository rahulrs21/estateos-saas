import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { root } from "./local-db-lib.mjs";

/** Pure helpers for scripts/seed-demo.mjs (unit-tested in tests/demo-seed.test.mjs). */
export const fixturesDir = join(root, "dev-data", "fixtures");
export const FIXTURE_FILES = ["developers", "projects", "properties", "listings", "contacts", "leads"];
const EXAMPLE_DOMAIN = /@[a-z0-9-]+\.example(\.(com|net|org))?$|@example\.(com|net|org)$/;
const DRAMA_PHONE = /^\+44 7700 900\d{3}$/;
const EXAMPLE_WEBSITE = /^https:\/\/[a-z0-9-]+\.example$/;

/**
 * The seed writes only to a running local emulator of a `demo-*` project.
 * Firebase never connects demo projects to real resources, so a demo project
 * on a loopback host cannot reach hosted data, whatever else is configured.
 */
export function assertDemoSeedTarget({ nodeEnv, projectId, dataConnectHost, storageHost, presetStorageHost }) {
  if (nodeEnv === "production") throw new Error("Refusing to seed demo data: NODE_ENV is production.");
  if (!/^demo-[a-z0-9-]+$/.test(projectId ?? "")) throw new Error(`Refusing to seed demo data into project "${projectId}": only local demo-* emulator projects are allowed.`);
  for (const [name, host] of [["SQL Connect", dataConnectHost], ["Storage", storageHost]]) {
    if (!/^127\.0\.0\.1:\d+$/.test(host ?? "")) throw new Error(`Refusing to seed demo data: the ${name} emulator must be on 127.0.0.1 (found ${host || "nothing"}).`);
  }
  if (presetStorageHost && presetStorageHost.replace(/^https?:\/\//, "") !== storageHost) {
    throw new Error(`Refusing to seed demo data: STORAGE_EMULATOR_HOST points at ${presetStorageHost}, not the local emulator ${storageHost}.`);
  }
  return true;
}

/** The hub must report the expected emulators running, so nothing is written unless dev:local is up. */
export function assertEmulatorsRunning(running, { dataConnectHost, storageHost }) {
  const address = info => (info ? `${info.host}:${info.port}` : null);
  if (address(running?.dataconnect) !== dataConnectHost) throw new Error(`The SQL Connect emulator is not running on ${dataConnectHost}. Start npm run dev:local first.`);
  if (address(running?.storage) !== storageHost) throw new Error(`The Storage emulator is not running on ${storageHost}. Start npm run dev:local first.`);
}

export function loadFixtures(directory = fixturesDir) {
  const read = name => JSON.parse(readFileSync(join(directory, `${name}.json`), "utf8"));
  const fixtures = Object.fromEntries(FIXTURE_FILES.map(name => [name, read(name)]));
  fixtures.manifest = read("manifest");
  return fixtures;
}

/** Referential and safety checks; returns a list of problems (empty when valid). */
export function validateFixtures(fixtures, { publicDir = join(root, "public") } = {}) {
  const problems = [];
  const unique = (items, field, label) => {
    const seen = new Set();
    for (const item of items) {
      if (seen.has(item[field])) problems.push(`${label}: duplicate ${field} ${item[field]}`);
      seen.add(item[field]);
    }
    return seen;
  };
  const { developers, projects, properties, listings, contacts, leads, manifest } = fixtures;
  const developerKeys = unique(developers, "key", "developers");
  unique(developers, "slug", "developers");
  const projectKeys = unique(projects, "key", "projects");
  unique(projects, "projectCode", "projects");
  const propertyKeys = unique(properties, "key", "properties");
  unique(properties, "propertyReference", "properties");
  unique(listings, "key", "listings");
  unique(listings, "listingReference", "listings");
  const contactKeys = unique(contacts, "key", "contacts");
  unique(contacts, "email", "contacts");
  unique(leads, "key", "leads");

  for (const developer of developers) {
    if (!/^demo-/.test(developer.slug) || !developer.name.includes("(Demo)")) problems.push(`developers: ${developer.key} is not marked as demo`);
    if (developer.website && !EXAMPLE_WEBSITE.test(developer.website)) problems.push(`developers: ${developer.key} website must use a reserved .example domain`);
    if (developer.email && !EXAMPLE_DOMAIN.test(developer.email)) problems.push(`developers: ${developer.key} email must use a reserved example domain`);
  }
  for (const project of projects) {
    if (!developerKeys.has(project.developerKey)) problems.push(`projects: ${project.key} references missing developer ${project.developerKey}`);
    if (!project.projectCode.startsWith("DEMO-")) problems.push(`projects: ${project.key} code must start with DEMO-`);
    const phaseKeys = new Set(project.phases.map(phase => phase.key));
    for (const building of project.buildings) if (building.phaseKey && !phaseKeys.has(building.phaseKey)) problems.push(`projects: ${project.key} building ${building.key} references missing phase`);
  }
  for (const property of properties) {
    const project = projects.find(item => item.key === property.projectKey);
    if (!project) problems.push(`properties: ${property.key} references missing project ${property.projectKey}`);
    else if (property.buildingKey && !project.buildings.some(building => building.key === property.buildingKey)) problems.push(`properties: ${property.key} building ${property.buildingKey} is not in ${project.key}`);
    if (!property.propertyReference.startsWith("DEMO-")) problems.push(`properties: ${property.key} reference must start with DEMO-`);
    for (const photo of property.photos ?? []) {
      const file = join(publicDir, photo.asset);
      if (!photo.asset.startsWith("demo-assets/")) problems.push(`properties: ${property.key} photo must be under demo-assets/`);
      else if (!existsSync(file)) problems.push(`properties: ${property.key} photo ${photo.asset} is missing (run node scripts/generate-demo-assets.mjs)`);
      else if (!readFileSync(file).subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) problems.push(`properties: ${property.key} photo is not a PNG`);
    }
  }
  for (const listing of listings) {
    if (!propertyKeys.has(listing.propertyKey)) problems.push(`listings: ${listing.key} references missing property ${listing.propertyKey}`);
    if (listing.publicationStatus !== "NOT_PUBLISHED") problems.push(`listings: ${listing.key} must not be published`);
    if (listing.advertisingPermitNumber) problems.push(`listings: ${listing.key} must not carry an advertising permit number`);
    if (listing.listingPurpose === "RENT" && !listing.rentalPeriod) problems.push(`listings: ${listing.key} rent needs a rental period`);
  }
  for (const contact of contacts) {
    if (!EXAMPLE_DOMAIN.test(contact.email)) problems.push(`contacts: ${contact.key} email must use a reserved example domain`);
    if (!DRAMA_PHONE.test(contact.phone)) problems.push(`contacts: ${contact.key} phone must be in the reserved +44 7700 900xxx drama range`);
  }
  const contactUse = new Set();
  for (const lead of leads) {
    if (!contactKeys.has(lead.contactKey)) problems.push(`leads: ${lead.key} references missing contact ${lead.contactKey}`);
    if (contactUse.has(lead.contactKey)) problems.push(`leads: contact ${lead.contactKey} has more than one lead`);
    contactUse.add(lead.contactKey);
    if (lead.projectKey && !projectKeys.has(lead.projectKey)) problems.push(`leads: ${lead.key} references missing project ${lead.projectKey}`);
    for (const entry of lead.shortlist) {
      const property = properties.find(item => item.key === entry.propertyKey);
      if (!property) problems.push(`leads: ${lead.key} shortlists missing property ${entry.propertyKey}`);
      else if (property.inventoryStatus !== "AVAILABLE") problems.push(`leads: ${lead.key} shortlists unavailable property ${entry.propertyKey}`);
    }
    for (const viewing of lead.viewings) {
      if (!lead.shortlist.some(entry => entry.propertyKey === viewing.propertyKey)) problems.push(`leads: ${lead.key} viewing of ${viewing.propertyKey} needs a shortlist entry`);
      if (!(viewing.inDays >= 1 && viewing.inDays <= 300)) problems.push(`leads: ${lead.key} viewing must be 1-300 days ahead`);
    }
    for (const followUp of lead.followUps) if (!(followUp.inDays >= 1 && followUp.inDays <= 300)) problems.push(`leads: ${lead.key} follow-up must be 1-300 days ahead`);
  }
  for (const [name, count] of Object.entries({ developers: developers.length, projects: projects.length, properties: properties.length, listings: listings.length, contacts: contacts.length, leads: leads.length })) {
    if (manifest.counts[name] !== count) problems.push(`manifest: ${name} count ${manifest.counts[name]} does not match ${count}`);
  }
  return problems;
}

/** Stable UUID (version 5 layout) for a fixture in a company: the same inputs always give the same ID. */
export function fixtureUuid(organizationId, fixtureKey) {
  const hash = createHash("sha1").update(`estateos-demo:${canonicalId(organizationId)}:${fixtureKey}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Dubai has no daylight saving: UTC+4 all year. Returns an ISO time `inDays` from `now` at HH:MM Dubai time. */
export function dubaiTime(now, inDays, hhmm) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const dubaiNow = new Date(now.getTime() + 4 * 3_600_000);
  const target = Date.UTC(dubaiNow.getUTCFullYear(), dubaiNow.getUTCMonth(), dubaiNow.getUTCDate() + inDays, hours, minutes) - 4 * 3_600_000;
  return new Date(target).toISOString();
}

/** Company slug for the dedicated demo company of one member: stable, globally unique per member. */
export function demoOrganizationSlug(prefix, uid) {
  return `${prefix}-${createHash("sha1").update(uid).digest("hex").slice(0, 8)}`;
}

/** SQL Connect returns UUIDs without dashes; compare and hash them in one form. */
export const canonicalId = id => String(id).replace(/-/g, "").toLowerCase();
export const minorUnits = aed => String(Math.round(aed * 100));
export const normalizedPhone = phone => phone.replace(/[^\d+]/g, "");

/** Seed order. Every fixture key is unique within a company. */
export const fixtureKeys = {
  developer: item => `developer:${item.key}`,
  project: item => `project:${item.key}`,
  phase: (project, phase) => `phase:${project.key}:${phase.key}`,
  building: (project, building) => `building:${project.key}:${building.key}`,
  property: item => `property:${item.key}`,
  photo: (property, photo) => `photo:${property.key}:${photo.key}`,
  listing: item => `listing:${item.key}`,
  contact: item => `contact:${item.key}`,
  lead: item => `lead:${item.key}`,
  note: (lead, note) => `lead-note:${lead.key}:${note.key}`,
  shortlist: (lead, entry) => `shortlist:${lead.key}:${entry.key}`,
  viewing: (lead, viewing) => `viewing:${lead.key}:${viewing.key}`,
  followUp: (lead, followUp) => `follow-up:${lead.key}:${followUp.key}`,
};
