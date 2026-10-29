import assert from "node:assert/strict";
import { test } from "node:test";
import { bedroomRule, matchProperty, type MatchingProperty } from "../src/modules/leads/property-matching";
import { leadPrimaryInterestSchema, leadPropertyInterestSchema, leadPropertyViewingSchema } from "../src/modules/leads/property-validation";
const property: MatchingProperty = {
  id: "10000000-0000-4000-8000-000000000001", propertyReference: "MATCH-1", propertyType: "APARTMENT",
  bedrooms: 2, emirate: "DUBAI", community: "Dubai Marina", inventoryStatus: "AVAILABLE",
  propertyListings_on_property: [{id: "listing", title: "Apartment", listingPurpose: "SALE", askingPriceMinor: "100000000", currency: "AED", listingStatus: "ACTIVE"}],
};
const preferences = {preferredLocation: "Dubai Marina", propertyType: "Apartment", bedroomPreference: "2", budgetMin: 900000, budgetMax: 1100000, currency: "AED", transactionType: "BUY" as const};
test("matching explains all configured criteria and handles equal budget boundaries", () => {
  const match = matchProperty(preferences, property);
  assert.ok(match);
  assert.equal(match.reasons.length, 6);
  assert.ok(matchProperty({...preferences, budgetMin: 1000000, budgetMax: 1000000}, property));
  assert.equal(matchProperty({...preferences, budgetMax: 999999}, property), null);
});
test("matching excludes unavailable, wrong type, bedrooms, location and currency", () => {
  for (const inventoryStatus of ["RESERVED", "SOLD", "RENTED", "DRAFT", "INACTIVE"]) assert.equal(matchProperty(preferences, {...property, inventoryStatus}), null);
  assert.equal(matchProperty(preferences, {...property, archivedAt: new Date().toISOString()}), null);
  for (const pref of [{preferredLocation: "Abu Dhabi"}, {propertyType: "Villa"}, {bedroomPreference: "3"}, {currency: "USD"}, {transactionType: "RENT" as const}]) assert.equal(matchProperty({...preferences, ...pref}, property), null);
  assert.equal(matchProperty(preferences, {...property, propertyListings_on_property: []}), null);
});
test("rental matching explicitly compares annual costs and excludes unknown rental periods", () => {
  const rental = {...property, propertyListings_on_property: [{...property.propertyListings_on_property[0], listingPurpose: "RENT", askingPriceMinor: "1000000", rentalPeriod: "MONTHLY"}]};
  const pref = {...preferences, transactionType: "RENT" as const, budgetMin: 120000, budgetMax: 120000};
  assert.ok(matchProperty(pref, rental)?.reasons.some(reason => reason.includes("multiplied by 12")));
  assert.equal(matchProperty({...pref, budgetMax: 119999}, rental), null);
  assert.equal(matchProperty(pref, {...rental, propertyListings_on_property: [{...rental.propertyListings_on_property[0], rentalPeriod: null}]}), null);
});
test("bedroom preferences handle studio and minimums without guessing unknown text", () => {
  assert.deepEqual(bedroomRule("Studio"), {minimum: 0, exact: true});
  assert.deepEqual(bedroomRule("3+ bedrooms"), {minimum: 3, exact: false});
  assert.equal(bedroomRule("two or three"), "INVALID");
  assert.equal(matchProperty({...preferences, bedroomPreference: "two"}, property), null);
  assert.ok(matchProperty({...preferences, bedroomPreference: "1+"}, property));
});
test("primary project narrows suggestions and legacy leads can match without a relationship", () => {
  assert.ok(matchProperty({}, property));
  assert.equal(matchProperty({projectId: property.id}, property), null);
  assert.ok(matchProperty({projectId: property.id}, {...property, projectId: property.id.replaceAll("-", "")}));
});
test("relationship inputs reject authority injection, invalid references and invalid viewing times", () => {
  const leadId = property.id;
  assert.equal(leadPrimaryInterestSchema.safeParse({leadId, projectId: null, propertyId: null, organizationId: leadId}).success, false);
  assert.equal(leadPropertyInterestSchema.safeParse({leadId, propertyId: "bad", status: "SAVED"}).success, false);
  assert.equal(leadPropertyInterestSchema.safeParse({leadId, propertyId: leadId, status: "SAVED", role: "OWNER"}).success, false);
  for (const scheduledAt of ["tomorrow", new Date(Date.now() - 1000).toISOString(), new Date(Date.now() + 366 * 86400000).toISOString()]) assert.equal(leadPropertyViewingSchema.safeParse({leadId, propertyId: leadId, scheduledAt}).success, false);
  assert.equal(leadPropertyViewingSchema.safeParse({leadId, propertyId: leadId, scheduledAt: new Date(Date.now() + 86400000).toISOString(), assignedMembershipId: leadId}).success, true);
});
