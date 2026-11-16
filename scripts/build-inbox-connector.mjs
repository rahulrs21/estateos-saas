import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Builds dataconnect/connector-messaging/inbox.gql and inbox-outbound.gql from their templates in scripts/sql-templates.
 * {{V}} is the inbox visibility rule, repeated in every operation so the
 * database enforces it (docs/INBOX_SECURITY.md#visibility). Edit the template,
 * then run `node scripts/build-inbox-connector.mjs` and `npm run sql:generate`.
 */
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const VISIBILITY = `{_or: [
      {organization: {memberships_on_organization: {exist: {userProfileUid: {eq_expr: "auth.uid"}, status: {eq: ACTIVE}, role: {in: [OWNER, ADMIN]}}}}},
      {assignedMembership: {userProfileUid: {eq_expr: "auth.uid"}, status: {eq: ACTIVE}}},
      {lead: {assignedMembership: {userProfileUid: {eq_expr: "auth.uid"}, status: {eq: ACTIVE}}}},
      {assignedMembershipId: {isNull: true}, organization: {memberships_on_organization: {exist: {userProfileUid: {eq_expr: "auth.uid"}, status: {eq: ACTIVE}, role: {eq: MANAGER}}}}}
    ]}`;
for (const name of ["inbox", "inbox-outbound"]) {
  const template = readFileSync(join(root, "scripts", "sql-templates", `${name}.gql.template`), "utf8");
  writeFileSync(join(root, "dataconnect", "connector-messaging", `${name}.gql`), template.replaceAll("{{V}}", VISIBILITY));
  console.log(`dataconnect/connector-messaging/${name}.gql written.`);
}
