import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { fixture as f } from "./fixtures/sql-connect-fixtures.mjs";

const key = value => value.replaceAll("-", "").toLowerCase();
const ids = rows => new Set(rows.map(row => key(row.id)));

export function registerMapCases({ sdk, run, forbidden }) {
  describe("Phase 5F map locations", { concurrency: false }, () => {
    const suffix = randomUUID();
    // A unique community isolates this suite's rows from other inventory cases.
    const community = `Map Probe ${suffix}`;
    const marina = {latitude: 25.080512, longitude: 55.140231};
    let developerId, projectId, exactVilla, approximateApartment, hiddenVilla, agentVilla, saleListing, agentListing, hiddenListing;
    const property = (reference, extra = {}) => ({
      organizationId: f.orgA, propertyReference: `${reference}-${suffix}`, propertyType: sdk.PropertyType.VILLA,
      marketType: sdk.MarketType.SECONDARY, areaUnit: sdk.AreaUnit.SQFT, occupancyStatus: sdk.OccupancyStatus.VACANT,
      inventoryStatus: sdk.InventoryStatus.AVAILABLE, emirate: sdk.Emirate.DUBAI, community, ...extra,
    });
    const pinFilters = (extra = {}) => ({organizationId: f.orgA, community, limit: 100, ...extra});

    it("persists project location fields, place ID and display mode", async () => {
      developerId = (await run(sdk.createDeveloper, "owner-a", {
        organizationId: f.orgA, name: "Map Developer", slug: `map-dev-${suffix}`, country: "AE", status: sdk.DeveloperStatus.ACTIVE,
      })).developer.id;
      projectId = (await run(sdk.createProject, "owner-a", {
        organizationId: f.orgA, developerId, projectName: "Map Project", projectCode: `MAP-${suffix}`, projectType: sdk.ProjectType.RESIDENTIAL,
        country: "AE", constructionStatus: sdk.ConstructionStatus.LAUNCHED, projectStatus: sdk.ProjectStatus.ACTIVE, currency: "AED",
        emirate: sdk.Emirate.DUBAI, city: "Dubai", community, area: "Marina Gate", address: "Marina Gate, Dubai Marina",
        ...marina, googlePlaceId: "ChIJ_map_probe_project", mapDisplayMode: sdk.MapDisplayMode.APPROXIMATE,
      })).project.id;
      const {project} = await run(sdk.getProject, "owner-a", {organizationId: f.orgA, id: projectId});
      assert.equal(project.latitude, marina.latitude);
      assert.equal(project.longitude, marina.longitude);
      assert.equal(project.city, "Dubai");
      assert.equal(project.googlePlaceId, "ChIJ_map_probe_project");
      assert.equal(project.mapDisplayMode, sdk.MapDisplayMode.APPROXIMATE);
    });

    it("persists developer head-office coordinates and place ID without touching projects", async () => {
      const head = {headOfficeAddress: "Emaar Square, Downtown Dubai", headOfficeLatitude: 25.195, headOfficeLongitude: 55.279, headOfficeGooglePlaceId: "ChIJ_head_office_probe"};
      const base = {organizationId: f.orgA, name: "Head Office Developer", slug: `head-office-${suffix}`, country: "AE", status: sdk.DeveloperStatus.ACTIVE};
      const created = (await run(sdk.createDeveloper, "owner-a", {...base, ...head})).developer.id;
      const {developer} = await run(sdk.getDeveloper, "agent-a", {organizationId: f.orgA, id: created});
      assert.equal(developer.headOfficeLatitude, head.headOfficeLatitude);
      assert.equal(developer.headOfficeLongitude, head.headOfficeLongitude);
      assert.equal(developer.headOfficeGooglePlaceId, head.headOfficeGooglePlaceId);
      await run(sdk.updateDeveloper, "admin-a", {...base, id: created, headOfficeAddress: head.headOfficeAddress, headOfficeLatitude: 25.2, headOfficeLongitude: 55.28, headOfficeGooglePlaceId: null});
      const updated = (await run(sdk.getDeveloper, "owner-a", {organizationId: f.orgA, id: created})).developer;
      assert.equal(updated.headOfficeLatitude, 25.2);
      assert.equal(updated.headOfficeGooglePlaceId, null, "a moved pin clears the place ID (the service always sends null)");
      // Pairing and UAE checks run in the database; non-UAE developers may have foreign head offices.
      await forbidden(sdk.updateDeveloper, "owner-a", {...base, id: created, headOfficeLatitude: 25.2});
      await forbidden(sdk.updateDeveloper, "owner-a", {...base, id: created, headOfficeLatitude: 51.5072, headOfficeLongitude: -0.1276});
      await run(sdk.updateDeveloper, "owner-a", {...base, id: created, country: "GB", headOfficeLatitude: 51.5072, headOfficeLongitude: -0.1276});
      await forbidden(sdk.updateDeveloper, "agent-a", {...base, id: created, ...head});
      await forbidden(sdk.getDeveloper, "owner-b", {organizationId: f.orgA, id: created});
    });

    it("defaults project display to EXACT and allows non-UAE coordinates only for non-UAE projects", async () => {
      const base = {
        organizationId: f.orgA, developerId, projectType: sdk.ProjectType.RESIDENTIAL, constructionStatus: sdk.ConstructionStatus.PLANNING,
        projectStatus: sdk.ProjectStatus.DRAFT, currency: "AED",
      };
      const legacy = (await run(sdk.createProject, "owner-a", {...base, projectName: "Legacy caller", projectCode: `MAP-L-${suffix}`, country: "AE"})).project.id;
      assert.equal((await run(sdk.getProject, "owner-a", {organizationId: f.orgA, id: legacy})).project.mapDisplayMode, sdk.MapDisplayMode.EXACT);
      await forbidden(sdk.createProject, "owner-a", {...base, projectName: "AE abroad", projectCode: `MAP-X-${suffix}`, country: "AE", latitude: 51.5072, longitude: -0.1276});
      await forbidden(sdk.createProject, "owner-a", {...base, projectName: "Half point", projectCode: `MAP-H-${suffix}`, country: "AE", latitude: 25.1});
      await run(sdk.createProject, "owner-a", {...base, projectName: "London", projectCode: `MAP-GB-${suffix}`, country: "GB", latitude: 51.5072, longitude: -0.1276});
    });

    it("persists property coordinates and defaults unit display to APPROXIMATE", async () => {
      exactVilla = (await run(sdk.createProperty, "owner-a", property("MAP-EXACT", {
        projectId, ...marina, city: "Dubai", googlePlaceId: "ChIJ_map_probe_villa", mapDisplayMode: sdk.MapDisplayMode.EXACT, referencePriceMinor: "500000000",
      }))).property.id;
      approximateApartment = (await run(sdk.createProperty, "owner-a", property("MAP-APPROX", {
        propertyType: sdk.PropertyType.APARTMENT, latitude: 25.0712345, longitude: 55.1323456, referencePriceMinor: "150000000",
      }))).property.id;
      hiddenVilla = (await run(sdk.createProperty, "owner-a", property("MAP-HIDDEN", {latitude: 25.09, longitude: 55.15, mapDisplayMode: sdk.MapDisplayMode.HIDDEN, referencePriceMinor: "450000000"}))).property.id;
      await run(sdk.createProperty, "owner-a", property("MAP-NONE", {referencePriceMinor: "400000000"}));
      agentVilla = (await run(sdk.createProperty, "owner-a", property("MAP-AGENT", {
        latitude: 25.085, longitude: 55.145, mapDisplayMode: sdk.MapDisplayMode.EXACT, assignedMembershipId: f.memberAgentA, referencePriceMinor: "300000000",
      }))).property.id;

      const exact = (await run(sdk.getProperty, "owner-a", {organizationId: f.orgA, id: exactVilla})).property;
      assert.equal(exact.latitude, marina.latitude);
      assert.equal(exact.longitude, marina.longitude);
      assert.equal(exact.googlePlaceId, "ChIJ_map_probe_villa");
      assert.equal(exact.mapDisplayMode, sdk.MapDisplayMode.EXACT);
      const approximate = (await run(sdk.getProperty, "owner-a", {organizationId: f.orgA, id: approximateApartment})).property;
      assert.equal(approximate.mapDisplayMode, sdk.MapDisplayMode.APPROXIMATE);
      assert.equal(approximate.latitude, 25.071235, "numeric(9,6) keeps six decimal places");
    });

    it("rejects unpaired or out-of-UAE property coordinates at the database layer", async () => {
      await forbidden(sdk.createProperty, "owner-a", property("MAP-HALF", {latitude: 25.1}));
      await forbidden(sdk.createProperty, "owner-a", property("MAP-SWAP", {latitude: marina.longitude, longitude: marina.latitude}));
      const current = (await run(sdk.getProperty, "owner-a", {organizationId: f.orgA, id: exactVilla})).property;
      const update = {
        organizationId: f.orgA, id: exactVilla, expectedInventoryStatus: current.inventoryStatus, propertyReference: current.propertyReference,
        projectId, propertyType: current.propertyType, marketType: current.marketType, areaUnit: current.areaUnit,
        occupancyStatus: current.occupancyStatus, inventoryStatus: current.inventoryStatus, emirate: current.emirate, community,
      };
      await forbidden(sdk.updateProperty, "owner-a", {...update, latitude: 51.5072, longitude: -0.1276});
      await run(sdk.updateProperty, "owner-a", {...update, latitude: 25.081, longitude: 55.141, mapDisplayMode: sdk.MapDisplayMode.EXACT, referencePriceMinor: "500000000"});
      const updated = (await run(sdk.getProperty, "owner-a", {organizationId: f.orgA, id: exactVilla})).property;
      assert.equal(updated.latitude, 25.081);
      assert.equal(updated.longitude, 55.141);
    });

    it("lists only mappable, non-hidden pins and applies emirate, community, type, status and price filters", async () => {
      const all = await run(sdk.listPropertyMapPins, "owner-a", pinFilters());
      assert.deepEqual(ids(all.properties), new Set([exactVilla, approximateApartment, agentVilla].map(key)));
      assert.equal(all.mapped[0]._count, 3);
      assert.equal(all.total[0]._count, 5, "hidden and unmapped records still count as matches");

      const villas = await run(sdk.listPropertyMapPins, "owner-a", pinFilters({propertyType: sdk.PropertyType.VILLA, emirate: sdk.Emirate.DUBAI}));
      assert.deepEqual(ids(villas.properties), new Set([exactVilla, agentVilla].map(key)));
      const priced = await run(sdk.listPropertyMapPins, "owner-a", pinFilters({minimumPriceMinor: "200000000", maximumPriceMinor: "400000000"}));
      assert.deepEqual(ids(priced.properties), new Set([key(agentVilla)]));
      const sharjah = await run(sdk.listPropertyMapPins, "owner-a", pinFilters({emirate: sdk.Emirate.SHARJAH}));
      assert.equal(sharjah.properties.length, 0);
      const reserved = await run(sdk.listPropertyMapPins, "owner-a", pinFilters({inventoryStatus: sdk.InventoryStatus.RESERVED}));
      assert.equal(reserved.properties.length, 0);
      assert.ok(all.properties.every(row => row.mapDisplayMode !== sdk.MapDisplayMode.HIDDEN));
      await forbidden(sdk.listPropertyMapPins, "owner-a", pinFilters({limit: 1001}));
    });

    it("limits agents to their assigned pins and isolates other tenants", async () => {
      await forbidden(sdk.listPropertyMapPins, "agent-a", pinFilters());
      const agent = await run(sdk.listPropertyMapPins, "agent-a", pinFilters({assignedMembershipId: f.memberAgentA}));
      assert.deepEqual(ids(agent.properties), new Set([key(agentVilla)]));
      await forbidden(sdk.listPropertyMapPins, "owner-b", pinFilters());
      const otherTenant = await run(sdk.listPropertyMapPins, "owner-b", {organizationId: f.orgB, community, limit: 100});
      assert.equal(otherTenant.properties.length, 0);
      assert.equal(otherTenant.total[0]._count, 0);
    });

    it("maps listings through their property location with listing filters and role scope", async () => {
      const listing = (propertyId, reference, extra) => ({
        organizationId: f.orgA, propertyId, listingReference: `${reference}-${suffix}`, marketType: sdk.MarketType.SECONDARY,
        currency: "AED", listingStatus: sdk.ListingStatus.DRAFT, publicationStatus: sdk.ListingPublicationStatus.NOT_PUBLISHED, ...extra,
      });
      saleListing = (await run(sdk.createPropertyListing, "owner-a", listing(exactVilla, "MAP-SALE", {
        listingPurpose: sdk.ListingPurpose.SALE, title: "Marina villa for sale", askingPriceMinor: "520000000",
      }))).propertyListing.id;
      agentListing = (await run(sdk.createPropertyListing, "owner-a", listing(agentVilla, "MAP-RENT", {
        listingPurpose: sdk.ListingPurpose.RENT, rentalPeriod: sdk.RentalPeriod.YEARLY, title: "Agent rental", askingPriceMinor: "25000000", assignedMembershipId: f.memberAgentA,
      }))).propertyListing.id;
      hiddenListing = (await run(sdk.createPropertyListing, "owner-a", listing(hiddenVilla, "MAP-HIDDEN-L", {listingPurpose: sdk.ListingPurpose.SALE, title: "Hidden villa", askingPriceMinor: "460000000"}))).propertyListing.id;

      const all = await run(sdk.listPropertyListingMapPins, "owner-a", pinFilters());
      assert.deepEqual(ids(all.propertyListings), new Set([saleListing, agentListing].map(key)));
      assert.equal(all.total[0]._count, 3);
      const sales = await run(sdk.listPropertyListingMapPins, "owner-a", pinFilters({purpose: sdk.ListingPurpose.SALE, minimumPriceMinor: "500000000"}));
      assert.deepEqual(ids(sales.propertyListings), new Set([key(saleListing)]));
      const apartments = await run(sdk.listPropertyListingMapPins, "owner-a", pinFilters({propertyType: sdk.PropertyType.APARTMENT}));
      assert.equal(apartments.propertyListings.length, 0);

      const table = await run(sdk.listPropertyListings, "owner-a", {organizationId: f.orgA, community, emirate: sdk.Emirate.DUBAI, propertyType: sdk.PropertyType.VILLA, maximumPriceMinor: "470000000", limit: 25, offset: 0});
      assert.deepEqual(ids(table.propertyListings), new Set([agentListing, hiddenListing].map(key)), "the table view keeps hidden-location listings and applies the same filters");
      assert.equal(table.total[0]._count, 2);

      await forbidden(sdk.listPropertyListingMapPins, "agent-a", pinFilters());
      const agent = await run(sdk.listAssignedPropertyListingMapPins, "agent-a", pinFilters({assignedMembershipId: f.memberAgentA}));
      assert.deepEqual(ids(agent.propertyListings), new Set([key(agentListing)]));
      await forbidden(sdk.listAssignedPropertyListingMapPins, "agent-a", pinFilters({assignedMembershipId: f.memberOwnerA}));
      await forbidden(sdk.listPropertyListingMapPins, "owner-b", pinFilters());
    });
  });
}
