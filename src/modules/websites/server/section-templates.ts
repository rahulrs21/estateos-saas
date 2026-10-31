import "server-only";

import { randomUUID } from "node:crypto";
import * as sql from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import type { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { validateInput } from "@/modules/organizations/server/validation";
import { libraryTemplate, parseLibrarySection } from "../library";
import { recordIdSchema, sectionTemplateSchema } from "../policy";

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;

/*
 * Saved sections (docs/AI_PAGE_BUILDER.md#saved-sections): a company library
 * of validated sections. CRM photos are removed on save because they belong
 * to a specific record; uploads, stock media and text are kept.
 */

export async function listSectionTemplates(context: Context) {
  const data = await executeWorkspaceOperation(() => sql.listWebsiteSectionTemplates(context.request.dc, {organizationId: context.organizationId}, context.request.options), "ListWebsiteSectionTemplates");
  const admin = context.membership.role === "OWNER" || context.membership.role === "ADMIN";
  return data.templates.flatMap(row => {
    const section = parseLibrarySection(row.sectionData);
    return section ? [{
      id: canonicalUuid(row.id), name: row.name, category: row.category, sectionType: section.type, section, updatedAt: row.updatedAt,
      createdBy: row.createdBy?.displayName ?? null, canManage: admin || row.createdByUid === context.request.user.uid,
    }] : [];
  });
}

export async function saveSectionTemplate(context: Context, raw: unknown) {
  const input = validateInput(sectionTemplateSchema, raw);
  const template = libraryTemplate(input.section);
  if (!template) throw new WorkspaceError("VALIDATION_ERROR", 400, "This section cannot be saved. Check it for errors and try again.");
  if (template.data.length > 60_000) throw new WorkspaceError("VALIDATION_ERROR", 400, "This section is too large to save. Remove some content and try again.");
  const id = randomUUID();
  await executeWorkspaceOperation(() => sql.createWebsiteSectionTemplate(context.request.dc, {
    organizationId: context.organizationId, id, name: input.name, category: input.category, sectionType: template.section.type, sectionData: template.data,
  }, context.request.options), "CreateWebsiteSectionTemplate");
  return listSectionTemplates(context);
}

export async function deleteSectionTemplate(context: Context, rawId: string) {
  const id = canonicalUuid(validateInput(recordIdSchema, rawId));
  await executeWorkspaceOperation(() => sql.deleteWebsiteSectionTemplate(context.request.dc, {organizationId: context.organizationId, id}, context.request.options), "DeleteWebsiteSectionTemplate");
}
