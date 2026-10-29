# Hosted development database plan (for review — nothing executed)

Status: **proposal**. No Firebase project, billing setting, Cloud SQL instance, schema, connector or secret has been created or changed. Every step marked **Approval** needs your explicit go-ahead. Prices are approximate list prices gathered on 2026-10-26 and must be confirmed in the Google Cloud pricing calculator for the chosen region before approval.

## 1. What the repository already declares

| Item | Current value | Notes |
| --- | --- | --- |
| Firebase project alias | `.firebaserc` default `estateos-development-f8c93` | Also used by `.env.local` for hosted Firebase Authentication. |
| SQL Connect service | `dataconnect/dataconnect.yaml`: service `estateos`, location `us-east4`, Cloud SQL instance `estateos-fdc`, database `fdcdb`, `schemaValidation: COMPATIBLE` | Earlier hosted calls returned `data-connect/query-error` (`ListDevelopers`, `ListProjects`): the hosted schema/connectors are probably older than the code or not deployed. |
| Connector | `example` (all files in `dataconnect/connector/`) | Renaming is a breaking change; keep the ID. |
| Local development | Emulator database + hosted Authentication of the development project | Local `user_profile.uid` values are real development-project Auth UIDs. |

**Step 0 — read-only inspection (Approval: read-only cloud access).** Run with your own login and share the output; nothing changes:

```powershell
firebase projects:list
firebase dataconnect:services:list --project estateos-development-f8c93
gcloud sql instances list --project estateos-development-f8c93
gcloud billing projects describe estateos-development-f8c93
firebase dataconnect:sql:diff estateos --project estateos-development-f8c93
```

The diff shows exactly which SQL the hosted database needs to match the local schema (expected: Phase 4–5E additive tables, columns and enum values).

## 2. Environments

| Environment | Firebase project | Database | Who changes it |
| --- | --- | --- | --- |
| Local | `demo-estateos` emulator (+ dev Auth) | `.local-data/sql-connect` (PGlite) | Developers, freely |
| Integration tests | `demo-estateos-test` emulator | `.tmp/sql-connect-integration` | Test runner only (reset each run) |
| **Hosted development** | `estateos-development-f8c93` (existing) | Cloud SQL `estateos-fdc` / `fdcdb` | Approved deploys only |
| Production (later) | New project, e.g. `estateos-production` | Its own Cloud SQL instance | CI deploys after dev verification |

Projects never share a database, Auth tenant, service account or secret. `.firebaserc` gains aliases (`dev`, `prod`) and every deploy names the project explicitly (`--project dev`). The same `dataconnect.yaml` works in both projects because instance IDs are per project.

**Decision needed — region.** Cloud SQL and SQL Connect regions cannot be changed after creation without a migration. `us-east4` is declared today. For UAE customers, consider latency and UAE data-protection (PDPL) / client contractual requirements; check whether SQL Connect and Cloud SQL are available in a Middle East region (for example `me-central1`, Doha) before creating production. Development can stay in `us-east4` if it holds no real customer data.

## 3. Billing and expected cost (approximate)

- **Plan:** Blaze (pay-as-you-go) with a billing account is required for SQL Connect with Cloud SQL.
- **No-cost trial:** one trial Cloud SQL for PostgreSQL instance per project for 3 months (equivalent to PostgreSQL 17 `db-f1-micro`: shared vCPU, ~0.6 GB RAM, 10 GB SSD). Changing the instance configuration ends the trial. If the project is not on Blaze at the end, the instance is archived and deleted 90 days later.
- **SQL Connect operations:** no cost up to 250K operations/month, then about $0.90 per million (confirm on the Firebase pricing page; older posts quote a higher rate). Network egress free up to 10 GiB/month.
- **Development after the trial:** smallest instance from roughly $9–15/month including storage and backups.
- **Production starting point:** a dedicated-core instance (1–2 vCPU, 4–8 GB) is roughly $50–120/month; high availability roughly doubles compute. Committed-use discounts (1 or 3 years) reduce this later.
- **Controls (Approval):** budget alerts at $10, $25 and $50 for development; separate budget for production.

## 4. SQL Connect service configuration

1. Keep `schemaValidation: COMPATIBLE` for every hosted database. Never use `STRICT` on a database with data: it deletes tables and columns the schema no longer references.
2. Keep service `estateos`, connector `example`, database `fdcdb`.
3. The Admin SDK calls stored operations with verified-user impersonation, so connector `@auth` rules enforce access exactly as in the emulator. The integration suite is the specification of those rules.
4. The application's server identity (today an Admin SDK service-account key in `.env.local`) needs permission to execute SQL Connect operations. Confirm the least-privilege role in the SQL Connect IAM documentation; avoid project Owner/Editor.

## 5. Schema comparison and migration plan (development)

Order matters: **database schema → connectors → application**. All Phase 3–5E changes are additive (new tables, nullable columns, appended enum values).

| Step | Command / action | Approval |
| --- | --- | --- |
| 1 | `firebase dataconnect:sql:diff estateos --project dev` and review every statement | Read-only |
| 2 | On-demand Cloud SQL backup (`gcloud sql backups create --instance=estateos-fdc`) | Yes |
| 3 | `firebase dataconnect:sql:migrate estateos --project dev`: apply required changes; **decline every optional drop** | Yes |
| 4 | Re-run the diff; expect no required changes | Read-only |
| 5 | `firebase deploy --only dataconnect --project dev`; read the warning and breaking assessments before confirming | Yes |
| 6 | `firebase deploy --only storage --project dev` (private inventory rules) | Yes |
| 7 | Verification (section 10) | — |

**Rollback:** restore the step-2 backup into a **new** instance (clone) and compare before switching; Cloud SQL restore into the same instance overwrites it.

**Optional — move local data to hosted development (Approval).** Local company data belongs to real development-project Auth users, so it can be loaded after step 4: restore the chosen local backup into a throwaway PGlite, `pg_dump --data-only` it, upload to a private bucket and `gcloud sql import sql`. Do this only if the local data is worth keeping; otherwise start the hosted database empty.

## 6. Connector deployment requirements

- The deployed connector and `src/dataconnect-admin-generated` must come from the same commit. Deploy connectors before releasing application code that uses new operations.
- `firebase deploy` reports breaking changes (removed operations, changed variables). Treat any breaking assessment as a stop until reviewed.
- `dataconnect/seed_data.gql` (`ResetEstateOS`) is outside `connectorDirs` and must never be deployed.
- After production exists, deploys come from CI with a deploy-only service account; developers do not deploy production from laptops.

## 7. Environment variables

| Variable | Local (`dev:local`) | Hosted development | Production |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` | Dev project web config | Dev project | Prod project |
| `FIREBASE_PROJECT_ID`, `FIREBASE_ADMIN_PROJECT_ID` | Dev project | Dev project | Prod project |
| `FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY` | `.env.local` (dev key) | Secret Manager | Prefer the runtime service account (no key); otherwise Secret Manager |
| `APP_ORIGIN` | `http://localhost:3000` | Dev URL | Prod URL |
| `DATA_CONNECT_EMULATOR_HOST`, `FIREBASE_STORAGE_EMULATOR_HOST` | Set by `dev:local` | **Never set** | **Never set** |
| `ESTATEOS_ENVIRONMENT` (proposed) | `local` | `development` | `production` |

Proposed safeguards (small code change, after approval): the server refuses to start in production when an emulator variable is present or `FIREBASE_PROJECT_ID` does not match `ESTATEOS_ENVIRONMENT`; hosted secrets come only from Secret Manager (App Hosting `apphosting.yaml` secret references), never from committed files. Running `npm run dev` (without `:local`) against hosted development stays possible for debugging hosted issues.

## 8. Backup and restore strategy

| Layer | Development | Production |
| --- | --- | --- |
| Automated daily Cloud SQL backups | On, 7 retained | On, 30 retained |
| Point-in-time recovery (WAL) | Optional | On, 7 days |
| On-demand backup | Before every migration | Before every migration |
| Logical export (`gcloud sql export sql`) | Monthly | Weekly, to a private bucket in a separate project with retention policy |
| Deletion protection on the instance | On | On (automated backups are deleted with the instance unless retained) |
| Restore drill into a clone | Before the first production launch | Quarterly |
| Local | `.local-backups` tooling (`db:backup`, snapshots) | — |

## 9. Access control and company isolation

- **Application layer (unchanged):** every stored operation re-checks verified identity, active membership, role and organization; composite tenant foreign keys reject cross-company references. The same connector runs in emulator and hosted environments.
- **Database layer:** no direct database users for developers in production; break-glass access only, logged. Prefer private connectivity or IAM database authentication; no broad public IP allowlists.
- **Cloud IAM:** least-privilege roles per environment; production deploy rights only for the CI service account; developers get viewer access to production.
- **Audit:** enable Cloud Audit Logs (admin activity always; data access for Cloud SQL in production). Application `AuditLog` rows remain the business audit trail.
- **Client exposure:** connectors are reachable by any signed-in Firebase client, and all operations already require `@auth`. Consider Firebase App Check before production.

## 10. Verification tests for hosted development

The integration suite resets data and must **never** run against a hosted database (the reset guard refuses non-test hosts). Hosted verification uses a non-destructive smoke test (to be written after approval):

1. `firebase dataconnect:sql:diff` reports no required changes.
2. Two dedicated test accounts sign in; each creates a company with a clearly named test prefix.
3. Each account can read and write its own developers, projects, properties, listings and leads; reading or writing the other company's records by ID is denied (403/`LEAD_NOT_FOUND_OR_FORBIDDEN`/`ADMINISTRATOR_REQUIRED`).
4. An agent account sees only assigned leads and inventory; portal settings are denied to agents.
5. Audit rows exist for the writes.
6. Test companies are archived (not deleted) afterwards.
7. Manual walkthrough of the dashboard, inventory, lead detail (shortlist and viewings) and property portal preview.
8. Confirm the latest automated backup exists, then perform one restore into a clone.

## 11. Approval checklist

- [ ] Step 0 read-only inspection output reviewed
- [ ] Region decision (development and production)
- [ ] Blaze plan / billing account and budget alerts
- [ ] Cloud SQL instance: use the no-cost trial or a paid size
- [ ] Development schema migration (backup → migrate → deploy connectors/rules)
- [ ] Optional: load local data into hosted development
- [ ] Production project creation (separate approval, later)

## Sources

- [Introducing no-cost trials for Data Connect (Firebase blog)](https://firebase.blog/posts/2026/03/fdc-ift/)
- [Firebase pricing](https://firebase.google.com/pricing)
- [Data Connect pricing (Firebase blog)](https://firebase.blog/posts/2025/04/dataconnect-pricing-postga/)
- [Manage SQL Connect schemas and connectors](https://firebase.google.com/docs/sql-connect/manage-schemas-and-connectors)
- [Cloud SQL pricing](https://cloud.google.com/sql/pricing)
