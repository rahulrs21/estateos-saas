# Local development database

`npm run dev:local` runs Next.js against a persistent local SQL Connect emulator (PostgreSQL 17 via PGlite) and the Storage emulator. Local data is separate from any hosted database and is never committed.

## Where data lives

| Path (git-ignored) | Contents |
| --- | --- |
| `.local-data/sql-connect/` | The local PostgreSQL database (`pg17/`). Used by `npm run dev:local` **and** `npm run sql:emulators`. |
| `.local-data/storage-export/` | Uploaded files (property photos, documents). Saved within seconds of every upload or delete while `dev:local` runs, saved again on a clean stop, and re-imported at start. |
| `.local-backups/sql-connect/` | Snapshots and backups (see below). May contain customer data — never share or commit. |
| `.tmp/sql-connect-integration/` | Integration-test database only. Reset by every test run; never holds development data. |

`.tmp/` is disposable scratch space and `.dataconnect/` is compiler output; neither holds a database any more. The previous location `.tmp/sql-connect-local/data` is copied once to `.local-data/sql-connect` the first time the new launcher starts and is then left untouched (delete it manually once you have confirmed your data).

## Starting and stopping

```powershell
npm run dev:local
```

- Stop with **one** Ctrl+C and wait for "Emulators stopped". A second Ctrl+C forces an immediate exit.
- Closing the VS Code terminal or restarting VS Code is also handled: committed data is durable (`fsync` and `synchronous_commit` are on) and PostgreSQL recovers on the next start. The automated persistence test verifies this.
- **Uploaded files are saved continuously.** The Storage emulator keeps files in memory. The launcher checks the bucket every 3 seconds and, when it has changed, exports it to `.local-data/storage-export` (written to a `.saving` folder, then swapped in, so a crash mid-save keeps the previous copy). The terminal prints "Uploaded files saved (N …)".
- **Autosave is off until the saved files are confirmed loaded.** At start, the launcher compares the saved file count with what the emulator loaded. If fewer loaded, it prints "Uploaded-file autosave is OFF" and leaves the saved copy untouched, so an empty emulator can never overwrite it.
- Only one emulator may use the database at a time. The launcher refuses to start if ports 9399, 9939, 9199, 4401, 4501 or 3000 are in use, and prints the process name and PID holding each port with the command that stops leftovers (for example a `dataconnect-emulator` left running after VS Code closed).
- `npm run dev` on its own does **not** use the local database; it uses the hosted SQL Connect configuration from `.env.local`. Use `dev:local` for local work.

## Backups

| When | Name | Kind | Retention |
| --- | --- | --- | --- |
| Every start, before the database opens | `auto-<time>` | File copy of the stopped database plus the saved uploaded files | Newest 10 |
| After each clean stop (archived at next start) | `exit-<time>` | Consistent `postgres.tar.gz` export | Newest 10 |
| `npm run db:backup [-- label]` | `manual-<time>[-label]` | Live export when running; file copy when stopped | Kept until you delete it |
| Before every restore | `pre-restore-<time>` | File copy | Kept until you delete it |

```powershell
npm run db:status            # row counts (read-only; works running or stopped)
npm run db:list              # backups, newest first
npm run db:backup -- before-phase6
npm run db:restore -- manual-2026-10-26T12-37-24-806Z-before-persistence-migration --confirm
```

Restore requires the emulator to be stopped, saves the current database as `pre-restore-*` first, and restores uploaded files when the backup contains them.

## What caused data loss before

1. **Destructive resets could reach the development database.** `npm run sql:seed` and the integration tests run `ResetEstateOS`, which deletes every row. Their only guard was "local demo project on a loopback host", which the `dev:local` database also satisfied, and the docs instructed seeding port 9399 — the same port `dev:local` uses. Resets now run only against the integration-test emulator (`127.0.0.1:19499`, `demo-estateos-test`) unless `ESTATEOS_CONFIRM_LOCAL_RESET=delete-local-data` is set.
2. **Different commands used different databases.** `firebase.json` (`npm run sql:emulators`, plain `firebase emulators:start`) stored data in `dataconnect/.dataconnect/pgliteData`; `dev:local` used `.tmp/sql-connect-local/data` (created 2026-10-19). Switching between them, or running plain `npm run dev` (hosted database), looked like data disappearing. Both configs now use `.local-data/sql-connect`, and `sql:emulators` runs through the same launcher.
3. **The database was in disposable folders** (`.tmp/` test scratch space, `.dataconnect/` compiler output).
4. **Every stop was abrupt.** `firebase emulators:exec` registers no signal handlers, so Ctrl+C or closing the terminal killed PGlite without closing it. Recovery normally works, but the Firebase CLI deletes the data folder if PGlite reports "Database already exists" at startup. The launcher now uses `emulators:start`, which shuts down cleanly on SIGINT/SIGHUP, and snapshots the database before each start.
5. **Uploaded files were never persisted** — the Storage emulator is in-memory. Files are now exported on clean stop and imported on start. (Files uploaded before this change were already lost; their `InventoryMedia` rows remain.)
6. **Startup race.** Firebase CLI 15.34 waits only ~4 s for the SQL Connect binary, which regenerates the Admin SDK before listening. On a busy machine startup failed, which also looked like missing data. The launcher retries this specific failure, and `test:dataconnect` uses a schema copy without SDK generation.

7. **Uploaded files were saved only on a clean Ctrl+C.** Item 5 added export-on-exit, but closing VS Code or the terminal, a crash or a leftover process never runs it. Files uploaded in such a session existed only in memory. For example, the 4 property photos uploaded on 27 October 2026 have `InventoryMedia` rows but no stored file, and no backup contains them. Files are now exported within seconds of every change (see "Starting and stopping"). The app shows a "file missing" placeholder for such records; delete the record and upload the file again.

Firebase CLI pitfalls to avoid: never pass `--import` with a folder containing a `dataconnect_export` (it overwrites the persistent database — the launcher strips it), and never call the hub's `/dataconnect/clearData` endpoint.

## Restoring after a problem

1. Stop `dev:local` (one Ctrl+C, then wait for "Emulators stopped").
2. `npm run db:list` and pick a backup. `auto-*` and `manual-*` backups taken while stopped include the uploaded files (`storage-export/`).
3. `npm run db:restore -- <name> --confirm`. The current database and files are saved first as `pre-restore-*`.
4. `npm run dev:local`.

Backups are never overwritten: every backup gets a new time-stamped name, and creating one refuses an existing folder.

## Demo data

`npm run seed:demo -- --email you@yourcompany.com` loads 5 developers, 10 projects, 30 properties with photos, 30 listings, 50 contacts and 50 leads with notes, shortlists, viewings and follow-ups. The data goes into a separate "Demo Realty (Sample Data)" company. The command:
- is development-only and idempotent;
- never changes existing records;
- never runs automatically.

See [dev-data/README.md](../dev-data/README.md).

## Verification

- `npm run test:persistence` runs in an isolated sandbox (its own project, ports and `.tmp` folder), so it is safe while `dev:local` runs. Each check below runs across a fresh emulator process after a hard kill, which is what closing VS Code does:
  - creates a company, developer, project, property, listing and lead, then verifies all data after each restart via authorized SDK reads and row counts;
  - uploads a file, waits for autosave and verifies the file byte for byte;
  - runs `seed:demo` (353 records, 30 photos), runs it again (0 created, one interrupted fixture recovered, identical row counts) and seeds a company holding a conflicting manual record, which stays unchanged;
  - checks that another company's member cannot read the demo company;
  - creates a manual lead after seeding and verifies it and every uploaded file after a restart;
  - checks that the seed refuses production and refuses to run without emulators;
  - verifies the legacy migration, startup snapshots and `db:status` on a stopped database.

  On macOS/Linux it also verifies a clean Ctrl+C stop and file export.
- `npm run test:local-db` covers fixtures, the seed guards and the storage-save recovery.
- `npm run test:local-db` — reset guard, snapshot retention, import sanitization, path containment, Git exclusion and emulator environment.
- Manual on Windows (the clean Ctrl+C path cannot be automated there): start `dev:local`, upload a property photo, wait for "Uploaded files saved", press Ctrl+C once or close VS Code, start again and confirm the photo and records are present.
