import assert from "node:assert/strict";
import { test } from "node:test";
import {
  developerInputSchema, projectInputSchema, buildingInputSchema, propertyInputSchema,
  listingInputSchema, paymentPlanCreateSchema, featureInputSchema, inventoryPageSchema,
  inventoryMediaUploadSchema, propertyFeatureLabelsSchema, buildPropertyListOperationInput,
  allowedListingTransitions, buildListingListOperationInput, listingStatusInputSchema, parseListingSort, parseListingView,
} from "../src/modules/inventory/validation";
import {getSafeDataConnectDiagnostics, mapWorkspaceDataError, mapWorkspaceOperationError} from "../src/modules/organizations/server/errors";
import {omitNullishQueryVariables} from "../src/modules/inventory/server/query-variables";

const id = "10000000-0000-4000-8000-000000000001";

test("inventory inputs normalize slugs and reject caller-supplied tenant or role authority", () => {
  assert.equal(developerInputSchema.parse({ name: "Acme Developers", slug: " Acme-Dubai ", country: "AE" }).slug, "acme-dubai");
  assert.equal(developerInputSchema.safeParse({ name: "Acme Developers", slug: "acme", organizationId: id }).success, false);
  assert.equal(projectInputSchema.safeParse({
    developerId: id, projectName: "A project", projectCode: "A-01", projectType: "RESIDENTIAL", currency: "AED", role: "OWNER",
  }).success, false);
});

test("properties allow standalone assets but require a project when a building is selected", () => {
  const standalone = propertyInputSchema.parse({
    propertyReference: "SECONDARY-1", propertyType: "VILLA", areaUnit: "SQM", occupancyStatus: "VACANT", inventoryStatus: "AVAILABLE",
  });
  assert.equal(standalone.projectId, undefined);
  assert.equal(propertyInputSchema.safeParse({
    propertyReference: "ONE-COORD", propertyType: "APARTMENT", latitude: 25.2, areaUnit: "SQFT",
    occupancyStatus: "VACANT", inventoryStatus: "AVAILABLE",
  }).success, false);
  assert.equal(propertyInputSchema.safeParse({
    propertyReference: "BROKEN-1", propertyType: "APARTMENT", buildingId: id, areaUnit: "SQFT",
    occupancyStatus: "VACANT", inventoryStatus: "DRAFT",
  }).success, false);
  for (const value of [-1, Number.POSITIVE_INFINITY, Number.NaN]) {
    assert.equal(propertyInputSchema.safeParse({
      propertyReference: "INVALID-AREA", propertyType: "APARTMENT", builtUpArea: value, areaUnit: "SQFT",
      occupancyStatus: "VACANT", inventoryStatus: "DRAFT",
    }).success, false);
  }
});

test("money remains an integer minor-unit string and currency is an ISO-style code", () => {
  const valid = projectInputSchema.parse({
    developerId: id, projectName: "Valid project", projectCode: "VALID-1", projectType: "RESIDENTIAL",
    startingPriceMinor: "123456789012345678", currency: "AED",
  });
  assert.equal(valid.startingPriceMinor, "123456789012345678");
  for (const startingPriceMinor of ["-1", "1.25", "1e4", "1234567890123456789"]) {
    assert.equal(projectInputSchema.safeParse({
      developerId: id, projectName: "Invalid project", projectCode: "INVALID-1", projectType: "RESIDENTIAL",
      startingPriceMinor, currency: "AED",
    }).success, false);
  }
  assert.equal(projectInputSchema.safeParse({
    developerId: id, projectName: "Invalid currency", projectCode: "INVALID-2", projectType: "RESIDENTIAL", currency: "aed",
  }).success, false);
  assert.equal(projectInputSchema.safeParse({
    developerId: id, projectName: "Invalid brochure", projectCode: "INVALID-3", projectType: "RESIDENTIAL", currency: "AED", brochureReference: "javascript:alert(1)",
  }).success, false);
  assert.equal(projectInputSchema.parse({
    developerId: id, projectName: "Valid brochure", projectCode: "VALID-3", projectType: "RESIDENTIAL", currency: "AED", brochureReference: "https://example.test/brochure.pdf",
  }).brochureReference, "https://example.test/brochure.pdf");
});

test("listing and payment plan rules reject invalid rental and percentage totals", () => {
  assert.equal(listingInputSchema.safeParse({
    propertyId: id, listingReference: "RENT-1", listingPurpose: "RENT", marketType: "SECONDARY", title: "Home for rent",
    askingPriceMinor: "100000", currency: "AED",
  }).success, false);
  const base = { projectId: id, name: "Plan", bookingPercentageBps: 1000, handoverPercentageBps: 2000 };
  const installment = { position: 0, percentageBps: 7000, dueTrigger: "HANDOVER" as const };
  assert.equal(paymentPlanCreateSchema.safeParse({ ...base, installments: [installment] }).success, true);
  assert.equal(paymentPlanCreateSchema.safeParse({ ...base, installments: [{ ...installment, percentageBps: 6999 }] }).success, false);
  assert.equal(listingInputSchema.safeParse({
    propertyId: id, listingReference: "SALE-1", listingPurpose: "SALE", marketType: "SECONDARY", title: "Sale listing",
    askingPriceMinor: "0", currency: "AED", listingStatus: "APPROVED", publicationStatus: "READY",
  }).success, true);
  assert.equal(listingInputSchema.safeParse({
    propertyId: id, listingReference: "SALE-2", listingPurpose: "SALE", marketType: "SECONDARY", title: "Sale listing",
    askingPriceMinor: "1000", currency: "AED", publicationStatus: "PUBLISHED",
  }).success, false);
});

test("inventory media enforces size, media kind and parent compatibility", () => {
  const base = {parentType: "properties", parentId: id, fileName: "front.jpg", contentType: "image/jpeg", byteSize: 1024, mediaKind: "PROPERTY_PHOTO"};
  assert.equal(inventoryMediaUploadSchema.safeParse(base).success, true);
  assert.equal(inventoryMediaUploadSchema.safeParse({...base, mediaKind: "DOCUMENT"}).success, false);
  assert.equal(inventoryMediaUploadSchema.safeParse({...base, contentType: "application/pdf", mediaKind: "DOCUMENT"}).success, true);
  assert.equal(inventoryMediaUploadSchema.safeParse({...base, byteSize: 20 * 1024 * 1024 + 1}).success, false);
  assert.equal(inventoryMediaUploadSchema.safeParse({...base, parentType: "projects", mediaKind: "PROPERTY_PHOTO"}).success, false);
});

test("structured property features require exactly one value of the declared type", () => {
  assert.equal(featureInputSchema.safeParse({ propertyId: id, key: "pool", valueType: "BOOLEAN", booleanValue: true }).success, true);
  assert.equal(featureInputSchema.safeParse({ propertyId: id, key: "pool", valueType: "BOOLEAN", booleanValue: true, textValue: "yes" }).success, false);
  assert.equal(featureInputSchema.safeParse({ propertyId: id, key: "size", valueType: "NUMBER", numberValue: "4" }).success, false);
});

test("property amenity feature labels are bounded before creating related records", () => {
  assert.deepEqual(propertyFeatureLabelsSchema.parse(["Balcony", "Built-in wardrobes"]), ["Balcony", "Built-in wardrobes"]);
  assert.equal(propertyFeatureLabelsSchema.safeParse(["A"]).success, false);
  assert.equal(propertyFeatureLabelsSchema.safeParse(Array.from({length: 31}, (_, index) => `Feature ${index + 1}`)).success, false);
});

test("inventory search and pagination remain bounded", () => {
  assert.equal(inventoryPageSchema.safeParse({ limit: 100, offset: 10000, search: "Marina" }).success, true);
  assert.equal(inventoryPageSchema.safeParse({ limit: 101, offset: 0 }).success, false);
  assert.equal(inventoryPageSchema.safeParse({ limit: 25, offset: 10001 }).success, false);
  assert.equal(inventoryPageSchema.safeParse({ limit: 25, offset: 0, organizationId: id }).success, false);
});

test("property list UI filters are translated to strict SQL Connect inputs", () => {
  const fromUi = {
    page: 2, minimumPrice: "1000.50", maximumPrice: "2500", projectId: id, bedrooms: "2",
  };
  // This is the regression: page and display-price fields cannot be passed
  // directly to inventoryPageSchema, which deliberately rejects unknown keys.
  assert.equal(inventoryPageSchema.safeParse({...fromUi, limit: 25, offset: 25}).success, false);

  const operationInput = buildPropertyListOperationInput(fromUi);
  assert.equal("page" in operationInput, false);
  assert.equal("minimumPrice" in operationInput, false);
  assert.equal("maximumPrice" in operationInput, false);
  assert.equal(operationInput.minimumPriceMinor, "100050");
  assert.equal(operationInput.maximumPriceMinor, "250000");
  assert.equal(inventoryPageSchema.safeParse(operationInput).success, true);
});

test("unset inventory query filters are omitted instead of sent as SQL Connect null variables", () => {
  assert.deepEqual(omitNullishQueryVariables({
    organizationId: id, limit: 25, offset: 0, search: undefined, marketType: null, bedrooms: 0,
  }), {organizationId: id, limit: 25, offset: 0, bedrooms: 0});
});

test("buildings cannot claim a phase without a project", () => {
  assert.equal(buildingInputSchema.safeParse({
    phaseId: id, name: "Tower", buildingType: "RESIDENTIAL", status: "PLANNED",
  }).success, false);
});

test("inventory conflict errors stay actionable without exposing provider details", () => {
  const archiveConflict = mapWorkspaceDataError({code: "data-connect/query-error", message: "DEVELOPER_HAS_ACTIVE_PROJECTS private SQL detail"});
  assert.equal(archiveConflict.code, "CONFLICT");
  assert.equal(archiveConflict.status, 409);
  assert.match(archiveConflict.message, /active projects/i);
  assert.equal(archiveConflict.message.includes("private SQL detail"), false);
  assert.equal(mapWorkspaceDataError({code: "data-connect/already-exists", message: "private unique constraint"}).status, 409);
});

test("hosted inventory schema rollout is identified only from a provider schema error", () => {
  const queryError = {code: "data-connect/query-error", message: "Cannot query field 'developers' on type 'Query'."};
  const rollout = mapWorkspaceOperationError(queryError, "ListDevelopers", false);
  assert.equal(rollout.code, "SQL_CONNECT_ROLLOUT_REQUIRED");
  assert.equal(rollout.status, 503);
  assert.match(rollout.message, /SQL Connect service.*schema or query update/i);
  assert.equal(mapWorkspaceOperationError(queryError, "ListProjects", false).code, "SQL_CONNECT_ROLLOUT_REQUIRED");
  assert.equal(mapWorkspaceOperationError(queryError, "ListPropertiesAdvanced", false).code, "SQL_CONNECT_ROLLOUT_REQUIRED");
  assert.equal(mapWorkspaceOperationError(queryError, "ListDevelopers", true).code, "DATABASE_ERROR");
  assert.equal(mapWorkspaceOperationError({code: "data-connect/query-error", message: "internal provider query details"}, "ListDevelopers", false).code, "DATABASE_ERROR");
  assert.equal(mapWorkspaceOperationError({code: "data-connect/query-error", message: "@check denied"}, "ListDevelopers", false).code, "PERMISSION_DENIED");
});

test("development SQL Connect diagnostics classify failures without logging messages, IDs, or file paths", () => {
  const diagnostic = getSafeDataConnectDiagnostics({
    code: "data-connect/query-error",
    message: "Cannot query field 'developers' on type 'Query' for owner@example.test with token secret-value",
    stack: "Error: private provider detail\n    at executeList (C:\\Users\\Rifam\\Desktop\\estateos\\service.js:28:4)",
  });
  assert.deepEqual(diagnostic, {
    code: "data-connect/query-error",
    failureClass: "schema-or-operation-mismatch",
    failureHint: "graphql-field-not-found:developers:Query",
    httpStatus: null,
    stackFrames: ["executeList (service.js:28)"],
  });
  assert.equal(JSON.stringify(diagnostic).includes("owner@example.test"), false);
  assert.equal(JSON.stringify(diagnostic).includes("secret-value"), false);
  assert.equal(JSON.stringify(diagnostic).includes("C:\\\\Users"), false);
});

test("SQL Connect diagnostics expose only allowlisted provider hints and schema identifiers", () => {
  const missingRelation = getSafeDataConnectDiagnostics({
    code: "data-connect/query-error",
    message: "ERROR: relation 'Developer' does not exist for owner@example.test; token=secret-value",
    httpResponse: {status: 200, data: {errors: [{message: "ERROR: relation 'Developer' does not exist"}] }},
  });
  assert.equal(missingRelation.failureHint, "postgres-relation-not-found:developer");
  assert.equal(missingRelation.httpStatus, 200);
  assert.equal(JSON.stringify(missingRelation).includes("owner@example.test"), false);
  assert.equal(JSON.stringify(missingRelation).includes("secret-value"), false);

  const unknownProviderError = getSafeDataConnectDiagnostics({
    code: "data-connect/query-error",
    message: "A provider message with account-specific information",
  });
  assert.equal(unknownProviderError.failureHint, "unclassified-query-error");
  assert.equal(JSON.stringify(unknownProviderError).includes("account-specific"), false);
});

test("listing workflow offers only permitted next steps for each role", () => {
  assert.deepEqual(allowedListingTransitions("DRAFT", "OWNER", false), ["PENDING_REVIEW", "ARCHIVED"]);
  assert.deepEqual(allowedListingTransitions("PENDING_REVIEW", "ADMIN", false), ["DRAFT", "APPROVED", "PAUSED", "ARCHIVED"]);
  assert.deepEqual(allowedListingTransitions("PAUSED", "OWNER", false), ["ACTIVE", "CLOSED", "ARCHIVED"]);
  assert.deepEqual(allowedListingTransitions("ARCHIVED", "OWNER", false), []);
  assert.deepEqual(allowedListingTransitions("DRAFT", "AGENT", true), ["PENDING_REVIEW"], "agents submit their own drafts");
  assert.deepEqual(allowedListingTransitions("PENDING_REVIEW", "AGENT", true), ["DRAFT"], "agents cannot approve");
  assert.deepEqual(allowedListingTransitions("APPROVED", "AGENT", true), []);
  assert.deepEqual(allowedListingTransitions("DRAFT", "AGENT", false), [], "agents cannot move other agents' listings");
  assert.deepEqual(allowedListingTransitions("DRAFT", "MANAGER", false), []);
  assert.equal(listingStatusInputSchema.safeParse({expectedStatus: "ACTIVE", status: "PAUSED"}).success, true);
  assert.equal(listingStatusInputSchema.safeParse({expectedStatus: "ACTIVE", status: "SOLD"}).success, false, "legacy statuses cannot be chosen");
  assert.equal(listingStatusInputSchema.safeParse({expectedStatus: "ACTIVE", status: "PAUSED", organizationId: id}).success, false);
});

test("listing view and sort parameters fall back to safe defaults", () => {
  assert.equal(parseListingView("cards"), "cards");
  assert.equal(parseListingView("map"), "map");
  assert.equal(parseListingView("grid"), "table");
  assert.equal(parseListingSort("PRICE_ASC"), "PRICE_ASC");
  assert.equal(parseListingSort("price"), "UPDATED_DESC");
  assert.equal(buildListingListOperationInput({page: 1, sort: "PRICE_DESC"}).sort, "PRICE_DESC");
  assert.equal(buildListingListOperationInput({page: 1, sort: "UPDATED_DESC"}).sort, undefined, "the default sort is not sent");
  assert.equal(inventoryPageSchema.safeParse({limit: 25, offset: 0, sort: "PRICE_ASC"}).success, true);
  assert.equal(inventoryPageSchema.safeParse({limit: 25, offset: 0, sort: "RANDOM"}).success, false);
});
