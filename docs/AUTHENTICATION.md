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

Signup creates a real Firebase password account and sends verification email. The Firebase client uses in-memory persistence; see [Firebase authentication persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence). It signs out after each account operation. The verification page therefore asks for email and password whenever resending verification.

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
| `DELETE /api/auth/session` | Validate origin/CSRF, clear the session, and revoke the authenticated user's sessions |

A cookie's presence alone grants no access. The shared server helper verifies Firebase identity. Future operations must invoke it and independently verify membership/capabilities at the operation boundary; a layout guard cannot secure an API or server action. See [Next.js authentication guidance](https://nextjs.org/docs/app/guides/authentication) and [the server cookie API](https://nextjs.org/docs/app/api-reference/functions/cookies).

The current identity grants access only to the empty workspace shell. There is no hardcoded admin, and client-supplied roles or organization IDs grant no authority. Organization selection, memberships, role/record permissions, audit persistence, and tenant data remain future work.

## Manual testing

Start `npm run dev` with `APP_ORIGIN=http://localhost:3000`. Use that exact URL, not `127.0.0.1`. Open browser Network and Application/Cookies panels without copying tokens/passwords into logs or screenshots.

### Signup and verification

1. In a private window, visit `/workspace/dashboard` and `/workspace/leads`. Both must redirect to login.
2. Visit `/signup`, enter a test email/password meeting your Firebase policy, and submit. Expect verification instructions and a new user in Firebase Console, with no EstateOS session cookie.
3. Before verification, try login. Expect verification instructions rather than workspace access. Visit `/verify-email`, enter the account email/password, resend email, and inspect loading/success/error messages.
4. Follow the email through Firebase's hosted handler, return to login, and sign in again. Only a verified account should receive a workspace session.
5. Inspect the cookie: HttpOnly, `SameSite=Strict`, `Path=/`, expiry about five days. It is named `estateos_session` over development HTTP. `document.cookie` must not reveal its value.

### Login and logout

1. Log out, submit an incorrect password, and expect a safe error with no new session. Check malformed email and empty-field validation too.
2. Log in with the verified account. Expect the dashboard, empty module states, and a signed-in indicator. Reload: the server session should retain access even though browser Firebase persistence is disabled.
3. Open a second workspace tab. Log out in the first, then refresh the second and navigate directly to a workspace route. Both must require login. Logout intentionally revokes this user's other Firebase sessions too.
4. Clear cookies and request `GET /api/auth/session`; expect `401`. Direct workspace navigation must redirect to login.

### Password reset

1. Visit `/forgot-password`, submit the test email, and expect a neutral confirmation. The confirmation should not reveal account existence.
2. Follow Firebase's hosted reset link and choose a new password. Return to login: the old password must fail and the new one must work.
3. Refresh any other browser holding an old session after password reset; revoked authentication must be rejected.

### Session and request boundaries

1. Replace the session cookie with arbitrary text and reload a workspace route. Expect denial/redirect.
2. Disable the test user or revoke sessions in Firebase Console. Reload the workspace and query the session API; expect denial. Restore the development account before subsequent tests.
3. Try session `POST`/`DELETE` with a missing CSRF header, incorrect token, missing `Origin`, or an origin differing from `APP_ORIGIN`. Expect rejection and no new valid session. Cross-origin browser JavaScript cannot read the CSRF response without same-origin access.
4. Automated boundary tests cover expiry, stale sign-in, unverified tokens, unsupported providers and revoked sessions. Real expiry can be checked with a disposable development session after its configured lifetime; do not weaken production settings for a shortcut.
5. On an approved HTTPS deployment, inspect `__Host-` names and `Secure`. Plain HTTP production mode cannot establish the secure production session; use `npm run dev` for the local HTTP walkthrough.

## Automated validation and remaining work

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Boundary tests substitute provider dependencies only in tests; production always uses Firebase verification. They exercise request/session policy without real emails or cloud credentials. Live email delivery, project configuration, HTTPS cookies and provider revocation still need development-project manual checks.

Before handling agency data, implement and test trusted memberships, organization scoping, role/record permissions and security audit storage. Production preparation also includes provider quotas/rate limits, password policy, account lifecycle, monitoring, recovery and deployment secrets. Company onboarding and lead CRUD are intentionally outside this change.

The dependency audit currently reports nine high-severity entries across two existing transitive chains: Firebase's unused Firestore gRPC dependency, and the Next.js ESLint globbing dependency. The authentication implementation imports only Firebase App/Auth and Admin App/Auth. Audit-proposed major downgrades and out-of-range overrides were not applied. Review patched supported upstream releases before deployment; passing application checks does not clear these dependency advisories.
