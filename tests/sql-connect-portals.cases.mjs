import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";

export function registerPortalCases({sdk, run, forbidden, dc}) {
  describe("Phase 5E property portal foundation", {concurrency: false}, () => {
    const suffix = randomUUID();
    const owner = `portal-owner-${suffix}`, ownerB = `portal-owner-b-${suffix}`, agent = `portal-agent-${suffix}`;
    const memberAgent = randomUUID();
    const hash = "a".repeat(64);
    let org, orgB, listing, draftListing, listingB;
    const key = value => value.replaceAll("-", "").toLowerCase();
    const settings = (uid = owner, organizationId = org) => run(sdk.getPortalSettings, uid, {organizationId});
    const audits = async (action) => (await dc.executeGraphql(`query PortalAudits($org: UUID!, $action: ActivityKind!) { auditLogs(where: {organizationId: {eq: $org}, action: {eq: $action}}) { id targetType metadata } }`, {variables: {org, action}})).data.auditLogs;

    before(async () => {
      for (const uid of [owner, ownerB, agent]) await run(sdk.upsertMyProfile, uid, {displayName: "Portal integration"});
      org = (await run(sdk.createOrganization, owner, {name: "Portal company A", slug: `portal-a-${suffix}`})).organization.id;
      orgB = (await run(sdk.createOrganization, ownerB, {name: "Portal company B", slug: `portal-b-${suffix}`})).organization.id;
      // Fixture setup only: the harness refuses non-demo projects and non-loopback hosts.
      await dc.executeGraphql(`mutation PortalAgent($org: UUID!, $uid: String!, $id: UUID!) { membership_insert(data: {organizationId: $org, id: $id, userProfileUid: $uid, email: "portal-agent@example.test", role: AGENT, status: ACTIVE}) }`, {variables: {org, uid: agent, id: memberAgent}});
      const property = async (company, uid, reference) => (await run(sdk.createProperty, uid, {
        organizationId: company, propertyReference: `${reference}-${suffix}`, propertyType: sdk.PropertyType.APARTMENT, marketType: sdk.MarketType.SECONDARY,
        bedrooms: 2, builtUpArea: 1200, emirate: sdk.Emirate.DUBAI, community: "Dubai Marina", areaUnit: sdk.AreaUnit.SQFT,
        occupancyStatus: sdk.OccupancyStatus.VACANT, inventoryStatus: sdk.InventoryStatus.AVAILABLE, internalNotes: "PRIVATE-NOTE", ownershipReference: "PRIVATE-OWNER",
      })).property.id;
      const createListing = async (company, uid, propertyId, reference, listingStatus, assignedMembershipId = null) => (await run(sdk.createPropertyListing, uid, {
        organizationId: company, propertyId, assignedMembershipId, listingReference: `${reference}-${suffix}`, listingPurpose: sdk.ListingPurpose.SALE,
        marketType: sdk.MarketType.SECONDARY, title: "Portal export apartment", description: "Portal export description", askingPriceMinor: "150000000",
        currency: "AED", listingStatus, publicationStatus: sdk.ListingPublicationStatus.NOT_PUBLISHED, advertisingPermitNumber: "7100000001",
      })).propertyListing.id;
      const p1 = await property(org, owner, "PORTAL-P1");
      listing = await createListing(org, owner, p1, "PORTAL-L1", sdk.ListingStatus.ACTIVE, memberAgent);
      draftListing = await createListing(org, owner, p1, "PORTAL-L2", sdk.ListingStatus.DRAFT);
      listingB = await createListing(orgB, ownerB, await property(orgB, ownerB, "PORTAL-PB"), "PORTAL-LB", sdk.ListingStatus.ACTIVE);
      await dc.executeGraphql(`mutation PortalMedia($org: UUID!, $property: UUID!, $uid: String!, $a: String!, $b: String!, $c: String!) { inventoryMedia_insertMany(data: [
        {organizationId: $org, propertyId: $property, storagePath: $a, fileName: "living-room.jpg", contentType: "image/jpeg", byteSize: "1000", mediaKind: PROPERTY_PHOTO, status: ACTIVE, isCover: true, uploadedByUid: $uid},
        {organizationId: $org, propertyId: $property, storagePath: $b, fileName: "title-deed.pdf", contentType: "application/pdf", byteSize: "1000", mediaKind: DOCUMENT, status: ACTIVE, isCover: false, uploadedByUid: $uid},
        {organizationId: $org, propertyId: $property, storagePath: $c, fileName: "pending.jpg", contentType: "image/jpeg", byteSize: "1000", mediaKind: PROPERTY_PHOTO, status: PENDING, isCover: false, uploadedByUid: $uid}]) }`,
      {variables: {org, property: p1, uid: owner, a: `test/${suffix}/a.jpg`, b: `test/${suffix}/b.pdf`, c: `test/${suffix}/c.jpg`}});
    });

    it("records administrator connection states, rejects verified-only states and stale writes, and audits changes", async () => {
      assert.deepEqual((await settings()).connections, []);
      const save = (uid, extras) => run(sdk.savePortalConnection, uid, {organizationId: org, provider: sdk.PortalProvider.BAYUT, status: sdk.PortalConnectionStatus.PENDING_APPROVAL, accountReference: "BROKER-42", ...extras});
      for (const status of [sdk.PortalConnectionStatus.CONNECTED, sdk.PortalConnectionStatus.ERROR]) await assert.rejects(() => save(owner, {status}));
      await assert.rejects(() => save(agent, {}));
      await assert.rejects(() => save(ownerB, {}));
      await assert.rejects(() => save(null, {}));
      await save(owner, {});
      let [connection] = (await settings()).connections;
      assert.equal(connection.status, "PENDING_APPROVAL"); assert.equal(connection.accountReference, "BROKER-42"); assert.equal(connection.lastVerifiedAt, null);
      await assert.rejects(() => save(owner, {status: sdk.PortalConnectionStatus.DISABLED}));
      await assert.rejects(() => save(owner, {status: sdk.PortalConnectionStatus.DISABLED, expectedUpdatedAt: new Date(0).toISOString()}));
      await save(owner, {status: sdk.PortalConnectionStatus.DISABLED, expectedUpdatedAt: connection.updatedAt});
      const rows = (await settings()).connections;
      assert.equal(rows.length, 1); assert.equal(rows[0].status, "DISABLED"); assert.equal(key(rows[0].id), key(connection.id));
      assert.deepEqual((await settings(ownerB, orgB)).connections, []);
      assert.equal((await audits("PORTAL_CONNECTION_UPDATED")).length, 2);
    });

    it("limits portal settings and exports to administrators of the same company", async () => {
      for (const [uid, organizationId] of [[agent, org], [ownerB, org], [null, org]]) {
        await forbidden(sdk.getPortalSettings, uid, {organizationId});
        await forbidden(sdk.getPortalExportListing, uid, {organizationId, listingId: listing});
        await forbidden(sdk.listPortalExportListings, uid, {organizationId});
      }
      await forbidden(sdk.getPortalSettings, owner, {organizationId: org}, {email_verified: false});
      // A company's own administrator cannot reach another company's listing by ID.
      await forbidden(sdk.getPortalExportListing, ownerB, {organizationId: orgB, listingId: listing});
      await forbidden(sdk.getPortalExportListing, owner, {organizationId: org, listingId: listingB});
    });

    it("selects only public advertising data and active photos for export", async () => {
      const {listing: row} = await run(sdk.getPortalExportListing, owner, {organizationId: org, listingId: listing});
      assert.equal(row.listingReference, `PORTAL-L1-${suffix}`);
      assert.deepEqual(row.property.inventoryMedias_on_property.map(media => media.fileName), ["living-room.jpg"]);
      assert.equal(row.assignedMembership.userProfile.displayName, "Portal integration");
      const serialized = JSON.stringify(row);
      for (const secret of ["PRIVATE-NOTE", "PRIVATE-OWNER", "title-deed", "portal-agent@example.test"]) assert.ok(!serialized.includes(secret), secret);
      const page = await run(sdk.listPortalExportListings, owner, {organizationId: org, limit: 100, offset: 0});
      assert.deepEqual(page.listings.map(item => key(item.id)), [key(listing)]);
      assert.equal(page.total[0]._count, 1);
    });

    it("upserts and removes company field mappings without crossing tenants", async () => {
      const set = (uid, organizationId, targetValue) => run(sdk.setPortalFieldMapping, uid, {organizationId, provider: sdk.PortalProvider.PROPERTY_FINDER, fieldKey: "PROPERTY_TYPE", sourceValue: "APARTMENT", targetValue});
      await set(owner, org, "AP"); await set(owner, org, "APT");
      let mappings = (await settings()).mappings;
      assert.equal(mappings.length, 1); assert.equal(mappings[0].targetValue, "APT");
      await assert.rejects(() => set(agent, org, "X"));
      await assert.rejects(() => run(sdk.setPortalFieldMapping, owner, {organizationId: org, provider: sdk.PortalProvider.BAYUT, fieldKey: "bad key", sourceValue: "a", targetValue: "b"}));
      await forbidden(sdk.removePortalFieldMapping, ownerB, {organizationId: orgB, id: mappings[0].id});
      await forbidden(sdk.removePortalFieldMapping, ownerB, {organizationId: org, id: mappings[0].id});
      assert.equal((await settings()).mappings.length, 1);
      await run(sdk.removePortalFieldMapping, owner, {organizationId: org, id: mappings[0].id});
      mappings = (await settings()).mappings;
      assert.equal(mappings.length, 0);
      await forbidden(sdk.removePortalFieldMapping, owner, {organizationId: org, id: randomUUID()});
      assert.equal((await audits("PORTAL_FIELD_MAPPING_CHANGED")).length, 3);
    });

    it("records validation results per listing and provider with attempt history", async () => {
      const record = (uid, extras) => run(sdk.recordListingValidation, uid, {organizationId: org, listingId: listing, provider: sdk.PortalProvider.PROPERTY_FINDER, status: sdk.ListingPublicationState.VALIDATION_FAILED, errorCount: 2, warningCount: 1, payloadHash: hash, errorSummary: "PERMIT_REQUIRED, PHOTOS_REQUIRED", ...extras});
      await assert.rejects(() => record(owner, {status: sdk.ListingPublicationState.READY}));
      await assert.rejects(() => record(owner, {status: sdk.ListingPublicationState.VALIDATION_FAILED, errorCount: 0}));
      for (const status of ["PUBLISHED", "QUEUED", "REMOVED"]) await assert.rejects(() => record(owner, {status: sdk.ListingPublicationState[status], errorCount: 0}));
      await assert.rejects(() => record(owner, {payloadHash: "not-a-hash"}));
      await assert.rejects(() => record(agent, {}));
      await assert.rejects(() => record(ownerB, {organizationId: orgB}));
      await assert.rejects(() => run(sdk.recordListingValidation, owner, {organizationId: org, listingId: listingB, provider: sdk.PortalProvider.BAYUT, status: sdk.ListingPublicationState.READY, errorCount: 0, warningCount: 0, payloadHash: hash}));
      await record(owner, {});
      await record(owner, {status: sdk.ListingPublicationState.READY, errorCount: 0, errorSummary: null});
      await run(sdk.recordListingValidation, owner, {organizationId: org, listingId: listing, provider: sdk.PortalProvider.BAYUT, status: sdk.ListingPublicationState.READY, errorCount: 0, warningCount: 0, payloadHash: hash});
      const {listing: row} = await run(sdk.getPortalExportListing, owner, {organizationId: org, listingId: listing});
      assert.equal(row.listingPublications_on_listing.length, 2);
      const pf = row.listingPublications_on_listing.find(item => item.provider === "PROPERTY_FINDER");
      assert.equal(pf.status, "READY"); assert.equal(pf.errorCount, 0); assert.ok(pf.lastValidatedAt);
      assert.deepEqual(pf.publicationAttempts_on_publication.map(item => item.outcome), ["SUCCEEDED", "FAILED"]);
      assert.equal(pf.publicationAttempts_on_publication[1].errorSummary, "PERMIT_REQUIRED, PHOTOS_REQUIRED");
      const counts = (await settings()).publicationCounts;
      assert.deepEqual(counts.map(item => `${item.provider}:${item.status}:${item.count}`).sort(), ["BAYUT:READY:1", "PROPERTY_FINDER:READY:1"]);
      assert.equal((await audits("LISTING_PUBLICATION_VALIDATED")).length, 3);
    });

    it("never overwrites a publication that a future publisher has queued or published", async () => {
      await dc.executeGraphql(`mutation LockPublication($org: UUID!, $listing: UUID!) { listingPublication_updateMany(where: {organizationId: {eq: $org}, listingId: {eq: $listing}, provider: {eq: BAYUT}}, data: {status: PUBLISHED}) }`, {variables: {org, listing}});
      await assert.rejects(() => run(sdk.recordListingValidation, owner, {organizationId: org, listingId: listing, provider: sdk.PortalProvider.BAYUT, status: sdk.ListingPublicationState.VALIDATION_FAILED, errorCount: 1, warningCount: 0, payloadHash: hash}));
      const {listing: row} = await run(sdk.getPortalExportListing, owner, {organizationId: org, listingId: listing});
      assert.equal(row.listingPublications_on_listing.find(item => item.provider === "BAYUT").status, "PUBLISHED");
      // Draft listings can still be validated (as failures) for review.
      await run(sdk.recordListingValidation, owner, {organizationId: org, listingId: draftListing, provider: sdk.PortalProvider.BAYUT, status: sdk.ListingPublicationState.VALIDATION_FAILED, errorCount: 1, warningCount: 0, payloadHash: hash, errorSummary: "LISTING_NOT_ACTIVE"});
    });

    it("records consistent dry-run feed jobs only", async () => {
      const startedAt = new Date(Date.now() - 1000).toISOString();
      const job = (uid, extras) => run(sdk.recordFeedGenerationJob, uid, {organizationId: org, provider: sdk.PortalProvider.DUBIZZLE, format: sdk.FeedFormat.XML, status: sdk.FeedGenerationStatus.SUCCEEDED, listingCount: 3, validCount: 2, invalidCount: 1, byteSize: 2048, errorSummary: "PERMIT_REQUIRED:1", startedAt, ...extras});
      await assert.rejects(() => job(owner, {validCount: 3}));
      await assert.rejects(() => job(owner, {status: sdk.FeedGenerationStatus.RUNNING}));
      await assert.rejects(() => job(owner, {startedAt: new Date(Date.now() + 60000).toISOString()}));
      await assert.rejects(() => job(agent, {}));
      await assert.rejects(() => job(ownerB, {}));
      await job(owner, {});
      const [recorded] = (await settings()).recentJobs;
      assert.equal(recorded.provider, "DUBIZZLE"); assert.equal(recorded.dryRun, true); assert.equal(recorded.validCount, 2); assert.ok(recorded.finishedAt);
      assert.deepEqual((await settings(ownerB, orgB)).recentJobs, []);
      assert.equal((await audits("FEED_GENERATION_RECORDED")).length, 1);
    });

    it("leaves existing inventory listing operations unchanged", async () => {
      const {propertyListing} = await run(sdk.getPropertyListing, owner, {organizationId: org, id: listing});
      assert.equal(propertyListing.publicationStatus, "NOT_PUBLISHED");
      assert.equal(propertyListing.listingStatus, "ACTIVE");
    });
  });
}
