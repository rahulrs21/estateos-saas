import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("/leads is the company list route and calls list data, not a single-lead lookup", () => {
  const routeAlias = source("src/app/(workspace)/leads/page.tsx");
  const listPage = source("src/app/(workspace)/workspace/leads/page.tsx");
  assert.match(routeAlias, /workspace\/leads\/page/);
  assert.match(listPage, /getLeadsPageData/);
  assert.doesNotMatch(listPage, /getLeadDetailData/);
  assert.match(listPage, /scope="list"/);
  const list = source("src/modules/leads/components/leads-list.tsx");
  assert.match(list, /<LeadEditorDialog data=\{data\} \/>/);
  assert.match(list, /Your next relationship starts here/);
});

test("lead detail failures only use the unavailable-record state on the detail route", () => {
  const detailPage = source("src/app/(workspace)/workspace/leads/[leadId]/page.tsx");
  const listPage = source("src/modules/leads/components/leads-access-state.tsx");
  assert.match(detailPage, /scope="detail"/);
  assert.match(listPage, /error\.status === 404 && scope === "detail"/);
  assert.match(listPage, /scope === "list"\s*\?\s*"We couldn't load your leads"/);
});

test("lead sorting selects a stored operation and is excluded from SQL variables", () => {
  const service = source("src/modules/leads/server/service.ts");
  const views = source("src/modules/leads/server/views.ts");
  assert.match(service, /createdTo,\s*sort,\s*\.\.\.pagination/);
  assert.match(service, /never forward it to the generated SDK/);
  assert.match(views, /leadListOperation\(filters\.sort\)/);
});

test("SQL Connect diagnostics render named safe fields in the Next.js error overlay", () => {
  const dataConnect = source("src/lib/firebase/dataconnect.ts");
  assert.match(dataConnect, /console\.error\(`EstateOS SQL Connect operation failed: operation=\$\{safeOperationName\} backend=\$\{backend\} code=\$\{diagnostic\.code\} cause=\$\{diagnostic\.failureClass\} hint=\$\{diagnostic\.failureHint\} http=/);
  assert.match(dataConnect, /getSafeDataConnectDiagnostics\(error\)/);
  assert.doesNotMatch(dataConnect, /console\.error\([^\n]*,\s*\{/);
});

test("Contacts routes use persisted SQL Connect views and expose create/edit controls through guarded APIs", () => {
  const contactsPage = source("src/app/(workspace)/contacts/page.tsx");
  const detailPage = source("src/app/(workspace)/contacts/[contactId]/page.tsx");
  const form = source("src/modules/contacts/components/contact-editor-dialog.tsx");
  const service = source("src/modules/leads/server/crm-service.ts");
  const connector = source("dataconnect/connector/mutations.gql");
  assert.match(contactsPage, /getContactsPageData/);
  assert.match(detailPage, /getContactPageData/);
  assert.doesNotMatch(contactsPage, /ModulePreview/);
  assert.match(form, /leadRequest/);
  assert.match(form, /createContactSchema/);
  assert.match(form, /updateContactSchema/);
  assert.match(service, /export async function createContact[\s\S]*?assertOrganizationAdministrator/);
  assert.match(connector, /mutation CreateContact[\s\S]*?role: \{ in: \[OWNER, ADMIN\] \}/);
});
