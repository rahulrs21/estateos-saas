import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { fixture as f } from "./fixtures/sql-connect-fixtures.mjs";

const key = value => value.replaceAll("-", "").toLowerCase();

export function registerInventoryCases({ sdk, run, forbidden }) {
  describe("Phase 5A tenant-scoped property inventory", { concurrency: false }, () => {
    const suffix = randomUUID();
    let developerA, developerB, projectA, projectB, phaseA, buildingA, floorPlanA;
    let projectProperty, standaloneProperty, assignedProperty, foreignProperty, listingA, listingForAgentTwo;
    let amenityA, amenityB, featureA, paymentPlanA;

    it("lets an OWNER read empty developer, project and property lists", async () => {
      const [developers, projects, properties] = await Promise.all([
        run(sdk.listDevelopers, "owner-b", {organizationId: f.orgB, limit: 25, offset: 0}),
        run(sdk.listProjects, "owner-b", {organizationId: f.orgB, limit: 25, offset: 0}),
        run(sdk.listPropertiesAdvanced, "owner-b", {
          organizationId: f.orgB, limit: 25, offset: 0,
        }),
      ]);
      assert.deepEqual(developers.developers, []);
      assert.equal(developers.total[0]._count, 0);
      assert.deepEqual(projects.projects, []);
      assert.equal(projects.total[0]._count, 0);
      assert.deepEqual(properties.properties, []);
      assert.equal(properties.total[0]._count, 0);
    });

    it("lists persisted developer, project and property rows with no optional filters", async () => {
      const suffix = randomUUID();
      const developerId = (await run(sdk.createDeveloper, "owner-b", {
        organizationId: f.orgB, name: "List Probe Developer", slug: `list-probe-${suffix}`, country: "AE", status: sdk.DeveloperStatus.ACTIVE,
      })).developer.id;
      const projectId = (await run(sdk.createProject, "owner-b", {
        organizationId: f.orgB, developerId, projectName: "List Probe Project", projectCode: `LIST-${suffix}`,
        projectType: sdk.ProjectType.RESIDENTIAL, country: "AE", constructionStatus: sdk.ConstructionStatus.PLANNING,
        projectStatus: sdk.ProjectStatus.ACTIVE, currency: "AED",
      })).project.id;
      const propertyId = (await run(sdk.createProperty, "owner-b", {
        organizationId: f.orgB, propertyReference: `LIST-${suffix}`, projectId,
        propertyType: sdk.PropertyType.APARTMENT, marketType: sdk.MarketType.OFF_PLAN,
        areaUnit: sdk.AreaUnit.SQFT, occupancyStatus: sdk.OccupancyStatus.VACANT,
        inventoryStatus: sdk.InventoryStatus.AVAILABLE,
      })).property.id;

      const [developers, projects, properties] = await Promise.all([
        run(sdk.listDevelopers, "owner-b", {organizationId: f.orgB, limit: 25, offset: 0}),
        run(sdk.listProjects, "owner-b", {organizationId: f.orgB, limit: 25, offset: 0}),
        run(sdk.listPropertiesAdvanced, "owner-b", {organizationId: f.orgB, limit: 25, offset: 0}),
      ]);
      assert.ok(developers.developers.some(row => key(row.id) === key(developerId)));
      assert.ok(projects.projects.some(row => key(row.id) === key(projectId)));
      assert.ok(properties.properties.some(row => key(row.id) === key(propertyId)));
    });

    it("creates developer, project, phase and building relationships for an owner", async () => {
      developerA = (await run(sdk.createDeveloper, "owner-a", {
        organizationId: f.orgA, name: "Local Developer A", slug: `local-dev-a-${suffix}`, country: "AE", status: sdk.DeveloperStatus.ACTIVE,
      })).developer.id;
      const developer = await run(sdk.getDeveloper, "owner-a", { organizationId: f.orgA, id: developerA });
      assert.equal(developer.developer.slug, `local-dev-a-${suffix}`);

      projectA = (await run(sdk.createProject, "owner-a", {
        organizationId: f.orgA, developerId: developerA, projectName: "Local Inventory Project", projectCode: `INV-${suffix}`,
        projectType: sdk.ProjectType.RESIDENTIAL, country: "AE", constructionStatus: sdk.ConstructionStatus.PLANNING,
        projectStatus: sdk.ProjectStatus.ACTIVE, currency: "AED", startingPriceMinor: "125000000", brochureReference: "https://example.test/project-brochure.pdf",
      })).project.id;
      assert.equal((await run(sdk.getProject, "owner-a", {organizationId: f.orgA, id: projectA})).project.brochureReference, "https://example.test/project-brochure.pdf");
      const developerPage = await run(sdk.listDevelopers, "owner-a", {organizationId: f.orgA, limit: 100, offset: 0});
      const linkedDeveloper = developerPage.developers.find(row => key(row.id) === key(developerA));
      assert.equal(linkedDeveloper.projects_on_developer[0]?._count ?? 0, 1);
      await forbidden(sdk.archiveDeveloper, "owner-a", {organizationId: f.orgA, id: developerA});
      await forbidden(sdk.createDeveloper, "agent-a", {
        organizationId: f.orgA, name: "Agent must not create", slug: `agent-dev-${suffix}`, country: "AE", status: sdk.DeveloperStatus.ACTIVE,
      });
      await forbidden(sdk.createProject, "agent-a", {
        organizationId: f.orgA, developerId: developerA, projectName: "Agent must not create", projectCode: `AGENT-${suffix}`,
        projectType: sdk.ProjectType.RESIDENTIAL, country: "AE", constructionStatus: sdk.ConstructionStatus.PLANNING,
        projectStatus: sdk.ProjectStatus.DRAFT, currency: "AED",
      });
      phaseA = (await run(sdk.createProjectPhase, "owner-a", {
        organizationId: f.orgA, projectId: projectA, name: "Phase One", status: sdk.CompletionStatus.PLANNED,
      })).phase.id;
      buildingA = (await run(sdk.createBuilding, "owner-a", {
        organizationId: f.orgA, projectId: projectA, phaseId: phaseA, name: "Tower One",
        buildingType: sdk.BuildingType.RESIDENTIAL, status: sdk.CompletionStatus.PLANNED, floors: 20,
      })).building.id;

      const phase = await run(sdk.getProjectPhase, "owner-a", { organizationId: f.orgA, projectId: projectA, id: phaseA });
      const building = await run(sdk.getBuilding, "owner-a", { organizationId: f.orgA, id: buildingA });
      assert.equal(key(phase.projectPhase.projectId), key(projectA));
      assert.equal(key(building.building.phaseId), key(phaseA));
      assert.equal(building.building.floors, 20);
      await forbidden(sdk.createProjectPhase, "agent-a", {organizationId: f.orgA, projectId: projectA, name: "Agent phase", status: sdk.CompletionStatus.PLANNED});
      await forbidden(sdk.createBuilding, "agent-a", {organizationId: f.orgA, projectId: projectA, name: "Agent building", buildingType: sdk.BuildingType.RESIDENTIAL, status: sdk.CompletionStatus.PLANNED});
      assert.equal((await run(sdk.getProject, "agent-a", {organizationId: f.orgA, id: projectA})).project.projectCode, `INV-${suffix}`);
    });

    it("keeps developer and project lists isolated and rejects cross-company references", async () => {
      developerB = (await run(sdk.createDeveloper, "owner-b", {
        organizationId: f.orgB, name: "Local Developer B", slug: `local-dev-b-${suffix}`, country: "AE", status: sdk.DeveloperStatus.ACTIVE,
      })).developer.id;
      projectB = (await run(sdk.createProject, "owner-b", {
        organizationId: f.orgB, developerId: developerB, projectName: "Company B Project", projectCode: `B-${suffix}`,
        projectType: sdk.ProjectType.RESIDENTIAL, country: "AE", constructionStatus: sdk.ConstructionStatus.PLANNING,
        projectStatus: sdk.ProjectStatus.DRAFT, currency: "AED",
      })).project.id;
      foreignProperty = (await run(sdk.createProperty, "owner-b", {
        organizationId: f.orgB, propertyReference: `FOREIGN-${suffix}`, projectId: projectB,
        propertyType: sdk.PropertyType.APARTMENT, marketType: sdk.MarketType.OFF_PLAN, areaUnit: sdk.AreaUnit.SQFT,
        occupancyStatus: sdk.OccupancyStatus.VACANT, inventoryStatus: sdk.InventoryStatus.DRAFT,
      })).property.id;

      const [listA, listB] = await Promise.all([
        run(sdk.listDevelopers, "owner-a", { organizationId: f.orgA, limit: 100, offset: 0 }),
        run(sdk.listDevelopers, "owner-b", { organizationId: f.orgB, limit: 100, offset: 0 }),
      ]);
      assert.ok(listA.developers.some(row => key(row.id) === key(developerA)));
      assert.ok(listA.developers.every(row => key(row.organizationId) === key(f.orgA)));
      assert.ok(listB.developers.some(row => key(row.id) === key(developerB)));
      assert.ok(listB.developers.every(row => key(row.organizationId) === key(f.orgB)));
      assert.equal((await run(sdk.getDeveloper, "owner-a", { organizationId: f.orgA, id: developerB })).developer, null);
      assert.equal((await run(sdk.getProject, "owner-a", { organizationId: f.orgA, id: projectB })).project, null);
      assert.equal((await run(sdk.listProjectAuditEvents, "owner-a", {organizationId: f.orgA, projectId: projectB, limit: 50, offset: 0})).total[0]._count, 0);
      assert.equal((await run(sdk.listProjectAuditEvents, "agent-a", {organizationId: f.orgA, projectId: projectA, limit: 50, offset: 0})).auditLogs[0].targetType, "PROJECT");
      await forbidden(sdk.createProject, "owner-a", {
        organizationId: f.orgA, developerId: developerB, projectName: "Cross tenant project", projectCode: `CROSS-${suffix}`,
        projectType: sdk.ProjectType.RESIDENTIAL, country: "AE", constructionStatus: sdk.ConstructionStatus.PLANNING,
        projectStatus: sdk.ProjectStatus.DRAFT, currency: "AED",
      });
      await forbidden(sdk.createProject, "owner-a", {
        organizationId: f.orgA, developerId: developerA, projectName: "Negative price", projectCode: `NEG-${suffix}`,
        projectType: sdk.ProjectType.RESIDENTIAL, country: "AE", constructionStatus: sdk.ConstructionStatus.PLANNING,
        projectStatus: sdk.ProjectStatus.DRAFT, currency: "AED", startingPriceMinor: "-1",
      });
    });

    it("creates standalone and project inventory, while listing permissions stay tenant and agent scoped", async () => {
      projectProperty = (await run(sdk.createProperty, "owner-a", {
        organizationId: f.orgA, propertyReference: `P-${suffix}`, projectId: projectA, buildingId: buildingA,
        unitNumber: "1204", propertyType: sdk.PropertyType.APARTMENT, marketType: sdk.MarketType.OFF_PLAN, bedrooms: 2, bathrooms: 2,
        builtUpArea: 1250.5, areaUnit: sdk.AreaUnit.SQFT, occupancyStatus: sdk.OccupancyStatus.VACANT,
        inventoryStatus: sdk.InventoryStatus.AVAILABLE,
      })).property.id;
      standaloneProperty = (await run(sdk.createProperty, "owner-a", {
        organizationId: f.orgA, propertyReference: `S-${suffix}`, propertyType: sdk.PropertyType.VILLA,
        marketType: sdk.MarketType.SECONDARY, bedrooms: 4, areaUnit: sdk.AreaUnit.SQM, occupancyStatus: sdk.OccupancyStatus.VACANT,
        inventoryStatus: sdk.InventoryStatus.DRAFT,
      })).property.id;
      assignedProperty = (await run(sdk.createProperty, "owner-a", {
        organizationId: f.orgA, propertyReference: `AGENT-${suffix}`, propertyType: sdk.PropertyType.APARTMENT,
        marketType: sdk.MarketType.SECONDARY, assignedMembershipId: f.memberAgentA, areaUnit: sdk.AreaUnit.SQFT, occupancyStatus: sdk.OccupancyStatus.VACANT,
        inventoryStatus: sdk.InventoryStatus.DRAFT,
      })).property.id;

      listingA = (await run(sdk.createPropertyListing, "owner-a", {
        organizationId: f.orgA, propertyId: projectProperty, listingReference: `LIST-A-${suffix}`,
        listingPurpose: sdk.ListingPurpose.SALE, marketType: sdk.MarketType.OFF_PLAN,
        title: "Assigned listing A", askingPriceMinor: "90000000", currency: "AED",
        assignedMembershipId: f.memberAgentA, listingStatus: sdk.ListingStatus.ACTIVE,
        publicationStatus: sdk.ListingPublicationStatus.READY,
      })).propertyListing.id;
      listingForAgentTwo = (await run(sdk.createPropertyListing, "owner-a", {
        organizationId: f.orgA, propertyId: projectProperty, listingReference: `LIST-B-${suffix}`,
        listingPurpose: sdk.ListingPurpose.SALE, marketType: sdk.MarketType.OFF_PLAN,
        title: "Assigned listing B", askingPriceMinor: "95000000", currency: "AED",
        assignedMembershipId: "11000000-0000-4000-8000-000000000005", listingStatus: sdk.ListingStatus.DRAFT,
        publicationStatus: sdk.ListingPublicationStatus.NOT_PUBLISHED,
      })).propertyListing.id;

      const ownerListings = await run(sdk.listPropertyListings, "owner-a", { organizationId: f.orgA, limit: 100, offset: 0 });
      const agentListings = await run(sdk.listAssignedPropertyListings, "agent-a", {
        organizationId: f.orgA, assignedMembershipId: f.memberAgentA, limit: 100, offset: 0,
      });
      assert.ok(ownerListings.propertyListings.some(row => key(row.id) === key(listingForAgentTwo)));
      assert.ok(ownerListings.propertyListings.some(row => key(row.id) === key(listingA)));
      assert.ok(agentListings.propertyListings.some(row => key(row.id) === key(listingA)));
      assert.ok(agentListings.propertyListings.every(row => key(row.assignedMembershipId) === key(f.memberAgentA)));
      assert.equal((await run(sdk.getAssignedPropertyListing, "agent-a", { organizationId: f.orgA, id: listingForAgentTwo, assignedMembershipId: f.memberAgentA })).propertyListing, null);
      await forbidden(sdk.createProperty, "agent-a", {
        organizationId: f.orgA, propertyReference: `AGENT-${suffix}`, propertyType: sdk.PropertyType.APARTMENT,
        marketType: sdk.MarketType.SECONDARY, areaUnit: sdk.AreaUnit.SQFT, occupancyStatus: sdk.OccupancyStatus.VACANT, inventoryStatus: sdk.InventoryStatus.DRAFT,
      });
      await forbidden(sdk.createProperty, "owner-a", {
        organizationId: f.orgA, propertyReference: `FOREIGN-AGENT-${suffix}`, propertyType: sdk.PropertyType.APARTMENT,
        marketType: sdk.MarketType.SECONDARY, assignedMembershipId: "21000000-0000-4000-8000-000000000002", areaUnit: sdk.AreaUnit.SQFT, occupancyStatus: sdk.OccupancyStatus.VACANT,
        inventoryStatus: sdk.InventoryStatus.DRAFT,
      });
      await forbidden(sdk.createProperty, "manager-a", {
        organizationId: f.orgA, propertyReference: `MANAGER-${suffix}`, propertyType: sdk.PropertyType.APARTMENT,
        marketType: sdk.MarketType.SECONDARY, areaUnit: sdk.AreaUnit.SQFT, occupancyStatus: sdk.OccupancyStatus.VACANT, inventoryStatus: sdk.InventoryStatus.DRAFT,
      });
      await forbidden(sdk.listProperties, "manager-a", { organizationId: f.orgA, limit: 50, offset: 0 });
      await forbidden(sdk.createProperty, "owner-a", {
        organizationId: f.orgA, propertyReference: `BAD-AREA-${suffix}`, projectId: projectA, buildingId: projectB,
        propertyType: sdk.PropertyType.APARTMENT, marketType: sdk.MarketType.OFF_PLAN, builtUpArea: -5, areaUnit: sdk.AreaUnit.SQFT,
        occupancyStatus: sdk.OccupancyStatus.VACANT, inventoryStatus: sdk.InventoryStatus.DRAFT,
      });
      const allProperties = await run(sdk.listProperties, "owner-a", { organizationId: f.orgA, limit: 100, offset: 0 });
      assert.equal(allProperties.total[0]._count, 3);
      assert.deepEqual(new Set(allProperties.properties.map(row => key(row.id))), new Set([key(projectProperty), key(standaloneProperty), key(assignedProperty)]));

      floorPlanA = (await run(sdk.createFloorPlan, "owner-a", {
        organizationId: f.orgA, projectId: projectA, propertyId: projectProperty, buildingId: buildingA,
        name: `Two bedroom ${suffix}`, propertyType: sdk.PropertyType.APARTMENT, bedrooms: 2,
        builtUpArea: 1250.5, plotArea: null, areaUnit: sdk.AreaUnit.SQFT, mediaReference: null,
      })).floorPlan.id;
      const floorPlan = (await run(sdk.getFloorPlan, "owner-a", {organizationId: f.orgA, id: floorPlanA})).floorPlan;
      assert.equal(key(floorPlan.propertyId), key(projectProperty));
      await forbidden(sdk.createFloorPlan, "owner-a", {
        organizationId: f.orgA, projectId: projectA, propertyId: foreignProperty, buildingId: buildingA,
        name: "Cross-project plan", propertyType: sdk.PropertyType.APARTMENT, areaUnit: sdk.AreaUnit.SQFT,
      });

      const beforeUpdate = (await run(sdk.getProperty, "owner-a", {organizationId: f.orgA, id: projectProperty})).property;
      const update = {
        organizationId: f.orgA, id: projectProperty, expectedInventoryStatus: sdk.InventoryStatus.AVAILABLE,
        propertyReference: beforeUpdate.propertyReference, projectId: beforeUpdate.projectId, buildingId: beforeUpdate.buildingId,
        unitNumber: beforeUpdate.unitNumber, propertyType: beforeUpdate.propertyType, marketType: beforeUpdate.marketType,
        bedrooms: beforeUpdate.bedrooms, bathrooms: beforeUpdate.bathrooms, floorNumber: beforeUpdate.floorNumber,
        builtUpArea: beforeUpdate.builtUpArea, plotArea: beforeUpdate.plotArea, areaUnit: beforeUpdate.areaUnit,
        furnishedStatus: beforeUpdate.furnishedStatus, parkingSpaces: beforeUpdate.parkingSpaces, view: beforeUpdate.view,
        emirate: beforeUpdate.emirate, community: beforeUpdate.community, area: beforeUpdate.area, address: beforeUpdate.address,
        latitude: beforeUpdate.latitude, longitude: beforeUpdate.longitude, referencePriceMinor: beforeUpdate.referencePriceMinor,
        internalNotes: beforeUpdate.internalNotes, ownershipReference: beforeUpdate.ownershipReference, mandateReference: beforeUpdate.mandateReference,
        assignedMembershipId: beforeUpdate.assignedMembershipId, occupancyStatus: beforeUpdate.occupancyStatus,
        inventoryStatus: sdk.InventoryStatus.RESERVED,
      };
      await run(sdk.updateProperty, "owner-a", update);
      assert.equal((await run(sdk.getProperty, "owner-a", {organizationId: f.orgA, id: projectProperty})).property.inventoryStatus, "RESERVED");
      await forbidden(sdk.updateProperty, "owner-a", {...update, expectedInventoryStatus: sdk.InventoryStatus.RESERVED, inventoryStatus: sdk.InventoryStatus.DRAFT});
      await forbidden(sdk.updateProperty, "owner-a", {...update, expectedInventoryStatus: sdk.InventoryStatus.AVAILABLE, inventoryStatus: sdk.InventoryStatus.RESERVED});
      await forbidden(sdk.getProperty, "agent-a", {organizationId: f.orgA, id: projectProperty});
      await forbidden(sdk.listProperties, "agent-a", {organizationId: f.orgA, limit: 50, offset: 0});
    });

    it("supports tenant-owned amenities and structured property features with authorized reads", async () => {
      amenityA = (await run(sdk.createInventoryAmenity, "owner-a", {
        organizationId: f.orgA, name: `Pool ${suffix}`, category: "RECREATION",
      })).amenity.id;
      amenityB = (await run(sdk.createInventoryAmenity, "owner-b", {
        organizationId: f.orgB, name: `Gym ${suffix}`, category: "FITNESS",
      })).amenity.id;
      await run(sdk.attachPropertyAmenity, "owner-a", { organizationId: f.orgA, propertyId: projectProperty, amenityId: amenityA });
      await forbidden(sdk.attachPropertyAmenity, "owner-a", { organizationId: f.orgA, propertyId: projectProperty, amenityId: amenityB });
      const amenity = await run(sdk.getInventoryAmenity, "owner-a", { organizationId: f.orgA, id: amenityA });
      assert.equal(amenity.inventoryAmenity.name, `Pool ${suffix}`);

      featureA = (await run(sdk.createPropertyFeature, "owner-a", {
        organizationId: f.orgA, propertyId: projectProperty, key: "balcony", valueType: sdk.FeatureValueType.BOOLEAN, booleanValue: true,
      })).feature.id;
      const feature = await run(sdk.getPropertyFeature, "owner-a", { organizationId: f.orgA, id: featureA });
      assert.equal(feature.propertyFeature.booleanValue, true);
      assert.equal(key(feature.propertyFeature.propertyId), key(projectProperty));
      await forbidden(sdk.getPropertyFeature, "agent-a", {organizationId: f.orgA, id: featureA});
      assert.equal((await run(sdk.getPropertyFeature, "owner-b", { organizationId: f.orgB, id: featureA })).propertyFeature, null);
    });

    it("keeps private media tenant and assignment scoped and changes a property cover atomically", async () => {
      const createMedia = (name, mediaKind, contentType) => run(sdk.createInventoryMedia, "owner-a", {
        organizationId: f.orgA, propertyId: assignedProperty, projectId: null, floorPlanId: null,
        storagePath: `organizations/${f.orgA}/properties/${assignedProperty}/${randomUUID()}/${name}`,
        fileName: name, contentType, byteSize: "1024", mediaKind, sortOrder: 0,
      });
      const first = (await createMedia("front.jpg", sdk.InventoryMediaKind.PROPERTY_PHOTO, "image/jpeg")).inventoryMedia.id;
      const second = (await createMedia("garden.jpg", sdk.InventoryMediaKind.PROPERTY_PHOTO, "image/jpeg")).inventoryMedia.id;
      const document = (await createMedia("title-deed.pdf", sdk.InventoryMediaKind.DOCUMENT, "application/pdf")).inventoryMedia.id;
      for (const id of [first, second, document]) {
        await run(sdk.setInventoryMediaStatus, "owner-a", {organizationId: f.orgA, id, expectedStatus: sdk.InventoryMediaStatus.PENDING, status: sdk.InventoryMediaStatus.ACTIVE});
      }

      const assigned = await run(sdk.getAssignedPropertyInventoryMedia, "agent-a", {organizationId: f.orgA, id: first, assignedMembershipId: f.memberAgentA});
      assert.equal(assigned.inventoryMedias[0].fileName, "front.jpg");
      await forbidden(sdk.getAssignedPropertyInventoryMedia, "agent-a", {organizationId: f.orgA, id: first, assignedMembershipId: "21000000-0000-4000-8000-000000000002"});
      await forbidden(sdk.getInventoryMedia, "agent-a", {organizationId: f.orgA, id: first});
      assert.equal((await run(sdk.getInventoryMedia, "owner-b", {organizationId: f.orgB, id: first})).inventoryMedias.length, 0);
      await forbidden(sdk.createInventoryMedia, "owner-a", {
        organizationId: f.orgA, propertyId: assignedProperty, projectId: null, floorPlanId: null,
        storagePath: `organizations/${f.orgA}/properties/${assignedProperty}/${randomUUID()}/invalid.html`,
        fileName: "invalid.html", contentType: "text/html", byteSize: "128", mediaKind: sdk.InventoryMediaKind.DOCUMENT, sortOrder: 0,
      });
      await forbidden(sdk.setInventoryMediaStatus, "owner-a", {
        organizationId: f.orgA, id: first, expectedStatus: sdk.InventoryMediaStatus.ACTIVE, status: sdk.InventoryMediaStatus.DELETED,
      });
      await forbidden(sdk.updateInventoryMediaOrder, "owner-a", {
        organizationId: f.orgA, id: document, sortOrder: 2, isCover: true,
      });

      await run(sdk.setPropertyMediaCover, "owner-a", {organizationId: f.orgA, propertyId: assignedProperty, id: first, sortOrder: 0});
      await run(sdk.setPropertyMediaCover, "owner-a", {organizationId: f.orgA, propertyId: assignedProperty, id: second, sortOrder: 1});
      const media = await run(sdk.listInventoryMedia, "owner-a", {organizationId: f.orgA, propertyId: assignedProperty, projectId: null, floorPlanId: null});
      assert.equal(media.inventoryMedias.filter(row => row.isCover).length, 1);
      assert.equal(media.inventoryMedias.find(row => row.isCover).id.toLowerCase(), second.toLowerCase());
      await forbidden(sdk.setPropertyMediaCover, "owner-a", {organizationId: f.orgA, propertyId: assignedProperty, id: document, sortOrder: 2});
    });

    it("rejects invalid or stale listing status transitions at the connector boundary", async () => {
      const current = (await run(sdk.getPropertyListing, "owner-a", {organizationId: f.orgA, id: listingA})).propertyListing;
      const update = {
        organizationId: f.orgA, id: listingA, expectedListingStatus: sdk.ListingStatus.ACTIVE,
        propertyId: current.propertyId, listingReference: current.listingReference, listingPurpose: current.listingPurpose,
        marketType: current.marketType, title: current.title, description: current.description,
        askingPriceMinor: current.askingPriceMinor, currency: current.currency, rentalPeriod: current.rentalPeriod,
        assignedMembershipId: current.assignedMembershipId, listingStatus: sdk.ListingStatus.PAUSED,
        publicationStatus: current.publicationStatus, advertisingPermitNumber: current.advertisingPermitNumber,
        permitExpiryDate: current.permitExpiryDate, permitVerificationUrl: current.permitVerificationUrl,
      };
      await forbidden(sdk.updatePropertyListing, "owner-a", {...update, listingStatus: sdk.ListingStatus.DRAFT});
      await run(sdk.updatePropertyListing, "owner-a", update);
      assert.equal((await run(sdk.getPropertyListing, "owner-a", {organizationId: f.orgA, id: listingA})).propertyListing.listingStatus, "PAUSED");
      await forbidden(sdk.updatePropertyListing, "owner-a", {...update, listingStatus: sdk.ListingStatus.CLOSED});
    });

    it("stores exact payment-plan percentages in basis points and blocks invalid activation", async () => {
      paymentPlanA = (await run(sdk.createPaymentPlan, "owner-a", {
        organizationId: f.orgA, projectId: projectA, propertyId: projectProperty, name: `Plan ${suffix}`,
        bookingPercentageBps: 1000, handoverPercentageBps: 2000,
      })).paymentPlan.id;
      await run(sdk.addPaymentPlanInstallment, "owner-a", {
        organizationId: f.orgA, paymentPlanId: paymentPlanA, expectedTotalBps: 0, newTotalBps: 5000,
        position: 0, percentageBps: 5000, dueTrigger: sdk.PaymentDueTrigger.CONSTRUCTION_MILESTONE,
        constructionMilestonePercent: 50,
      });
      await run(sdk.addPaymentPlanInstallment, "owner-a", {
        organizationId: f.orgA, paymentPlanId: paymentPlanA, expectedTotalBps: 5000, newTotalBps: 7000,
        position: 1, percentageBps: 2000, dueTrigger: sdk.PaymentDueTrigger.POST_HANDOVER, postHandoverMonths: 12,
      });
      await run(sdk.setPaymentPlanActive, "owner-a", {
        organizationId: f.orgA, id: paymentPlanA, expectedInstallmentTotalBps: 7000, isActive: true,
      });
      const plan = await run(sdk.getPaymentPlan, "owner-a", { organizationId: f.orgA, id: paymentPlanA });
      assert.equal(plan.paymentPlan.bookingPercentageBps + plan.paymentPlan.handoverPercentageBps + plan.paymentPlan.installmentTotalBps, 10000);
      assert.equal(plan.paymentPlan.paymentPlanInstallments_on_paymentPlan.length, 2);
      assert.equal(key(plan.paymentPlan.propertyId), key(projectProperty));
      await forbidden(sdk.createPaymentPlan, "owner-a", {
        organizationId: f.orgA, projectId: projectA, propertyId: foreignProperty, name: `Cross-project plan ${suffix}`,
        bookingPercentageBps: 0, handoverPercentageBps: 0,
      });

      const invalid = (await run(sdk.createPaymentPlan, "owner-a", {
        organizationId: f.orgA, projectId: projectA, name: `Invalid ${suffix}`, bookingPercentageBps: 500, handoverPercentageBps: 500,
      })).paymentPlan.id;
      await forbidden(sdk.setPaymentPlanActive, "owner-a", {
        organizationId: f.orgA, id: invalid, expectedInstallmentTotalBps: 0, isActive: true,
      });
      const stillInactive = await run(sdk.getPaymentPlan, "owner-a", { organizationId: f.orgA, id: invalid });
      assert.equal(stillInactive.paymentPlan.isActive, false);
    });

    it("persists audits, supports tenant pagination and archives without hard deletion", async () => {
      const page = await run(sdk.listProjects, "owner-a", { organizationId: f.orgA, limit: 1, offset: 0 });
      assert.equal(page.projects.length, 1);
      assert.ok(page.total[0]._count >= 1);
      // This unit was reserved by the transition test; the project count is
      // explicitly AVAILABLE inventory, so reserved units must not be counted.
      assert.equal((await run(sdk.getProperty, "owner-a", {organizationId: f.orgA, id: projectProperty})).property.inventoryStatus, "RESERVED");
      assert.equal(page.projects[0].properties_on_project[0]?._count ?? 0, 0);

      await run(sdk.archiveProperty, "owner-a", { organizationId: f.orgA, id: standaloneProperty });
      assert.equal((await run(sdk.getProperty, "owner-a", { organizationId: f.orgA, id: standaloneProperty })).property, null);
      const audit = await run(sdk.listActivities, "owner-a", { organizationId: f.orgA });
      assert.ok(audit.activities.some(event => event.kind === "PROPERTY_ARCHIVED" && key(event.targetId) === key(standaloneProperty)));
      const projectAudit = await run(sdk.listProjectAuditEvents, "owner-a", {organizationId: f.orgA, projectId: projectA, limit: 50, offset: 0});
      assert.ok(projectAudit.auditLogs.some(event => event.action === "PROJECT_CREATED" && key(event.targetId) === key(projectA)));

      const unusedDeveloper = (await run(sdk.createDeveloper, "owner-a", {
        organizationId: f.orgA, name: "Unused developer", slug: `unused-${suffix}`, country: "AE", status: sdk.DeveloperStatus.ACTIVE,
      })).developer.id;
      await run(sdk.archiveDeveloper, "owner-a", {organizationId: f.orgA, id: unusedDeveloper});
      assert.equal((await run(sdk.getDeveloper, "owner-a", {organizationId: f.orgA, id: unusedDeveloper})).developer, null);
    });
  });
}
