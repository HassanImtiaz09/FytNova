# FytNova Railway backend

The repository root contains both the Expo app and Express/tRPC API. Railway
runs the API. It does not start Metro, compile Android or host the Expo screens.
The Railway API is deployed at `https://fytnova-api-production.up.railway.app`.
The user selected a fresh database for testing. The Android preview profile now
uses this API; provider-dependent AI and storage features need separate setup.

## Service configuration

Use the `codex/preview-setup` branch until its infrastructure changes are merged.
For the initial release, pin the service to the reviewed commit. The root
`railway.json` configures:

- Railpack with Node 22 and the package manager in package.json (pnpm 9.12.0).
- `pnpm build`, producing `dist/index.js` and `dist/migrate.js`.
- Pre-deploy: `node dist/migrate.js`, applying committed SQL migrations only.
- Start: `pnpm start`, running the API in production mode.
- Readiness check: `/api/ready`, with a 120-second startup timeout.
- Restart on failure, with five retries.

Keep Railway **Serverless/App Sleeping disabled** for this API. Fresh services
are long-running by default; verify the setting after the first service
instance is created. A service with no instance yet can be staged for review
before deployment. Railway's deployment tool requires explicit confirmation
before committing the staged environment with `accept-deploy`.

The API listens on `0.0.0.0` at Railway's assigned `PORT`. Do not set a custom
PORT variable. Production startup fails if that port is occupied, rather than
silently selecting a different port. Local development retains port fallback.

## Private environment variables

Use Railway's service Variables editor. An example without working credentials
is in [deployment/railway.env.example](../deployment/railway.env.example).

| Variable | Purpose |
| --- | --- |
| `NODE_ENV=production` | Enables production startup checks |
| `DATABASE_URL=${{MySQL.MYSQL_URL}}` | References the MySQL service over Railway's private network |
| `JWT_SECRET` | Session signing; securely generated, at least 32 characters |
| `VITE_APP_ID=TCxddYfhYS3he4wae2YPUE` | Existing Manus OAuth project identifier |
| `OAUTH_SERVER_URL=https://api.manus.im` | Existing OAuth provider |

These variables are required for production startup. No secret values belong
in GitHub, the mobile bundle, chat messages, or an `EXPO_PUBLIC_` variable.
The Railway API's signing secret is separate from the old Manus server, so
start a fresh sign-in after the app switches to the new API.

Google sign-in continues using Manus's hosted OAuth service and the registered
`manus20260312102054` app callback. Running this API on Railway removes its
dependency on an awake Manus sandbox; it does not replace the OAuth provider.

Session cookies are HTTP-only and host-only. The API does not set a parent
Domain such as `.railway.app`; browser clients send the cookie back to the API
with credentials included, and native clients use their stored bearer token.

AI coaching needs `ANTHROPIC_API_KEY` and/or the configured Gemini/Forge provider.
The existing storage helpers require `BUILT_IN_FORGE_API_URL` and
`BUILT_IN_FORGE_API_KEY`; validate their use from Railway before enabling
uploads. Voice uses `ELEVENLABS_API_KEY`; image generation uses `FAL_KEY`.
Configure Stripe keys and price identifiers separately before testing billing.
`OWNER_OPEN_ID` restores the configured owner's automatic admin role where
needed. Missing optional provider credentials do not block API/database
readiness; those features require their own acceptance checks.

## Database initialization and existing records

The MySQL template provisions a persistent `/var/lib/mysql` volume and generates
its credentials. The API references `MySQL.MYSQL_URL`; no public TCP proxy is
required for the API connection.

`pnpm build` must run before `pnpm db:migrate`. The migration runner applies the
five SQL files already tracked under `drizzle/`, using Drizzle's migration
journal. It does not generate SQL or run a schema push during deployment.

The runner initializes an empty database. It also updates databases that have
recorded Drizzle migration history. It refuses an existing, non-empty database
with missing or empty history before calling the migrator. Resolve that case
from a backup and a reviewed schema/history comparison, not by deleting tables
or bypassing the check.

The user selected a new empty Railway database for testing rather than a data
transfer. Existing Manus users, meals, workouts, progress and subscription rows
remain on the original backend. Native credentials are bound to their API URL;
the next APK retires legacy/previous-backend sessions and needs a fresh sign-in,
without deleting local guest records. Existing sessions tagged with the same
Railway address are retained in future builds.

If a future cutover must preserve existing server records:

1. Back up/export the existing Manus database through a private channel. Keep
   table relationships, IDs, and migration history together.
2. Reconcile schema and migration history in an isolated destination. If the
   source has no migration history, initialize the empty destination from the
   committed migrations first, then review and import the data separately.
3. Check row counts and IDs, and verify account/profile/meal/workout reads and
   writes. Verify existing media URLs and the storage provider separately.
4. Configure recurring backups before using Railway as the authoritative store.

For such a data transfer, keep the source available until the destination is
verified. The guest-data import remains incomplete; do not use it as a
substitute for a database transfer.

## Deployment and app checks

`/api/health` checks that the process is running. `/api/ready` additionally
connects to MySQL and checks that all modeled application tables are present;
it returns 503 until they are available. Public health responses do not include
SQL errors or credentials.

After deployment, generate a public HTTPS domain for the API and check:

- `/api/health` and `/api/ready` return 200 JSON with `ok: true`.
- `/api/trpc/auth.me` returns null without a session.
- `/api/oauth/mobile` without parameters returns its 400 JSON validation error.
- Protected data routes reject unauthenticated requests.

For this fresh testing deployment, the EAS profile already contains the Railway
HTTPS origin. Build a new APK and test fresh Google sign-in, saved profile,
meals/workouts, AI and media. A successful readiness check establishes API and
schema availability; it does not establish that these feature flows work.

## Local deployment validation

The production entry points were tested with Node 22.16.0 and temporary MySQL 8:
all migrations applied, a second run preserved a seeded user, readiness tracked
missing/restored tables, and an untracked populated database was refused
without modifying its tables or rows. Startup checks also cover missing
configuration, an unreachable database, and an occupied assigned port.
