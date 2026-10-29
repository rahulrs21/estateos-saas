# Demo data (local development only)

Fictional, reusable sample data for EstateOS development. These JSON files are **fixtures**: they are copied into the local database by `npm run seed:demo`. They are not a database. Everything you create or change in the app is stored in the local SQL Connect database (`.local-data/`), never in these files.

Everything here is invented: companies, people, contact details, prices and listings. Nothing represents real market inventory.
- Phone numbers use the UK Ofcom range reserved for drama (`+44 7700 900xxx`).
- Email and web addresses use reserved `example` domains.
- Names, references and descriptions carry "(Demo)", `DEMO-` or "Fictional demo record".
- Listings are never published and carry no advertising permit numbers.

| File | Contents |
| --- | --- |
| `fixtures/manifest.json` | Fixture set version (`uae-demo-v1`), counts, notice, demo company name |
| `fixtures/developers.json` | 5 developers |
| `fixtures/projects.json` | 10 projects with their phases and buildings |
| `fixtures/properties.json` | 30 properties (units), each with a photo from `public/demo-assets/` |
| `fixtures/listings.json` | 30 sale or rental listings, one per property |
| `fixtures/contacts.json` | 50 contacts |
| `fixtures/leads.json` | 50 leads, one per contact, with notes (activities), shortlists, viewings and follow-ups |
| `seed-operations.gql` | Local-only lookups and fixture tracking used by the seed (never deployed) |

Records refer to each other by fixture key (`DEV-01`, `PRJ-03`, `DEMO-P-007`, `CT-012`), never by database ID. The seed resolves the keys to IDs.

## Loading the demo data

1. Start the local environment: `npm run dev:local`.
2. Sign in at http://localhost:3000 once with your account, so that a local profile exists.
3. In a second terminal, run:

   ```powershell
   npm run seed:demo -- --email you@yourcompany.com
   ```

4. In the app, use the company switcher to open **Demo Realty (Sample Data)**.

| Option | Effect |
| --- | --- |
| *(none)* | Creates, or reuses, your own demo company. You are its owner. You stay in the company you were using. |
| `--organization <company id>` | Adds the demo data to an existing company where you are an owner or administrator. |
| `--dry-run` | Reports what would be created and writes nothing. |

## Safety rules the seed follows

- **Local only.**
  - It runs only against a running local emulator of a `demo-*` Firebase project on `127.0.0.1`. Firebase never connects `demo-*` projects to real resources.
  - It refuses `NODE_ENV=production`, other projects, remote hosts and a redirected Storage emulator.
  - It never loads `.env.local` and never runs automatically.
- **No accounts or passwords.**
  - It creates no sign-in accounts and contains no passwords.
  - It acts as the member you name, through the same SQL Connect operations and permission checks the app uses. Audit and activity entries name you.
- **Each fixture is created at most once per company.**
  - Each fixture is claimed in the `DemoFixtureRecord` table, keyed by (company, fixture key), before it is created. The database rejects a second claim.
  - Re-running creates nothing new, including after a run was interrupted.
- **Nothing that exists is changed or deleted.**
  - Demo records you have since edited or deleted are left alone, not restored.
  - If a record with the same unique reference already exists (for example your own `DEMO-P-001`), it is reported as a conflict and left unchanged.
  - Photos are added only to demo properties. Other images are never replaced or touched.
- **Photos are copied into the Storage emulator.** `dev:local` saves them to disk within seconds, and the seed waits for that save before reporting success.

Viewing and follow-up dates are set relative to the day you seed, in Dubai time, so they are always upcoming.

## Changing the fixtures

- Edit the JSON and keep every key unique, then run `npm test`. `tests/demo-seed.test.mjs` validates references, counts and the fictional-data rules.
- New fixtures are added on the next `seed:demo`. Changes to existing fixtures are **not** applied to records that were already seeded.
- Photos are drawn by `npm run demo:assets` (`scripts/generate-demo-assets.mjs`) from `properties.json`. They are original illustrations with a "DEMO IMAGE" watermark.
- Do not add downloaded listing photos, developer logos or other images you do not own.
