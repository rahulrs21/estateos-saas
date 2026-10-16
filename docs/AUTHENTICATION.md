# Firebase authentication

EstateOS uses Firebase Email/Password accounts and server-verified sessions. This is the identity portion of Phase 1B. It does not create companies, memberships, roles, permissions, or CRM records, and it does not make the application production-ready.

## Configure a development project

Use Node.js **24.12 or later**, a dedicated development Firebase project, and your own test inbox. No project settings, paid resources, or deployment are changed automatically.

1. In Firebase Console, register a web app and obtain its web configuration.
2. In Authentication, enable **Email/Password**. Email-link sign-in and other providers are outside this implementation.
3. Add `localhost` and your deployment domain to authorized domains. Newer projects may require adding `localhost` explicitly. Use the browser origin configured in `APP_ORIGIN`.
4. Review verification/password-reset templates. Keep Firebase's default hosted email action handler. Verification continues to `/login?verified=1`; password reset continues to login.
5. Enable email enumeration protection and choose an appropriate Firebase password policy. Firebase enforces the configured policy. See [Firebase password authentication](https://firebase.google.com/docs/auth/web/password-auth) and [verification/reset emails](https://firebase.google.com/docs/auth/web/manage-users).

## Environment variables

[.env.example](../.env.example) contains placeholders only. Preserve existing local values and keep actual credentials in ignored files or environment/secret configuration. Never commit credential JSON files or expose Admin keys to the browser.

| Variable | Visibility | Required value |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Browser | Web app API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Browser | Firebase authentication domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Browser | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Browser | Registered web app ID |
| `APP_ORIGIN` | Server | Exact canonical origin, e.g. `http://localhost:3000` in development or an HTTPS production origin; no path, credentials, query, fragment, or trailing slash |
| `FIREBASE_PROJECT_ID` | Server | Same project as the browser configuration |
| `GOOGLE_APPLICATION_CREDENTIALS` | Server, optional | Path to a securely stored service-account JSON file for local Application Default Credentials |
| `FIREBASE_CLIENT_EMAIL` | Server, alternative | Service-account email; set together with the private key when not using ADC |
| `FIREBASE_PRIVATE_KEY` | Server, alternative | Matching service-account private key; actual newlines or escaped `\n` separators are accepted |

The equivalent `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY` names are also accepted. If both naming styles are set, their corresponding values must match.

Browser configuration identifies the Firebase project without authorizing Admin access. `NEXT_PUBLIC_*` values are embedded at build time: restart development and rebuild production after changes. Privileged values must never use that prefix. See [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables).

Prefer Application Default Credentials with an appropriately scoped service identity on Google hosting. Local ADC can use `GOOGLE_APPLICATION_CREDENTIALS` pointing outside the repository. Ordinary `gcloud auth application-default login` user credentials require additional OAuth client setup for Firebase Authentication; see [Firebase Admin initialization](https://firebase.google.com/docs/admin/setup). Alternatively supply the paired server-only email/key variables. Use development credentials and least-privilege permissions.

The Admin SDK initializes lazily in `server-only` code. A successful build does not prove that credentials can contact Firebase. Missing configuration and provider outages fail closed rather than creating a preview session.

## Signup works, but login reports an unavailable session service

Signup and verification use the public browser settings. Creating a server session also requires Firebase Admin credentials. A working signup does not establish that the server is configured.

For local development with only browser settings configured:

1. In the same Firebase project's console, open **Project settings → Service accounts**. Generate a new private key for an appropriate service account, or use an existing development service-account key. See [Firebase's Admin setup instructions](https://firebase.google.com/docs/admin/setup#initialize_the_sdk_in_non-google_environments).
2. Store the downloaded JSON outside this repository and outside `public/`. Do not paste its contents into chat or commit the file.
3. Add these server settings to the root `.env.local`, preserving existing browser settings. Replace the example path with the actual local file path:

   ```dotenv
   APP_ORIGIN=http://localhost:3000
   FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
   GOOGLE_APPLICATION_CREDENTIALS="C:/secure/estateos-service-account.json"
   ```

4. Stop the existing dev server and restart it using Node 24.12 or later, then log in with the already-verified account. Do not create another account. On Windows, if `node --version` still reports an older version and no Node version manager is installed, you can start the app with `npm exec --yes --package=node@24.12.0 -- npm run dev`; this downloads and uses Node 24.12.0 without changing `.env.local`.

`.env.example` documents names and examples; Next.js does not load it as runtime configuration. Use `.env.local` for local values (Next.js also loads `.env` if present). The server accepts either `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` or the `FIREBASE_ADMIN_PROJECT_ID` / `FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY` equivalents. The project ID must identify the same project as the browser configuration. Application Default Credentials and either paired email/key setting style are alternatives; do not configure partial pairs.

Known configuration failures return a fixed `AUTH_CONFIGURATION_ERROR` message. Server audit events record only an allowlisted reason such as `ADMIN_PROJECT_MISSING`, `ADMIN_CREDENTIALS_INVALID`, or `ADMIN_PERMISSION_DENIED`; no raw provider message, key, token, email, or credential path is logged. Other service failures remain generic and fail closed.

## Identity and sessions

Signup validates full name, email, password and matching confirmation with Zod and checks Firebase's configured password policy. Password fields have accessible show/hide controls. The full name is stored as Firebase Auth `displayName`; registration creates no database profile, company, membership or privileged role. If account creation succeeds but name/verification setup fails, the UI reports incomplete setup and directs the user to resend verification.

The Firebase client uses in-memory persistence; see [Firebase authentication persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence). It signs out after credential operations. The verification page asks for email/password to resend verification. Password-reset confirmation does not disclose account existence. Raw Firebase error details and tokens are not displayed or logged.

The browser obtains a CSRF token and submits its ID token to the server. EstateOS requires the configured origin, matching CSRF cookie/header, verified email, the password sign-in provider, and authentication within the last five minutes. It issues a five-day session cookie, then clears the browser Firebase sign-in. Subsequent requests verify the server cookie with revocation checking enabled. Logout clears cookies and revokes the user's Firebase refresh tokens, invalidating sessions across devices. Invalid, expired, revoked, disabled-user and deleted-user sessions are rejected. These choices follow [Firebase's session-cookie model](https://firebase.google.com/docs/auth/admin/manage-cookies).

Session cookies are `HttpOnly`, `SameSite=Strict`, `Path=/`, and expire after five days. Production uses `Secure`, the name `__Host-estateos_session`, and no `Domain`. Development uses `estateos_session` for HTTP localhost. There is no sliding refresh; sign in again after expiry.

CSRF tokens expire after ten minutes. The server sends the token in a non-cacheable JSON response and stores a matching HttpOnly cookie (`__Host-estateos_csrf` in production, `estateos_csrf` in development). Session mutations require the CSRF request header and exact allowed `Origin`. Production requires HTTPS. Do not relax these controls to work around an incorrect host configuration.

## Protected routes and APIs

| Boundary | Behavior |
| --- | --- |
| `/workspace` and descendants | Server session verification; unauthenticated visitors redirect to `/login` |
| `GET /api/auth/csrf` | Issue a short-lived CSRF token without authenticated data |
| `GET /api/auth/session` | Verify the session and return authenticated identity; unauthorized requests receive `401` |
| `POST /api/auth/session` | Validate origin, CSRF and ID token before issuing a session |
| `POST /api/auth/logout` | Validate origin/CSRF, clear cookies, and revoke the authenticated user's sessions |
| `DELETE /api/auth/session` | Compatible logout endpoint sharing the same server implementation |

A cookie's presence alone grants no access. The shared server helper verifies Firebase identity. Future operations must invoke it and independently verify membership/capabilities at the operation boundary; a layout guard cannot secure an API or server action. See [Next.js authentication guidance](https://nextjs.org/docs/app/guides/authentication) and [the server cookie API](https://nextjs.org/docs/app/api-reference/functions/cookies).

Shared server session helpers live in `src/lib/auth/session.ts`; Firebase initialization stays in `src/lib/firebase`, and auth UI/provider flows/policy in `src/modules/auth`. This project's Cache Components configuration uses Node.js and disallows per-route `runtime` exports; Firebase Admin remains server-only and no Edge runtime is configured. Request-dependent rendering sits behind local Suspense boundaries without cross-user session caching. Authenticated visitors to auth pages redirect to the dashboard.

Identity grants access to the workspace shell. Existing organization and Leads services separately enforce membership and record permissions; this authentication task does not modify their database schemas or add company setup. Auth display names and client-submitted roles or organization identifiers grant no authority.

An absent, expired, revoked or malformed session can log out without identifying another user. If Firebase verification/revocation is unavailable, the endpoint reports a safe error and retains the cookie for retry rather than claiming all-device logout succeeded. In-memory browser auth is cleared even when that server request fails.

## Manual testing

Start `npm run dev` with `APP_ORIGIN=http://localhost:3000`. Use that exact URL, not `127.0.0.1`. Open browser Network and Application/Cookies panels without copying tokens/passwords into logs or screenshots.

### Signup and verification

1. In a private window, visit `/workspace/dashboard` and `/workspace/leads`. Both must redirect to login.
2. Visit `/signup`, enter full name, test email, password and matching confirmation meeting your Firebase policy. Test both show/hide controls and invalid/mismatched fields. Expect verification instructions and a Firebase user with the submitted display name, no EstateOS session cookie and no privileged role. Repeating registration should show a friendly sign-in/reset suggestion.
3. Before verification, try login. Expect verification instructions rather than workspace access. Visit `/verify-email`, enter the account email/password, resend email, and inspect loading/success/error messages.
4. Follow the email through Firebase's hosted handler, return to login, and sign in again. Only a verified account should receive a workspace session.
5. Inspect the cookie: HttpOnly, `SameSite=Strict`, `Path=/`, expiry about five days. It is named `estateos_session` over development HTTP. `document.cookie` must not reveal its value.

### Login and logout

1. Log out, submit an incorrect password, and expect a safe error with no new session. Check malformed email and empty-field validation too.
2. Log in with the verified account. Expect the existing dashboard and a signed-in indicator. Reload: the server session should retain access despite disabled browser persistence. Visiting `/login` or `/signup` while authenticated should return to the dashboard.
3. Open a second workspace tab. Log out in the first, then refresh the second and navigate directly to a workspace route. Both must require login. Logout intentionally revokes this user's other Firebase sessions too.
4. Clear cookies and request `GET /api/auth/session`; expect `401`. Direct workspace navigation must redirect to login.

### Password reset

1. Visit `/forgot-password`, submit the test email, and expect a neutral confirmation. The confirmation should not reveal account existence.
2. Follow Firebase's hosted reset link and choose a new password. Return to login: the old password must fail and the new one must work.
3. Refresh any other browser holding an old session after password reset; revoked authentication must be rejected.

### Session and request boundaries

1. Replace the session cookie with arbitrary text and reload a workspace route. Expect denial/redirect.
2. Disable the test user or revoke sessions in Firebase Console. Reload the workspace and query the session API; expect denial. Restore the development account before subsequent tests.
3. Try session `POST`/`DELETE` and logout `POST` with a missing CSRF header, incorrect token, missing `Origin`, or an origin differing from `APP_ORIGIN`. Expect rejection and no new valid session. Cross-origin browser JavaScript cannot read the CSRF response without same-origin access.
4. Automated boundary tests cover expiry, stale sign-in, unverified tokens, unsupported providers and revoked sessions. Real expiry can be checked with a disposable development session after its configured lifetime; do not weaken production settings for a shortcut.
5. On an approved HTTPS deployment, inspect `__Host-` names and `Secure`. Plain HTTP production mode cannot establish the secure production session; use `npm run dev` for the local HTTP walkthrough.

## Automated validation and remaining work

```bash
npm test
npm run test:auth:emulator
npm run lint
npx tsc --noEmit
npm run build
```

Boundary tests substitute provider dependencies only in tests; production always uses Firebase verification. They cover session/request policy, expired/revoked sessions, form validation and safe errors without cloud credentials. `test:auth:emulator` separately runs the actual Firebase Client/Admin SDKs and shared provider operations against a loopback `demo-estateos` Auth Emulator. Random disposable credentials exercise full-name registration, duplicate emails, verification/resending, invalid credentials, verified login, session verification, stale sign-in, logout/revocation and password reset. An isolated Next.js source copy on a free loopback port additionally tests actual session/CSRF/logout endpoints, cookie attributes, unauthorized APIs, protected workspace redirects, authenticated dashboard rendering and auth-page redirects. Its stylesheet is intentionally omitted: it tests HTTP behavior, not visual appearance. The user's dev server is left running, and ignored test copies contain no environment files.

The emulator runner never loads `.env.local`, uses separate ignored CLI settings, and requires the Firebase CLI plus free local ports `19099`, `19000` and `19001`. It does not deploy or access hosted resources. Emulator email action codes test the local flow; actual email delivery, real-project IAM and HTTPS cookie behavior still require manual development-project checks. The official emulator does not implement password-policy lookup: explicitly emulated auth skips that unsupported lookup while retaining Zod rules. Hosted Firebase always checks its configured policy.

Existing membership and record boundaries remain in place. Production preparation includes provider quotas/rate limits, password policy, account lifecycle, durable security audit storage, monitoring, recovery and deployment secrets. Company onboarding and changes to lead CRUD are outside this authentication task.

Next.js 16.4.1 development Instant validation may report that it cannot validate a segment when an expected authentication redirect prevents that segment from rendering. The HTTP suite verifies the redirect and protected access independently. Session checks remain behind Suspense; they are not cached or bypassed to suppress framework diagnostics. Review these development diagnostics separately from application build/test results.

Review current dependency advisories and supported upstream releases before deployment. Passing application checks is not a complete security audit and does not make the application production-ready.
