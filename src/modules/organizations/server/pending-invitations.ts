import "server-only";

import { cache } from "react";
import { getMyPendingInvitations } from "@dataconnect/admin-generated";
import { executeWorkspaceOperation, requireSqlConnectRequest } from "@/lib/firebase/dataconnect";

/** Request-local only. No caller-provided email, UID, tenant or SDK options. */
export const getPendingCompanyInvitations = cache(async () => {
  const request = await requireSqlConnectRequest();
  return executeWorkspaceOperation(() => getMyPendingInvitations(request.dc, request.options));
});
