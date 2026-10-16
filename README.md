# EstateOS

A real estate CRM foundation for UAE agencies, built with Next.js App Router, TypeScript, Tailwind CSS, and shadcn/ui. It includes a responsive workspace shell and real Firebase Email/Password authentication.

**This application is not production-ready.** Workspace access requires a verified Firebase identity. The SQL Connect foundation provides organization membership, role checks and tenant-scoped server services. Leads now has connected list, create, edit and detail interfaces, with assignment, pipeline, notes and follow-up. Organization onboarding and administration interfaces, finer record-sharing rules and operational release checks remain future work. Dashboard and other module screens retain explicit empty or unconnected states.

## Local development

Use **Node.js 24.12 or later** (see `.nvmrc` and `package.json`), then install dependencies:

```bash
npm install
```

Configure a Firebase development project and the variables in [.env.example](.env.example), following [Authentication setup and manual tests](docs/AUTHENTICATION.md). Keep real values in an ignored `.env.local` or your environment. Preserve any existing environment file; never commit service credentials.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Authentication requires valid Firebase browser configuration and server credentials; missing configuration does not bypass the server guard. The shell and authentication do not require a database. For local relational services, seed data, authorization integration tests and migration steps, follow [SQL Connect setup](docs/SQL_CONNECT.md). No OpenAI or billing setup is required for local development.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Public homepage |
| `/login` | Email/password login |
| `/signup` | Account creation and verification email |
| `/forgot-password` | Password reset email |
| `/verify-email` | Verification instructions and authenticated resend form |
| `/workspace` | Authenticated workspace entry |
| `/workspace/dashboard` | Protected dashboard with explicit empty states |
| `/workspace/leads` | Authorized lead search, filtering and pagination |
| `/workspace/leads/new` | Create a lead in the selected organization |
| `/workspace/leads/[leadId]` | Lead details, pipeline, assignment, notes, follow-up and timeline |
| `/workspace/leads/[leadId]/edit` | Edit an authorized lead |
| `/workspace/<module>` | Protected, unconnected module screen |

Other module slugs: `contacts`, `agents`, `developers`, `projects`, `properties`, `deals`, `tasks`, `marketing`, `communications`, `ai-copilot`, `automation`, `finance`, `reports`, and `settings`. Unknown module paths return a 404. Signing up does not grant an agency membership, role, or admin privileges. A separate authorized organization-creation operation creates a new tenant and its owner atomically. Leads requires an existing profile and active membership; it does not automatically create or elevate a company member.

## Validation

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Run `npm run sql:validate`, `npm run sql:generate`, and `npm run test:dataconnect` for the relational schema, generated SDK and disposable local emulator authorization suite. Compilation uses the official offline toolkit; the emulator suite uses the `demo-estateos` project. See [SQL Connect](docs/SQL_CONNECT.md) before seeding or considering any hosted migration.

To serve a production build locally, run `npm start`; production cookie settings require HTTPS. Use `npm run dev` for plain HTTP localhost authentication. Complete the live development-project checks in [AUTHENTICATION.md](docs/AUTHENTICATION.md) before a release, and review keyboard/mobile navigation and both themes.

## Scope and limitations

- Next.js App Router, strict TypeScript, Tailwind CSS, and existing shadcn/ui components.
- Reusable layout and dashboard components with responsive navigation and light/dark themes.
- Firebase browser authentication uses in-memory state; verified ID tokens are exchanged for expiring HttpOnly server sessions.
- Server checks protect workspace access and the session API. Client-supplied roles or organization IDs grant no authority.
- Sign-up, login, logout, email verification, and password reset use Firebase Authentication. Logout revokes the user's Firebase sessions across devices.
- SQL Connect models `Organization`, `UserProfile`, `Membership`, `Branch`, `Lead` and `Activity` with tenant relationships, transactional role checks, invitations, safe organization selection and audit events.
- Generated Admin SDK calls run as the verified session identity; server-only services validate inputs and derive organization scope. No Prisma or second database layer is used.
- Leads uses actual authorized SQL Connect queries/mutations for search, filters, pagination, contact details, status, assignment, notes and one upcoming follow-up per lead. Owners, administrators and managers have organization-wide lead access; agents are restricted to their assigned leads. Branch restrictions and more granular sharing remain future work.
- Organization onboarding, invitation delivery and branch/member administration interfaces remain separate work. A profile selection is rechecked against active membership on each operation; signing in alone grants no CRM data access.
- KPI cards and charts show empty states, not fabricated agency statistics.
- Lead HTTP mutations require a verified session, exact origin, CSRF protection, bounded strict JSON and selected-organization consistency checks. No billing, AI calls, communication providers, reminders, or publishing integrations.
- No cloud resources are provisioned and no deployment is performed.

Routes are grouped under `src/app/(public)`, `(auth)` and `(workspace)`, with existing URLs preserved. Domain code lives in `src/modules`; SQL Connect operations live in `dataconnect/connector`.

See [Architecture](docs/ARCHITECTURE.md), [Database](docs/DATABASE.md), [Permissions](docs/PERMISSIONS.md), [Authentication](docs/AUTHENTICATION.md), [SQL Connect](docs/SQL_CONNECT.md), [Leads](docs/LEADS.md), and the full [Roadmap](docs/ROADMAP.md).
