import { leadListInputSchema } from "../validation";
import { WorkspaceError } from "../../organizations/server/errors";

/** URL pagination maps to the same bounded server-side query as internal reads. */
export function parseLeadApiQuery(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new WorkspaceError("VALIDATION_ERROR", 400, "Provide lead filters.");
  const values = {...input} as Record<string, unknown>;
  if ("page" in values || "pageSize" in values) {
    if ("limit" in values || "offset" in values) throw new WorkspaceError("VALIDATION_ERROR", 400, "Use page/pageSize or limit/offset, not both.");
    const page = Number(values.page ?? 1), pageSize = Number(values.pageSize ?? 25);
    if (!Number.isInteger(page) || page < 1 || ![10,25,50].includes(pageSize)) throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose a valid page and page size.");
    delete values.page; delete values.pageSize;
    values.limit = pageSize; values.offset = (page - 1) * pageSize;
  }
  for (const key of ["status", "branchId", "assignedMembershipId", "sourceId", "priority", "createdFrom", "createdTo"]) if (values[key] === "") delete values[key];
  for (const key of ["limit", "offset"]) if (typeof values[key] === "string") {
    if (!/^\d+$/.test(values[key])) throw new WorkspaceError("VALIDATION_ERROR", 400, "Use whole-number pagination values.");
    values[key] = Number(values[key]);
  }
  const result = leadListInputSchema.safeParse(values);
  if (!result.success) throw new WorkspaceError("VALIDATION_ERROR", 400, "Check the lead filters and pagination.");
  return result.data;
}
