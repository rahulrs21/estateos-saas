import "server-only";

import * as sdk from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { validateInput } from "@/modules/organizations/server/validation";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { searchContactsSchema, contactIdSchema } from "@/modules/leads/crm-validation";
import { escapeLeadSearch } from "@/modules/leads/validation";
import type { ContactRecord, ContactsPageData } from "../types";

const pageSize = 25;
const pageInput = (params: Record<string, string | string[] | undefined>) => {
  for (const key of ["search", "page"]) {
    if (Array.isArray(params[key])) throw new WorkspaceError("VALIDATION_ERROR", 400, "Use one search term and page number.");
  }
  const search = typeof params.search === "string" ? params.search : "";
  const rawPage = typeof params.page === "string" && /^\d{1,3}$/.test(params.page) ? Number(params.page) : 1;
  if (!Number.isInteger(rawPage) || rawPage < 1 || rawPage > 401) {
    throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose a valid contacts page.");
  }
  return validateInput(searchContactsSchema, { search, limit: pageSize, offset: (rawPage - 1) * pageSize });
};

export async function getContactsPageData(params: Record<string, string | string[] | undefined> = {}): Promise<ContactsPageData> {
  const context = await requireActiveOrganizationRequest();
  const input = pageInput(params);
  const result = await executeWorkspaceOperation(
    () => sdk.searchContacts(context.request.dc, {
      organizationId: context.organizationId,
      search: escapeLeadSearch(input.search),
      limit: input.limit,
      offset: input.offset,
    }, context.request.options),
    "SearchContacts",
  );
  const total = result.total[0]?.count ?? 0;
  return {
    organization: { id: canonicalUuid(context.organizationId), name: context.organization.name },
    role: context.membership.role as ContactsPageData["role"],
    contacts: result.contacts.map(contact => ({
      ...contact,
      id: canonicalUuid(contact.id),
      organizationId: canonicalUuid(contact.organizationId),
    })),
    search: input.search,
    page: Math.floor(input.offset / pageSize) + 1,
    pageSize,
    total,
    hasNext: input.offset + input.limit < total,
  };
}

export async function getContactPageData(id: string): Promise<{ organization: ContactsPageData["organization"]; role: ContactsPageData["role"]; contact: ContactRecord }> {
  const context = await requireActiveOrganizationRequest();
  const { contactId } = validateInput(contactIdSchema, { contactId: id });
  const result = await executeWorkspaceOperation(
    () => sdk.getContact(context.request.dc, { organizationId: context.organizationId, contactId }, context.request.options),
    "GetContact",
  );
  if (!result.contact) throw new WorkspaceError("NOT_FOUND", 404, "This contact is unavailable.");
  return {
    organization: { id: canonicalUuid(context.organizationId), name: context.organization.name },
    role: context.membership.role as ContactsPageData["role"],
    contact: { ...result.contact, id: canonicalUuid(result.contact.id), organizationId: canonicalUuid(result.contact.organizationId) },
  };
}
