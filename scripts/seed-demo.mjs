import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getDataConnect } from "firebase-admin/data-connect";
import * as sdk from "@dataconnect/admin-generated";
import {
  DEV_PROJECT_ID, exportedObjectCount, listStorageObjects, localConfig, localStorageBucket, root, storageExportDir,
} from "./local-db-lib.mjs";
import {
  assertDemoSeedTarget, assertEmulatorsRunning, canonicalId, demoOrganizationSlug, dubaiTime, fixtureKeys, fixtureUuid, loadFixtures,
  minorUnits, normalizedPhone, validateFixtures,
} from "./demo-seed-lib.mjs";

/*
 * Development-only demo data: npm run seed:demo -- --email you@example.com [--organization <id>] [--dry-run]
 *
 * Writes the fictional fixtures in dev-data/fixtures into the RUNNING local
 * emulator (npm run dev:local) using the normal SQL Connect operations as the
 * named member. Each fixture is claimed in DemoFixtureRecord, keyed by
 * (company, fixture key), before it is created, so repeated runs never create
 * duplicates; existing records are never updated or deleted. No Auth accounts
 * are created: the member must have signed in to the local app once.
 */
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const dryRun = args.includes("--dry-run");
const email = option("--email")?.trim().toLowerCase();
const requestedOrganization = option("--organization") ? canonicalId(option("--organization").trim()) : undefined;
const log = message => console.log(`[seed:demo] ${message}`);

if (!email) {
  console.error("Usage: npm run seed:demo -- --email <the email you sign in to EstateOS with> [--organization <company id>] [--dry-run]");
  process.exit(1);
}

const config = localConfig();
assertDemoSeedTarget({
  nodeEnv: process.env.NODE_ENV, projectId: DEV_PROJECT_ID, dataConnectHost: config.dataConnect, storageHost: config.storage,
  presetStorageHost: process.env.STORAGE_EMULATOR_HOST || process.env.FIREBASE_STORAGE_EMULATOR_HOST,
});
const running = await fetch(`http://${config.hub}/emulators`, { signal: AbortSignal.timeout(3000) })
  .then(response => response.json())
  .catch(() => { throw new Error("The local emulators are not running. Start npm run dev:local first, then run seed:demo in a second terminal."); });
assertEmulatorsRunning(running, { dataConnectHost: config.dataConnect, storageHost: config.storage });

const fixtures = loadFixtures();
const problems = validateFixtures(fixtures);
if (problems.length) throw new Error(`Fixtures are invalid:\n  ${problems.join("\n  ")}`);
const { manifest } = fixtures;
log(`WARNING: writes fictional demo records into the LOCAL emulator only (project ${DEV_PROJECT_ID}, ${config.dataConnect}). Existing records are never changed.`);

// Point every SDK at the emulators before any client is created.
process.env.DATA_CONNECT_EMULATOR_HOST = config.dataConnect;
process.env.FIREBASE_STORAGE_EMULATOR_HOST = config.storage;
process.env.STORAGE_EMULATOR_HOST = `http://${config.storage}`;
const app = initializeApp({ projectId: DEV_PROJECT_ID }, `estateos-demo-seed-${process.pid}`);
const dc = getDataConnect(sdk.connectorConfig, app);
const operations = readFileSync(join(root, "dev-data", "seed-operations.gql"), "utf8");
const admin = async (operationName, variables) => (await dc.executeGraphql(operations, { operationName, variables })).data;

const stats = { created: 0, existing: 0, recovered: 0, planned: 0, conflicts: [], failed: [], interrupted: [], skipped: [] };
let exitCode = 0;
try {
  const profiles = (await admin("DemoSeedProfile", { email })).userProfiles;
  if (profiles.length !== 1) throw new Error(`No local EstateOS profile for ${email}. Sign in to http://localhost:3000 with that account once (dev:local running), then re-run.`);
  const profile = profiles[0];
  const as = { impersonate: { authClaims: { sub: profile.uid, email: profile.email, email_verified: true, firebase: { sign_in_provider: "password" } } } };
  const memberships = (await admin("DemoSeedMemberships", { uid: profile.uid })).memberships;
  const manages = organizationId => memberships.find(row => canonicalId(row.organizationId) === canonicalId(organizationId) && ["OWNER", "ADMIN"].includes(row.role));

  // Target company: an existing company the member administers, or the member's dedicated demo company.
  let organizationId;
  if (requestedOrganization) {
    if (!manages(requestedOrganization)) throw new Error(`${email} is not an active owner or administrator of company ${requestedOrganization}.`);
    organizationId = requestedOrganization;
  } else {
    const slug = demoOrganizationSlug(manifest.demoOrganization.slugPrefix, profile.uid);
    const existing = (await admin("DemoSeedOrganizationBySlug", { slug })).organizations[0];
    if (existing) {
      if (!manages(existing.id)) throw new Error(`Demo company ${slug} exists but ${email} does not administer it.`);
      organizationId = existing.id;
    } else if (dryRun) {
      log(`Would create the company "${manifest.demoOrganization.name}" (${slug}) owned by ${email}.`);
    } else {
      organizationId = (await sdk.createOrganization(dc, { name: manifest.demoOrganization.name, slug, emirate: sdk.Emirate.DUBAI }, as)).data.organization.id;
      // Creating a company makes it the active one; keep the member where they were.
      if (profile.activeOrganizationId) await sdk.switchOrganization(dc, { organizationId: profile.activeOrganizationId }, as);
      log(`Created the company "${manifest.demoOrganization.name}" owned by ${email}. Switch to it with the company switcher.`);
    }
  }
  const sameCompany = row => canonicalId(row.organizationId) === canonicalId(organizationId);
  const membership = organizationId ? memberships.find(sameCompany) ?? (await admin("DemoSeedMemberships", { uid: profile.uid })).memberships.find(sameCompany) : null;
  const tracked = new Map(organizationId ? (await admin("DemoSeedFixtures", { organizationId })).demoFixtureRecords.map(row => [row.fixtureKey, row]) : []);
  let naturalKeys = null;
  const natural = async () => (naturalKeys ??= await admin("DemoSeedNaturalKeys", { organizationId }));
  const scope = { organizationId };

  /**
   * Creates one fixture at most once per company. Tracked fixtures are left
   * alone (even if the record was since edited or deleted); a failed create
   * releases its claim; a claim without a record (interrupted run) is finished
   * only when the record can be identified by a natural key.
   */
  async function ensure(fixtureKey, recordType, create, recover) {
    const row = tracked.get(fixtureKey);
    if (row?.recordId) { stats.existing += 1; return row.recordId; }
    if (row) {
      const id = recover ? await recover() : null;
      if (!id) { stats.interrupted.push(fixtureKey); return null; }
      await admin("DemoSeedComplete", { ...scope, fixtureKey, recordId: id });
      tracked.set(fixtureKey, { ...row, recordId: id });
      stats.recovered += 1;
      return id;
    }
    if (dryRun) { stats.planned += 1; return `planned:${fixtureKey}`; }
    try {
      await admin("DemoSeedClaim", { ...scope, fixtureKey, fixtureSet: manifest.fixtureSet, recordType });
    } catch {
      stats.skipped.push(`${fixtureKey} (claimed by a concurrent run)`);
      return null;
    }
    let id;
    try {
      id = await create();
    } catch (error) {
      await admin("DemoSeedRelease", { ...scope, fixtureKey }).catch(() => {});
      const message = error instanceof Error ? error.message : String(error);
      (/duplicate key|unique|already exists|SLUG_TAKEN/i.test(message) ? stats.conflicts : stats.failed).push(`${fixtureKey}: ${message.split("\n")[0].slice(0, 200)}`);
      return null;
    }
    await admin("DemoSeedComplete", { ...scope, fixtureKey, recordId: id });
    tracked.set(fixtureKey, { fixtureKey, recordType, recordId: id });
    stats.created += 1;
    return id;
  }
  const needs = (fixtureKey, ...ids) => {
    if (ids.every(Boolean)) return true;
    stats.skipped.push(`${fixtureKey} (a record it depends on is missing)`);
    return false;
  };
  const planned = id => typeof id === "string" && id.startsWith("planned:");

  if (organizationId || dryRun) {
    const ids = { developers: {}, projects: {}, phases: {}, buildings: {}, properties: {}, contacts: {}, leads: {}, shortlists: {} };
    const E = (enumeration, value) => (value == null ? null : enumeration[value]);

    for (const developer of fixtures.developers) {
      ids.developers[developer.key] = await ensure(fixtureKeys.developer(developer), "Developer", async () => (await sdk.createDeveloper(dc, {
        ...scope, name: developer.name, slug: developer.slug, description: developer.description, website: developer.website, email: developer.email,
        country: developer.country, headOfficeAddress: developer.headOfficeAddress, status: E(sdk.DeveloperStatus, developer.status),
      }, as)).data.developer.id, async () => (await natural()).developers.find(row => row.slug === developer.slug)?.id);
    }

    for (const project of fixtures.projects) {
      const developerId = ids.developers[project.developerKey];
      const key = fixtureKeys.project(project);
      if (!needs(key, developerId)) continue;
      const projectId = ids.projects[project.key] = await ensure(key, "Project", async () => (await sdk.createProject(dc, {
        ...scope, developerId, projectName: project.projectName, projectCode: project.projectCode, description: project.description,
        projectType: E(sdk.ProjectType, project.projectType), ownershipType: E(sdk.OwnershipType, project.ownershipType), community: project.community,
        area: project.area, emirate: E(sdk.Emirate, project.emirate), country: project.country, city: project.city, latitude: project.latitude,
        longitude: project.longitude, mapDisplayMode: E(sdk.MapDisplayMode, project.mapDisplayMode), launchDate: project.launchDate,
        expectedHandoverDate: project.expectedHandoverDate, actualHandoverDate: project.actualHandoverDate,
        constructionStatus: E(sdk.ConstructionStatus, project.constructionStatus), projectStatus: E(sdk.ProjectStatus, project.projectStatus),
        startingPriceMinor: minorUnits(project.startingPriceAed), currency: project.currency, totalUnits: project.totalUnits,
      }, as)).data.project.id, async () => (await natural()).projects.find(row => row.projectCode === project.projectCode)?.id);
      if (!projectId) continue;

      for (const phase of project.phases) {
        ids.phases[`${project.key}:${phase.key}`] = await ensure(fixtureKeys.phase(project, phase), "ProjectPhase", async () => (await sdk.createProjectPhase(dc, {
          ...scope, projectId, name: phase.name, reference: phase.reference, status: E(sdk.CompletionStatus, phase.status),
          expectedHandoverDate: phase.expectedHandoverDate ?? null, actualHandoverDate: phase.actualHandoverDate ?? null,
        }, as)).data.phase.id, async () => (await natural()).projectPhases.find(row => canonicalId(row.projectId) === canonicalId(projectId) && row.reference === phase.reference)?.id);
      }
      for (const building of project.buildings) {
        const phaseId = building.phaseKey ? ids.phases[`${project.key}:${building.phaseKey}`] : null;
        ids.buildings[`${project.key}:${building.key}`] = await ensure(fixtureKeys.building(project, building), "Building", async () => (await sdk.createBuilding(dc, {
          ...scope, projectId, phaseId: planned(phaseId) ? null : phaseId, name: building.name, reference: building.reference, floors: building.floors,
          buildingType: E(sdk.BuildingType, building.buildingType), status: E(sdk.CompletionStatus, building.status),
        }, as)).data.building.id, async () => (await natural()).buildings.find(row => canonicalId(row.projectId) === canonicalId(projectId) && row.reference === building.reference)?.id);
      }
    }

    const { getStorage } = await import("firebase-admin/storage");
    const bucketName = localStorageBucket();
    const bucket = getStorage(app).bucket(bucketName);
    let uploaded = 0;
    for (const property of fixtures.properties) {
      const projectId = ids.projects[property.projectKey];
      const buildingId = ids.buildings[`${property.projectKey}:${property.buildingKey}`] ?? null;
      const key = fixtureKeys.property(property);
      if (!needs(key, projectId)) continue;
      const propertyId = ids.properties[property.key] = await ensure(key, "Property", async () => (await sdk.createProperty(dc, {
        ...scope, propertyReference: property.propertyReference, projectId, buildingId, unitNumber: property.unitNumber,
        propertyType: E(sdk.PropertyType, property.propertyType), marketType: E(sdk.MarketType, property.marketType), bedrooms: property.bedrooms,
        bathrooms: property.bathrooms, floorNumber: property.floorNumber, builtUpArea: property.builtUpArea, plotArea: property.plotArea,
        areaUnit: E(sdk.AreaUnit, property.areaUnit), furnishedStatus: E(sdk.FurnishedStatus, property.furnishedStatus), parkingSpaces: property.parkingSpaces,
        view: property.view, emirate: E(sdk.Emirate, property.emirate), community: property.community, area: property.area, city: property.city,
        latitude: property.latitude, longitude: property.longitude, mapDisplayMode: E(sdk.MapDisplayMode, property.mapDisplayMode),
        referencePriceMinor: minorUnits(property.referencePriceAed), occupancyStatus: E(sdk.OccupancyStatus, property.occupancyStatus),
        inventoryStatus: E(sdk.InventoryStatus, property.inventoryStatus),
      }, as)).data.property.id, async () => (await natural()).properties.find(row => row.propertyReference === property.propertyReference)?.id);
      if (!propertyId) continue;

      // Photos are added only to demo properties, at a path no upload can use; other media is never touched.
      for (const [index, photo] of property.photos.entries()) {
        const photoKey = fixtureKeys.photo(property, photo);
        const storagePath = planned(propertyId) ? null : `organizations/${organizationId}/properties/${propertyId}/demo-${fixtureUuid(organizationId, photoKey)}.png`;
        const bytes = readFileSync(join(root, "public", photo.asset));
        const upload = async mediaId => {
          await bucket.file(storagePath).save(bytes, { resumable: false, metadata: { contentType: "image/png", cacheControl: "private, no-store", metadata: { estateosMediaId: mediaId } } });
          await sdk.setInventoryMediaStatus(dc, { ...scope, id: mediaId, expectedStatus: sdk.InventoryMediaStatus.PENDING, status: sdk.InventoryMediaStatus.ACTIVE }, as);
          uploaded += 1;
          return mediaId;
        };
        await ensure(photoKey, "InventoryMedia", async () => {
          const mediaId = (await sdk.createInventoryMedia(dc, {
            ...scope, propertyId, storagePath, fileName: photo.fileName, contentType: "image/png", byteSize: String(bytes.byteLength),
            mediaKind: sdk.InventoryMediaKind.PROPERTY_PHOTO, sortOrder: index,
          }, as)).data.inventoryMedia.id;
          return upload(mediaId);
        }, async () => {
          const row = (await natural()).inventoryMedias.find(item => item.storagePath === storagePath);
          if (!row) return null;
          return row.status === "PENDING" ? upload(row.id) : row.id;
        });
      }
    }

    for (const listing of fixtures.listings) {
      const propertyId = ids.properties[listing.propertyKey];
      const key = fixtureKeys.listing(listing);
      if (!needs(key, propertyId)) continue;
      await ensure(key, "PropertyListing", async () => (await sdk.createPropertyListing(dc, {
        ...scope, propertyId, listingReference: listing.listingReference, listingPurpose: E(sdk.ListingPurpose, listing.listingPurpose),
        marketType: E(sdk.MarketType, listing.marketType), title: listing.title, description: listing.description,
        askingPriceMinor: minorUnits(listing.askingPriceAed), currency: listing.currency, rentalPeriod: E(sdk.RentalPeriod, listing.rentalPeriod),
        listingStatus: E(sdk.ListingStatus, listing.listingStatus), publicationStatus: E(sdk.ListingPublicationStatus, listing.publicationStatus),
      }, as)).data.propertyListing.id, async () => (await natural()).propertyListings.find(row => row.listingReference === listing.listingReference)?.id);
    }

    for (const contact of fixtures.contacts) {
      ids.contacts[contact.key] = await ensure(fixtureKeys.contact(contact), "Contact", async () => (await sdk.createContact(dc, {
        ...scope, fullName: contact.fullName, email: contact.email, phone: contact.phone, normalizedPhone: normalizedPhone(contact.phone),
        nationality: contact.nationality, preferredLanguage: contact.preferredLanguage,
      }, as)).data.contact.id, async () => (await natural()).contacts.find(row => row.normalizedEmail === contact.email.toLowerCase())?.id);
    }

    const now = new Date();
    for (const lead of fixtures.leads) {
      const contactId = ids.contacts[lead.contactKey];
      const key = fixtureKeys.lead(lead);
      if (!needs(key, contactId)) continue;
      const projectId = lead.projectKey ? ids.projects[lead.projectKey] ?? null : null;
      const leadId = organizationId ? fixtureUuid(organizationId, key) : null;
      const created = ids.leads[lead.key] = await ensure(key, "Lead", async () => {
        const id = (await sdk.createLeadForContact(dc, {
          ...scope, leadId, contactId, projectId: planned(projectId) ? null : projectId, propertyInterest: lead.propertyInterest,
          preferredLocation: lead.preferredLocation, propertyType: lead.propertyType, transactionType: E(sdk.TransactionType, lead.transactionType),
          budgetMin: lead.budgetMin, budgetMax: lead.budgetMax, currency: lead.currency, bedroomPreference: lead.bedroomPreference,
          priority: E(sdk.LeadPriority, lead.priority),
        }, as)).data.lead.id;
        if (lead.status !== "NEW") await sdk.changeLeadStatus(dc, { ...scope, leadId: id, status: E(sdk.LeadStatus, lead.status) }, as);
        return id;
      }, async () => ((await natural()).leads.some(row => canonicalId(row.id) === canonicalId(leadId)) ? leadId : null));
      if (!created) continue;

      for (const note of lead.notes) {
        await ensure(fixtureKeys.note(lead, note), "LeadNote", async () => (await sdk.addLeadNote(dc, { ...scope, leadId: created, note: note.note }, as)).data.activity.id);
      }
      for (const entry of lead.shortlist) {
        const propertyId = ids.properties[entry.propertyKey];
        const shortlistKey = fixtureKeys.shortlist(lead, entry);
        if (!needs(shortlistKey, propertyId)) continue;
        ids.shortlists[`${lead.key}:${entry.key}`] = await ensure(shortlistKey, "LeadPropertyInterest", async () => (await sdk.saveLeadPropertyInterest(dc, {
          ...scope, leadId: created, propertyId, status: E(sdk.LeadPropertyInterestStatus, entry.status), notes: entry.notes,
        }, as)).data.interest.id, async () => (await natural()).leadPropertyInterests.find(row => canonicalId(row.leadId) === canonicalId(created) && canonicalId(row.propertyId) === canonicalId(propertyId))?.id);
      }
      for (const viewing of lead.viewings) {
        const propertyId = ids.properties[viewing.propertyKey];
        const viewingKey = fixtureKeys.viewing(lead, viewing);
        const shortlistId = ids.shortlists[`${lead.key}:${viewing.propertyKey}`];
        if (!needs(viewingKey, propertyId, shortlistId)) continue;
        await ensure(viewingKey, "LeadPropertyViewing", async () => (await sdk.scheduleLeadPropertyViewing(dc, {
          ...scope, leadId: created, propertyId, scheduledAt: dubaiTime(now, viewing.inDays, viewing.timeDubai), notes: viewing.notes,
          assignedMembershipId: membership.id, customerConfirmation: E(sdk.LeadPropertyViewingConfirmation, viewing.customerConfirmation),
        }, as)).data.viewing.id);
      }
      for (const followUp of lead.followUps) {
        await ensure(fixtureKeys.followUp(lead, followUp), "LeadFollowUp", async () => (await sdk.scheduleLeadFollowUp(dc, {
          ...scope, leadId: created, followUpAt: dubaiTime(now, followUp.inDays, followUp.timeDubai), title: followUp.title, followUpNote: followUp.note,
          replaceExisting: false,
        }, as)).data.followUp.id);
      }
    }

    // dev:local saves uploaded files within seconds; confirm before reporting success.
    if (uploaded) {
      const expected = (await listStorageObjects(config.storage, bucketName)).length;
      const deadline = Date.now() + 30_000;
      while (exportedObjectCount() < expected && Date.now() < deadline) await new Promise(resolveWait => setTimeout(resolveWait, 500));
      const saved = exportedObjectCount();
      if (saved >= expected) log(`Uploaded ${uploaded} demo photos; all ${saved} stored files are saved to ${storageExportDir}.`);
      else log(`Uploaded ${uploaded} demo photos, but dev:local has saved only ${saved}/${expected} files so far. Check the dev:local terminal for autosave messages.`);
    }
  }

  log(`${dryRun ? "Dry run" : "Done"}${organizationId ? ` for company ${organizationId}` : ""}: ${stats.created} created, ${stats.existing} already present, ${stats.recovered} recovered${dryRun ? `, ${stats.planned} would be created` : ""}.`);
  for (const [label, items] of [["Conflicts with existing records (left unchanged)", stats.conflicts], ["Failed", stats.failed], ["Interrupted earlier and not identifiable (not recreated)", stats.interrupted], ["Skipped", stats.skipped]]) {
    if (!items.length) continue;
    log(`${label}: ${items.length}`);
    for (const item of items.slice(0, 20)) log(`  ${item}`);
    if (items.length > 20) log(`  ...and ${items.length - 20} more`);
  }
  if (stats.failed.length) exitCode = 1;
} catch (error) {
  console.error(`[seed:demo] ${error instanceof Error ? error.message : error}`);
  exitCode = 1;
} finally {
  await deleteApp(app);
}
process.exit(exitCode);
