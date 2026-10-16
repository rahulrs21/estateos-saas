
# EstateOS - AI-Powered Real Estate CRM SaaS

## Project Vision
Build a production-ready, multi-tenant, AI-powered Real Estate CRM SaaS, initially targeting UAE real estate agencies.

The application will eventually include:
- Company, branch and agent management
- Role-based and record-level permissions
- Lead management, distribution and sales pipelines
- Developer, project and property management
- Property portal feed integrations
- Agency websites and landing page builder
- Marketing and advertising integrations
- WhatsApp, email, calling and video integrations
- AI-powered CRM Copilot
- Tasks, automation and notifications
- Finance, commissions and reporting
- Subscriptions and platform administration

## Technology Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Motion / Framer Motion
- Firebase Authentication
- Firebase SQL Connect with PostgreSQL
- Firebase Storage
- Firebase App Hosting
- OpenAI API for future AI features

## Architecture
- Use a modular monolith initially.
- Follow feature-based folder organization.
- Separate UI, validation, business logic and data access.
- Use server-side authorization for protected operations.
- Use a common organization-scoping mechanism.
- Keep external API credentials server-side.
- Build reusable UI components.
- Design for mobile and desktop.
- Use strict TypeScript and input validation.

## Security
- Never trust client-supplied organization IDs or roles.
- Verify identity and organization membership on the server.
- Prevent cross-tenant data access.
- Use least-privilege access.
- Protect all private routes and mutations.
- Keep secrets out of source control.
- Add audit logs for sensitive actions.
- Never use mock authorization in production code.

## Design
Create a premium, clean enterprise SaaS interface.
Use a collapsible sidebar, professional typography,
clear tables, modern forms and accessible navigation.
Support light and dark mode.
Avoid unnecessary animations.

## Development Rules
1. Implement only the requested module.
2. Review existing code before making changes.
3. Explain major architectural changes.
4. Do not introduce unnecessary dependencies.
5. Do not implement fake backend functionality.
6. Use loading, error and empty states.
7. Write tests for permissions and business rules.
8. Run lint, type checking and build after changes.
9. Fix issues before declaring a task complete.
10. Summarize changed files, tests and remaining work.
11. Do not deploy or change paid cloud resources without approval.
12. Never access or expose production secrets.

## Current Priority
Phase 1: SaaS foundation.
Focus on application shell, authentication,
organizations, memberships, permissions and leads.

Do not implement advanced AI, payment processing,
advertising integrations or property portal publishing yet.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
