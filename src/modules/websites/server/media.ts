import "server-only";

import { randomUUID } from "node:crypto";
import * as sql from "@dataconnect/admin-generated";
import { getFirebaseAdminStorageBucket } from "@/lib/firebase/admin";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import type { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { validateInput } from "@/modules/organizations/server/validation";
import { websiteMediaPath } from "../linked";
import { UPLOAD_TYPES, imageDimensions, matchesImageSignature, type UploadType } from "../uploads";
import { mediaAltSchema, recordIdSchema } from "../policy";
import { serverDataConnect, serverOperation } from "./public";

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;

/*
 * The website media library (docs/AI_PAGE_BUILDER.md#uploads). Images are
 * checked by content signature, stored privately under the company's
 * Storage prefix and served to editors through an authenticated route.
 * Public pages serve only the uploads a live publication lists.
 */

export const websiteMediaUrl = websiteMediaPath;

async function uploadAccess(context: Context) {
  const data = await executeWorkspaceOperation(() => sql.getWebsiteMediaAccess(context.request.dc, {organizationId: context.organizationId}, context.request.options), "GetWebsiteMediaAccess");
  const role = data.member?.role;
  if (!data.website) throw new WorkspaceError("CONFLICT", 409, "Open Websites once to set up the company website, then upload images.");
  const allowed = role === "OWNER" || role === "ADMIN" || role === "MANAGER" || (role === "AGENT" && data.website.allowAgentDrafts);
  if (!allowed) throw new WorkspaceError("PERMISSION_DENIED", 403, "Your role cannot upload website images.");
  return {websiteId: canonicalUuid(data.website.id)};
}

export async function storeUpload(context: Context, input: {bytes: Buffer; contentType: UploadType; fileName: string}) {
  const {websiteId} = await uploadAccess(context);
  if (!matchesImageSignature(input.bytes, input.contentType)) throw new WorkspaceError("VALIDATION_ERROR", 415, "The file contents do not match its type. Upload a JPEG, PNG or WebP image.");
  const size = imageDimensions(input.bytes, input.contentType);
  const id = randomUUID();
  // Built here, never taken from the request.
  const storagePath = `organizations/${context.organizationId}/websites/media/${id}.${UPLOAD_TYPES[input.contentType]}`;
  const actorUid = context.request.user.uid;
  const dc = serverDataConnect();
  await serverOperation(() => sql.createWebsiteMedia(dc, {
    organizationId: context.organizationId, id, websiteId, fileName: input.fileName, contentType: input.contentType, byteSize: input.bytes.byteLength,
    width: size?.width ?? null, height: size?.height ?? null, alt: "", storagePath, actorUid,
  }));
  const file = getFirebaseAdminStorageBucket().file(storagePath);
  try {
    await file.save(input.bytes, {resumable: false, metadata: {contentType: input.contentType, cacheControl: "private, no-store", metadata: {estateosWebsiteMediaId: id}}});
    await serverOperation(() => sql.setWebsiteMediaUploadStatus(dc, {organizationId: context.organizationId, id, status: sql.WebsiteMediaStatus.ACTIVE, actorUid}));
  } catch (error) {
    try { await file.delete({ignoreNotFound: true}); } catch { /* the PENDING row marks it for cleanup */ }
    try { await serverOperation(() => sql.setWebsiteMediaUploadStatus(dc, {organizationId: context.organizationId, id, status: sql.WebsiteMediaStatus.DELETED, actorUid})); } catch { /* keep the original failure */ }
    throw error;
  }
  return {id, fileName: input.fileName, contentType: input.contentType, width: size?.width ?? null, height: size?.height ?? null, alt: "", url: websiteMediaUrl(id)};
}

export async function listMedia(context: Context, offset = 0) {
  const data = await executeWorkspaceOperation(() => sql.listWebsiteMedia(context.request.dc, {organizationId: context.organizationId, limit: 60, offset}, context.request.options), "ListWebsiteMedia");
  const admin = context.membership.role === "OWNER" || context.membership.role === "ADMIN";
  return {
    total: data.total.length,
    items: data.media.map(row => ({
      id: canonicalUuid(row.id), fileName: row.fileName, contentType: row.contentType, byteSize: row.byteSize, width: row.width ?? null, height: row.height ?? null,
      alt: row.alt, createdAt: row.createdAt, createdBy: row.createdBy?.displayName ?? null, url: websiteMediaUrl(row.id),
      canManage: admin || row.createdByUid === context.request.user.uid,
    })),
  };
}

/** Active and archived uploads of the company among the given IDs. */
export async function mediaByIds(context: Context, ids: string[]) {
  if (!ids.length) return [];
  const data = await executeWorkspaceOperation(() => sql.getWebsiteMediaByIds(context.request.dc, {organizationId: context.organizationId, ids: ids.slice(0, 60).map(canonicalUuid)}, context.request.options), "GetWebsiteMediaByIds");
  return data.media.map(row => ({...row, id: canonicalUuid(row.id)}));
}

export async function mediaContent(context: Context, rawId: string) {
  const id = canonicalUuid(validateInput(recordIdSchema, rawId));
  const [row] = await mediaByIds(context, [id]);
  if (!row) throw new WorkspaceError("NOT_FOUND", 404, "This image was not found.");
  return row;
}

export async function updateMediaAlt(context: Context, rawId: string, raw: unknown) {
  const id = canonicalUuid(validateInput(recordIdSchema, rawId));
  const {alt} = validateInput(mediaAltSchema, raw);
  await executeWorkspaceOperation(() => sql.updateWebsiteMediaAlt(context.request.dc, {organizationId: context.organizationId, id, alt}, context.request.options), "UpdateWebsiteMediaAlt");
}

export async function archiveMedia(context: Context, rawId: string) {
  const id = canonicalUuid(validateInput(recordIdSchema, rawId));
  await executeWorkspaceOperation(() => sql.archiveWebsiteMedia(context.request.dc, {organizationId: context.organizationId, id}, context.request.options), "ArchiveWebsiteMedia");
}
