# Property inventory and listings

Phase 5C adds company property inventory, separate marketing listing records, private media, project floor-plan uploads and project payment plans. The server derives organization, role and membership from the verified Firebase session. It uses SQL Connect and the generated Admin SDK with verified-user impersonation; there is no second database or browser-side database client.

## Records and workflows

- A property is a physical company inventory record with an organization-unique reference. Standalone secondary inventory is supported; project and building links must belong to the same organization.
- A listing is a separate sale/rental marketing record created from an existing property. Its reference is unique within the organization. `ACTIVE` is an internal workflow status; this module does not publish ads to property portals.
- Listing status changes use workflow actions (`POST /api/inventory/listings/{id}/status`, stored operation `SetPropertyListingStatus`). The steps are Submit for review, Approve, Activate, Pause/Resume, Close and Archive. Agents may only submit or withdraw their own listings; every other step is OWNER/ADMIN. Each step is a compare-and-set on the expected status and records `{from, to}` in the activity and audit log, shown as the listing's status history. The edit form no longer changes the status of an existing listing.
- `/listings` has a per-status summary bar, server-side sorting (recently updated, newest, price up/down), table, cards and map views, cover photos (property photos; for agents only when the property is also assigned to them) and a Map link per row (`?view=map&focus=<id>`). Listing pages show the property's photos, key facts (price per area, beds, baths, size, availability), the location map following the property's display mode, the advertising permit with an expiry warning, and the status history.
- Property inventory status changes follow a compare-and-set transition map in the server and SQL Connect transaction. Stale or invalid transitions fail without overwriting the latest status.
- Project floor plans can be linked to an optional building and property. Payment plans can be linked to a project and an optional property in that project. Plans remain inactive until booking, installment and handover amounts total exactly 100%.
- Company amenities are selected from configured company records. Additional property features are stored as typed feature rows. If the property is saved but a related amenity/feature write fails, the UI reports partial completion and retains the successful property record.

## Private media

The upload API accepts JPEG, PNG, WebP and PDF files up to 20 MiB each. It checks MIME and file signatures, then creates a random server-generated path under `organizations/{trustedOrganizationId}/{parentType}/{authorizedParentId}/{randomId}.{extension}`. The original filename is metadata only and never determines the Storage path. A file category is required; image property photos can be selected as a cover, while PDFs remain attachments.

`InventoryMedia` metadata is stored in SQL Connect and the bytes are stored in Firebase Storage. Browser SDK access is denied by `storage.rules`. Authenticated Node.js routes enforce origin/CSRF, session, active organization membership and parent/role authorization before writing, reading or deleting. Content responses use `private, no-store`, `nosniff`, a restrictive content security policy, and PDFs download as attachments. Project/floor-plan private files are administrator-only until an agent scope exists. Storage download URLs are not exposed.

Upload metadata starts `PENDING`, then becomes `ACTIVE` after the blob is written. A failed write attempts to remove the blob and mark the metadata `DELETED`. Deletion first changes `ACTIVE` to `DELETING`, removes the blob idempotently, then marks `DELETED`; retry can resume a `DELETING` row. There is no periodic cleanup job yet, so an abandoned PENDING/DELETING row requires operational review.

Set `FIREBASE_STORAGE_BUCKET` to the bucket name only (no `gs://`) for hosted use. Do not add it with a `NEXT_PUBLIC_` prefix. The local `npm run dev:local` runner sets a demo bucket and starts the Storage emulator; uploads use that emulator when `FIREBASE_STORAGE_EMULATOR_HOST` is configured. The rules deliberately deny direct client uploads in both environments.

## Roles and limitations

OWNER and ADMIN manage company inventory, listings, files and payment plans. MANAGER requests are denied until a trusted branch/team scope exists. AGENT property access is limited to properties explicitly assigned to their active membership. An agent can draft or submit their own assigned listing, but cannot approve or activate it. Company-wide developer/project reference data remains available according to the existing catalog policy.

Permit number, expiry and verification URL are reference fields only. Entering them does not verify a permit, indicate regulator approval or publish the listing. External portal feeds, publishing, agent scope for project files, project-wide managed brochure/document uploads, recurring cleanup and support for formats beyond JPEG/PNG/WebP/PDF are not included.

## Local validation and rollout

Run `npm run sql:validate`, `npm run sql:generate`, `npm run test:inventory`, `npm run test:dataconnect`, `npm run lint`, `npx tsc --noEmit` and `npm run build`. The Data Connect/Storage integration suite uses demo project IDs and separate local emulator ports; do not point it at hosted data. `npm run dev:local` starts Data Connect, Storage and Next.js for hands-on checks.

Before hosted use, review and apply the additive SQL migration and matching connector operations in one approved release. Deploy the `storage.rules` deny policy, configure the server-only bucket name and Firebase Admin identity, and verify bucket permissions before enabling uploads. No hosted schema change, deployment, paid infrastructure provisioning or production credential access occurred for this phase.

Manual checks: create a standalone property and a project-linked property, set features/amenities, upload and cover an image, upload and download a PDF as an authorized owner, retry a failed upload/delete, create/edit a listing from a property, and verify an agent can access only assigned property/listing records. Verify direct unauthenticated Storage reads/writes are denied and no listing appears on an external portal.
