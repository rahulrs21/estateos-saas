# Automation operations (Phase 6E)

How workflows run in each environment, and what to watch. Background: [Engine](AUTOMATION_ENGINE.md), [Security](WORKFLOW_SECURITY.md).

## Worker

All automation state is in PostgreSQL. A "tick" (`POST /api/internal/automations/tick`) processes one bounded batch: at most 20 companies, about 20 seconds, and 10 steps per execution. Anything left is picked up by the next tick. Nothing long-running happens in page requests, and no delay depends on a timer or on memory.

The endpoint is off (503 `WORKER_NOT_CONFIGURED`) until `AUTOMATION_WORKER_SECRET` is set: at least 32 random characters, server-only, never committed. Callers send `Authorization: Bearer <secret>`, which is compared in constant time. The response contains counts only.

### Local worker

1. Add a secret to `.env.local`:
   ```
   AUTOMATION_WORKER_SECRET=<output of: node -e "console.log(require('crypto').randomBytes(36).toString('base64url'))">
   ```
2. Restart `npm run dev:local`. Once Next.js is up it starts the worker, which ticks every 5 seconds. Without the secret it prints that automation is off.
3. Or run `npm run automation:worker` on its own against a running app (`AUTOMATION_WORKER_ORIGIN`, default `http://localhost:3000`; local origins only).

The worker never overlaps ticks, backs off up to 30 seconds while the app is starting or failing, and logs counts only. Stopping it, or the app, loses nothing: waiting jobs keep their `runAt`, claimed jobs are reclaimed when their 120-second lease expires, and every side effect is idempotent.

### Hosted: Cloud Scheduler adapter (design only; not provisioned)

Provisioning needs your approval; Cloud Scheduler is a paid Google Cloud service, although the expected volume is within its free tier.

1. Store `AUTOMATION_WORKER_SECRET` in Secret Manager and expose it to App Hosting (`apphosting.yaml`, `secret:`).
2. Create one Cloud Scheduler HTTP job per environment:
   - every minute;
   - `POST https://<app origin>/api/internal/automations/tick`;
   - header `Authorization: Bearer <secret>` from Secret Manager;
   - a 60-second attempt deadline and no automatic retries (the next minute retries).
3. Optional hardening before production: also accept an OIDC token from an allowlisted service account (Cloud Scheduler `oidcToken` with the app origin as audience), verified with Google's public keys in `tickResponse`. Then retire the shared secret, or rotate it regularly.
4. A minute's granularity is enough: delays and schedules store exact UTC times, and a tick runs everything due.

Cloud Tasks is not needed. Executions are already durable rows with leases, and one scheduler tick fans out within the batch limits. For much higher volume, run several ticks in parallel: the company leases keep them from processing the same company twice.

## Observability

- **Tick summaries** (`automations.tick_errors`, `automations.tick_failed`) are written to the server log with codes. Outside production they include the provider's message.
- **Execution history and failed or dead jobs:** `/automations` shows execution history with filters and step details. Failed and dead jobs appear with their error codes.
- **Counters:** `AutomationOrgState` holds the daily execution and Claude-step counters (`periodKey`, `executionCount`, `aiCallCount`) and the last scan time.

## Limits and what happens at them

| Limit | Behaviour |
| --- | --- |
| 1,000 executions per company per UTC day | Further events for the day are marked `FAILED` with `AUTOMATION_DAILY_LIMIT` |
| 50 Claude steps per company per UTC day | Claude steps are skipped with a reason; the rest of the workflow continues |
| Monthly AI allowance (existing) | A Claude step fails with `AI_QUOTA_EXCEEDED` (not retried) |
| Chain depth 3 | Deeper workflow-created events are skipped with `CHAIN_DEPTH_LIMIT` |
| 90 days per execution | Older executions fail with `EXECUTION_EXPIRED` |

## Rollout

The schema and operations are additive:

- new tables in `dataconnect/schema/automation.gql`, plus enum values in `schema.gql`;
- the new connector files `automations.gql`, `approvals.gql` and `tasks.gql`;
- outbox inserts added to existing mutations.

Locally, run `npm run db:backup`, then restart `npm run dev:local` to apply them. Hosted rollout (schema migration and connector deploy) needs your approval and has not been done. The app needs only the secret; the Anthropic configuration is unchanged.
