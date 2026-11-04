# Communication testing and simulation (Phase 6F)

How Phase 6F is verified without a telephony provider, a phone number or real calls. Everything here runs on local emulators with synthetic, fictional data.

## Three kinds of verification

The developer dashboard (below) keeps these separate. Passing the first two never makes a feature production-ready on its own.

| Layer | What it proves | How |
| --- | --- | --- |
| **1. Local simulated** | Business rules in isolation | Unit tests of the pure modules: state machine, compliance, signatures with test secrets, summary evidence checks, voice rules, meeting links, metrics |
| **2. Automated integration** | The real database operations, server routes and browser UI work together | SQL Connect emulator tests, browser tests against `next dev`, persistence after an abrupt stop |
| **3. Real external provider** | Twilio or Retell accounts, real webhooks, real numbers | **Blocked.** No provider is connected, `APP_ORIGIN` is not a public https address, the company has not confirmed its UAE operating arrangements, and no registered company line is assigned. See [TELEPHONY_PROVIDERS.md](TELEPHONY_PROVIDERS.md#live-calling). |

## The developer simulator (`/dev/communication-tests`)

It exists only when **all** of these hold (`src/modules/communications/dev/guard.ts`):

- `NODE_ENV` is not `production`. This is checked first; production disables it whatever else is set.
- `ESTATEOS_DEV_TOOLS=1` exactly.
- The SQL Connect emulator is in use on a loopback address.
- The Firebase project is a `demo-…` project.

Otherwise the page and every `/api/dev/communication-tests/**` route answer *not found* before authentication. Inside, only OWNER and ADMIN members can use it, and the database re-checks the role on every operation (all simulator operations are server-only).

To use it locally:
1. Add `ESTATEOS_DEV_TOOLS="1"` to `.env.local`.
2. Run `npm run dev:local`.
3. Open `/dev/communication-tests`.

### What it does

| Feature | Detail |
| --- | --- |
| Fictional leads | "Create fictional lead" uses the normal lead service (same validation, records and assignment), named `[SIM] Test customer XXXX`, with a number from the UK range reserved for drama (+44 7700 900xxx). Each is registered in `CommunicationSimulationRecord`. |
| Simulated calls | A call with source `SIMULATED` on a registered lead only; the database refuses any other lead. Scenarios: answered and completed, rang unanswered, busy, failed, answered then dropped, still ringing. Direction, purpose, talk time and outcome are chosen. |
| Same logic as providers | Each event goes through the provider state machine (`transition`), the shared status rule (`statusChange`: answered time, end, talk time, final workflow event) and a compare-and-set write like `ApplyProviderCallStatus`. No provider connection is created or pretended, and the real Call button stays disabled. |
| Workflow events | `call.started` and the call's one final event (`call.completed`, `call.failed` or `call.missed`) go through the Phase 6E outbox with origin `SIMULATOR`, so workflows (for example template G) run on them. |
| Replays | "Replay last event" sends the same status again (result `DUPLICATE`); "Send late ringing" sends an earlier status (result `FINAL`). Neither changes the call or starts a workflow. |
| Reset | Deletes simulated calls with their consents, recordings (files too), transcripts, summaries and suggestions, and meetings on simulator leads. It then archives the simulator's leads; their history stays for audit. Workflow events and executions are kept as history, marked `SIMULATOR`. Real records are never reached: deletes match source `SIMULATED` or the registry. |

### Synthetic records in analytics

- **Excluded by default.** Simulated calls are left out of the hub dashboard, the call list and reports. Meetings on simulator leads are left out of reports too.
- **Opt-in check.** Where developer tools are on, those pages show **Include simulated records**, which counts them so the statistics can be checked. The server honours `includeSimulated=1` only where developer tools are enabled, so production analytics can never include them.
- **Labelling.** Simulated calls are labelled *Simulated* on lead and contact pages and *SIMULATED (developer test, not a real call)* on the call page.

## Running the verification

```
npm run test:communications:verify              # unit, workflow unit, emulator, browser, persistence, lint, types
npm run test:communications:verify -- --quick   # unit, emulator, lint, types
npm run test:communications:verify -- --build   # add the production build
npm run test:communications:verify -- --live    # add the live-Claude checks (uses Anthropic credit)
```

The runner executes the suites one after another and records every named test with its result. It writes `.tmp/test-results/communications.json`, and `/dev/communication-tests` shows from it:

- each of the 11 acceptance criteria per layer (Passed, Failed, Blocked, Not run), with the matching tests as evidence;
- the date of execution;
- whether a real provider is needed.

A suite that did not run is never shown as passed.

### Live Claude

`AI_E2E_LIVE=1` (the `--live` flag) runs only the live block of the communications browser suite. It passes the key from `.env.local` to the isolated test server and nowhere else. The block:

1. creates a fictional lead and call;
2. records consent and uploads a synthetic transcript in which the budget is deliberately not stated;
3. asks Claude for a transcript summary and a notes summary;
4. checks the results:
   - no budget is invented;
   - the stated needs are captured;
   - at least 80% of points quote the transcript;
   - suggestions wait for a person;
   - usage and cost are recorded.

The summaries and token usage are printed in the log. Mocked tests (invalid key, recorded fixtures) are reported separately from live ones.

## What each criterion relies on

| # | Criterion | Main evidence |
| --- | --- | --- |
| 1 | Calls logged against leads and contacts | Emulator logging and access cases; browser logging from the lead and contact; numbers saved in display form |
| 2 | Survive restarts | `npm run test:persistence` (manual, simulated and provider-style calls, meetings and workflow events after an abrupt stop); reload checks |
| 3 | No access to other agents' calls | Emulator record-level cases; browser denials for managers, other companies and guessed IDs |
| 4 | Webhooks verified, duplicates handled | Signature unit tests (official SDK helpers, Retell window); browser checks for signed, forged, wrong-account, retried, late and concurrent deliveries. **The real provider layer is blocked.** |
| 5 | Live calls blocked | Blocker unit tests; database gate; browser refusal with reasons |
| 6 | Recordings need consent | Emulator consent cases; browser upload before and after consent; private, audited access |
| 7 | Accurate Claude summaries | Evidence-check fixtures; invalid-key path; the live block (when run) |
| 8 | Suggestions and workflows | Workflow-event emulator cases; follow-up accepted once; missed-call workflow (real and simulated); `call.summarize` step |
| 9 | Meetings and links | Link unit tests; meeting emulator cases; browser scheduling from the lead |
| 10 | Dashboards | Metrics unit tests; report-scope cases; browser dashboard and reports; simulated records excluded |
| 11 | Isolation, browser, build | Whole emulator and browser suites, lint, TypeScript, production build |

## Not verified here (needs a real provider)

- Webhooks from a real Twilio or Retell account. Signatures are tested with the official helpers and test secrets only.
- Placing a call through a provider, including click-to-call bridging to the agent's phone.
- Provider recordings and transcripts. EstateOS deliberately does not ingest them.
- Delivery to a public https `APP_ORIGIN`.
- Number registration and UAE operating confirmation.
