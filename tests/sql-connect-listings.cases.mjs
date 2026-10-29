import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";
import { fixture as f } from "./fixtures/sql-connect-fixtures.mjs";

const key = value => value.replaceAll("-", "").toLowerCase();

export function registerListingCases({ sdk, run, forbidden, dc }) {
  describe("Listing workflow, status counts, sorting and cover photos", { concurrency: false }, () => {
    const suffix = randomUUID().slice(0, 8);
    const community = `Listing Probe ${suffix}`;
    let propertyId, cheap, expensive, agentDraft;
    const listing = (reference, extra = {}) => ({
      organizationId: f.orgA, propertyId, listingReference: `${reference}-${suffix}`, listingPurpose: sdk.ListingPurpose.SALE,
      marketType: sdk.MarketType.SECONDARY, title: `${reference} listing`, askingPriceMinor: "100000000", currency: "AED",
      listingStatus: sdk.ListingStatus.DRAFT, publicationStatus: sdk.ListingPublicationStatus.NOT_PUBLISHED, ...extra,
    });
    const step = (uid, id, expectedStatus, status) => run(sdk.setPropertyListingStatus, uid, {organizationId: f.orgA, id, expectedStatus, status});
    const status = async id => (await run(sdk.getPropertyListing, "owner-a", {organizationId: f.orgA, id})).propertyListing.listingStatus;

    before(async () => {
      propertyId = (await run(sdk.createProperty, "owner-a", {
        organizationId: f.orgA, propertyReference: `LP-${suffix}`, propertyType: sdk.PropertyType.APARTMENT, marketType: sdk.MarketType.SECONDARY,
        areaUnit: sdk.AreaUnit.SQFT, occupancyStatus: sdk.OccupancyStatus.VACANT, inventoryStatus: sdk.InventoryStatus.AVAILABLE,
        emirate: sdk.Emirate.DUBAI, community, bedrooms: 2, builtUpArea: 1250, assignedMembershipId: f.memberAgentA,
      })).property.id;
      cheap = (await run(sdk.createPropertyListing, "owner-a", listing("CHEAP", {askingPriceMinor: "90000000"}))).propertyListing.id;
      expensive = (await run(sdk.createPropertyListing, "owner-a", listing("DEAR", {askingPriceMinor: "990000000"}))).propertyListing.id;
      agentDraft = (await run(sdk.createPropertyListing, "owner-a", listing("AGENT", {assignedMembershipId: f.memberAgentA, askingPriceMinor: "300000000"}))).propertyListing.id;
    });

    it("moves through the workflow one step at a time and records from/to in activity", async () => {
      for (const [from, to] of [["DRAFT", "PENDING_REVIEW"], ["PENDING_REVIEW", "APPROVED"], ["APPROVED", "ACTIVE"], ["ACTIVE", "PAUSED"], ["PAUSED", "ACTIVE"]]) {
        await step("owner-a", cheap, sdk.ListingStatus[from], sdk.ListingStatus[to]);
        assert.equal(await status(cheap), to);
      }
      const {activities} = await run(sdk.listListingActivity, "owner-a", {organizationId: f.orgA, id: cheap});
      const moves = activities.filter(row => row.metadata?.from).map(row => `${row.metadata.from}>${row.metadata.to}`);
      assert.deepEqual(moves, ["PAUSED>ACTIVE", "ACTIVE>PAUSED", "APPROVED>ACTIVE", "PENDING_REVIEW>APPROVED", "DRAFT>PENDING_REVIEW"]);
      assert.ok(activities.some(row => row.kind === "PROPERTY_LISTING_CREATED"));
    });

    it("rejects skipped steps, stale expected statuses and no-op changes", async () => {
      await forbidden(sdk.setPropertyListingStatus, "owner-a", {organizationId: f.orgA, id: expensive, expectedStatus: sdk.ListingStatus.DRAFT, status: sdk.ListingStatus.ACTIVE});
      await forbidden(sdk.setPropertyListingStatus, "owner-a", {organizationId: f.orgA, id: expensive, expectedStatus: sdk.ListingStatus.PENDING_REVIEW, status: sdk.ListingStatus.APPROVED});
      await forbidden(sdk.setPropertyListingStatus, "owner-a", {organizationId: f.orgA, id: expensive, expectedStatus: sdk.ListingStatus.DRAFT, status: sdk.ListingStatus.DRAFT});
      assert.equal(await status(expensive), "DRAFT");
    });

    it("lets agents only submit and withdraw their own listings", async () => {
      await step("agent-a", agentDraft, sdk.ListingStatus.DRAFT, sdk.ListingStatus.PENDING_REVIEW);
      await forbidden(sdk.setPropertyListingStatus, "agent-a", {organizationId: f.orgA, id: agentDraft, expectedStatus: sdk.ListingStatus.PENDING_REVIEW, status: sdk.ListingStatus.APPROVED});
      await step("agent-a", agentDraft, sdk.ListingStatus.PENDING_REVIEW, sdk.ListingStatus.DRAFT);
      await forbidden(sdk.setPropertyListingStatus, "agent-a", {organizationId: f.orgA, id: expensive, expectedStatus: sdk.ListingStatus.DRAFT, status: sdk.ListingStatus.PENDING_REVIEW});
      await forbidden(sdk.setPropertyListingStatus, "owner-b", {organizationId: f.orgA, id: expensive, expectedStatus: sdk.ListingStatus.DRAFT, status: sdk.ListingStatus.PENDING_REVIEW});
      await forbidden(sdk.listListingActivity, "owner-b", {organizationId: f.orgA, id: cheap});
    });

    it("counts listings per status within the viewer's scope", async () => {
      const count = rows => Object.fromEntries(rows.map(row => [row.listingStatus, row._count]));
      const all = count((await run(sdk.listingStatusCounts, "owner-a", {organizationId: f.orgA})).statuses);
      assert.ok(all.ACTIVE >= 1 && all.DRAFT >= 2);
      const mine = count((await run(sdk.assignedListingStatusCounts, "agent-a", {organizationId: f.orgA, assignedMembershipId: f.memberAgentA})).statuses);
      const assigned = (await run(sdk.listAssignedPropertyListings, "agent-a", {organizationId: f.orgA, assignedMembershipId: f.memberAgentA, limit: 100})).total[0]._count;
      assert.equal(Object.values(mine).reduce((sum, value) => sum + value, 0), assigned, "agent counts cover only assigned listings");
      await forbidden(sdk.listingStatusCounts, "agent-a", {organizationId: f.orgA});
      await forbidden(sdk.listingStatusCounts, "owner-b", {organizationId: f.orgA});
    });

    it("sorts by price or recency on the server and returns the cover photo", async () => {
      const coverId = randomUUID();
      await dc.executeGraphql("mutation InsertCover($data: [InventoryMedia_Data!]!) { inventoryMedia_insertMany(data: $data) }", {variables: {data: [
        {organizationId: f.orgA, id: randomUUID(), propertyId, storagePath: `test/${suffix}/a.png`, fileName: "a.png", contentType: "image/png", byteSize: "1", mediaKind: "PROPERTY_PHOTO", status: "ACTIVE", sortOrder: 0, isCover: false, uploadedByUid: "owner-a"},
        {organizationId: f.orgA, id: coverId, propertyId, storagePath: `test/${suffix}/b.png`, fileName: "b.png", contentType: "image/png", byteSize: "1", mediaKind: "PROPERTY_PHOTO", status: "ACTIVE", sortOrder: 1, isCover: true, uploadedByUid: "owner-a"},
      ]}});
      const base = {organizationId: f.orgA, propertyId, limit: 10};
      const ascending = await run(sdk.listPropertyListings, "owner-a", {...base, sortUpdated: false, sortPriceAsc: true});
      assert.deepEqual(ascending.byPriceAsc.map(row => key(row.id)), [cheap, agentDraft, expensive].map(key));
      assert.equal(ascending.propertyListings, undefined, "only the requested order is returned");
      const descending = await run(sdk.listPropertyListings, "owner-a", {...base, sortUpdated: false, sortPriceDesc: true});
      assert.deepEqual(descending.byPriceDesc.map(row => key(row.id)), [expensive, agentDraft, cheap].map(key));
      const byDefault = await run(sdk.listPropertyListings, "owner-a", base);
      assert.equal(byDefault.propertyListings.length, 3);
      assert.equal(key(byDefault.propertyListings[0].property.inventoryMedias_on_property[0].id), key(coverId), "the cover photo is preferred");
      assert.equal(byDefault.propertyListings[0].property.bedrooms, 2);
    });
  });
}
