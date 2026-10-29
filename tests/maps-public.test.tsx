import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "react-dom/server";
import { approximateCoordinates } from "../src/modules/maps/geo";
import { isPublicListing, toPublicListingPins, toPublicProjectMap, type PublicListingSource } from "../src/modules/maps/public";
import { PublicListingMap, PublicProjectMap } from "../src/modules/maps/components/public-maps";

const today = "2026-10-27";
const exact = {latitude: 25.080512, longitude: 55.140231};
const approximate = {latitude: 25.071234, longitude: 55.132345};
const hidden = {latitude: 25.093456, longitude: 55.151234};

function listing(id: string, mode: string, point: {latitude: number; longitude: number}, extra: Partial<PublicListingSource> = {}): PublicListingSource {
  return {
    id, title: `Listing ${id}`, listingPurpose: "SALE", listingStatus: "ACTIVE", publicationStatus: "PUBLISHED",
    askingPriceMinor: "250000000", currency: "AED", advertisingPermitNumber: "7112345678", permitExpiryDate: "2027-01-01",
    ...extra,
    property: {
      propertyType: "APARTMENT", bedrooms: 2, bathrooms: 2, builtUpArea: 1200, areaUnit: "SQFT", emirate: "DUBAI", city: "Dubai",
      community: "Dubai Marina", area: "Marina Gate", ...point, googlePlaceId: "ChIJ_secret_place", mapDisplayMode: mode, archivedAt: null,
      ...extra.property,
    },
  };
}

// Internal fields a CRM row may carry that must never reach a public page.
const internal = {address: "Marina Gate 1, Unit 2304", unitNumber: "2304", propertyReference: "INT-REF-9", ownerName: "Private Owner", assignedMembershipId: "m-1", internalNotes: "Motivated seller"};
const sources = [
  listing("exact", "EXACT", exact),
  listing("approximate", "APPROXIMATE", approximate),
  listing("hidden", "HIDDEN", hidden),
  listing("draft", "EXACT", exact, {publicationStatus: "NOT_PUBLISHED"}),
  listing("paused", "EXACT", exact, {listingStatus: "PAUSED"}),
  listing("no-permit", "EXACT", exact, {advertisingPermitNumber: " "}),
  listing("expired-permit", "EXACT", exact, {permitExpiryDate: "2026-10-26"}),
  listing("archived", "EXACT", exact, {archivedAt: "2026-10-01T00:00:00Z"}),
].map(source => ({...source, property: {...source.property, ...internal}}));

test("only explicitly published, active, permitted listings are public", () => {
  const pins = toPublicListingPins(sources, id => `/listings/${id}`, today);
  assert.deepEqual(pins.map(pin => pin.id), ["exact", "approximate", "hidden"]);
  assert.equal(isPublicListing({...sources[0], property: {...sources[0].property, archivedAt: "2026-10-01T00:00:00Z"}}, today), false, "archived property");
  assert.equal(pins[0].href, "/listings/exact");
});

test("public pins follow the display mode and never carry exact hidden or approximate points", () => {
  const [exactPin, approximatePin, hiddenPin] = toPublicListingPins(sources, undefined, today);
  assert.equal(exactPin.location.precision, "EXACT");
  assert.equal(exactPin.location.latitude, exact.latitude);
  assert.equal(exactPin.location.placeId, "ChIJ_secret_place", "EXACT pins keep the approved place ID");
  assert.deepEqual({latitude: approximatePin.location.latitude, longitude: approximatePin.location.longitude}, approximateCoordinates(approximate.latitude, approximate.longitude));
  assert.equal(approximatePin.location.placeId, null);
  assert.equal(hiddenPin.location.precision, "NONE");
  assert.equal(hiddenPin.location.latitude, null);
  assert.equal(hiddenPin.locationText, "Dubai Marina, Dubai", "hidden listings keep only community and emirate text");

  const serialized = JSON.stringify([approximatePin, hiddenPin]);
  for (const secret of [String(approximate.latitude), String(approximate.longitude), String(hidden.latitude), String(hidden.longitude), "ChIJ_secret_place"]) {
    assert.ok(!serialized.includes(secret), `serialized props leak ${secret}`);
  }
  const everything = JSON.stringify(toPublicListingPins(sources, undefined, today));
  for (const value of Object.values(internal)) assert.ok(!everything.includes(value), `internal field leaked: ${value}`);
  assert.ok(!everything.includes("Marina Gate"), "area/sub-community and addresses are not public");
});

test("rendered public listing HTML contains no hidden or approximate exact coordinates", () => {
  const pins = toPublicListingPins(sources, undefined, today);
  const html = renderToString(<PublicListingMap listings={pins} />);
  assert.match(html, /3 properties/);
  assert.equal(html.match(/Permit 7112345678/g)?.length, 3, "every public listing shows its advertising permit");
  for (const secret of [String(approximate.latitude), String(approximate.longitude), String(hidden.latitude), String(hidden.longitude), "2304", "INT-REF-9"]) {
    assert.ok(!html.includes(secret), `HTML leaks ${secret}`);
  }
  assert.match(renderToString(<PublicListingMap listings={[]} />), /No properties are available right now/);
});

test("public project maps show buildings only for exact project locations", () => {
  const project = {
    id: "p1", projectName: "Marina Heights", projectStatus: "ACTIVE", developer: {name: "Example Developments"}, emirate: "DUBAI", community: "Dubai Marina",
    ...approximate, googlePlaceId: "ChIJ_secret_project", startingPriceMinor: "150000000", currency: "AED",
    buildings: [{id: "b1", name: "Tower A", latitude: 25.0711, longitude: 55.1322}],
  };
  const approximateProject = toPublicProjectMap({...project, mapDisplayMode: "APPROXIMATE"})!;
  assert.equal(approximateProject.location.precision, "APPROXIMATE");
  assert.deepEqual(approximateProject.buildings, [], "buildings would reveal an approximate project's position");
  const html = renderToString(<PublicProjectMap project={approximateProject} />);
  for (const secret of [String(approximate.latitude), "25.0711", "ChIJ_secret_project", "Tower A"]) assert.ok(!html.includes(secret) && !JSON.stringify(approximateProject).includes(secret), secret);

  const exactProject = toPublicProjectMap({...project, mapDisplayMode: "EXACT"})!;
  assert.equal(exactProject.buildings.length, 1);
  assert.equal(exactProject.buildings[0].location.placeId, null);
  const hiddenProject = toPublicProjectMap({...project, mapDisplayMode: "HIDDEN"})!;
  assert.equal(hiddenProject.location.latitude, null);
  assert.ok(!JSON.stringify(hiddenProject).includes(String(approximate.latitude)));
  assert.equal(toPublicProjectMap({...project, projectStatus: "DRAFT", mapDisplayMode: "EXACT"}), null, "draft projects are not public");
  assert.equal(toPublicProjectMap({...project, archivedAt: "2026-01-01T00:00:00Z", mapDisplayMode: "EXACT"}), null);
});
