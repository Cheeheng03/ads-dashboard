# Ad Observatory

## Local development workspace

Continue development in `/Users/tangcheeheng/dev/ad-observatory`. As of 4 October 2026, work is local-first; do not publish further changes unless requested.

```sh
cd /Users/tangcheeheng/dev/ad-observatory
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/`. If local sign-in is needed, use `http://127.0.0.1:5173/signin-with-chatgpt?return_to=/`. Stop the development server with Ctrl+C in the terminal that started it. Dependencies are already installed in this checkout; for a fresh checkout use `npm ci` first.

- `app/`, `components/`, `db/`, `drizzle/`, `scripts/`, `public/`, and `tests/`: complete application source, schema/migrations, SDK export helper and checks.
- `docs/research/`: copies of the research guide, metrics catalog, PDF renders, document-generation scripts and Malaysia collection evidence. Original documents remain in `~/Documents/MetaAdsResearch`.
- `docs/design/`: the three dashboard concepts as an inline HTML source fragment and the available supplied design references. The fragment uses the conversation visualization runtime; the implemented dashboard is under `app/`.
- `.wrangler/state/`: the persistent local SQLite/D1 development database. **Keep this directory to retain your local records.** It is separate from the hosted database and is not automatically synchronized.
- `data/backups/`: a verified SQLite backup of the existing local database before this local-development handoff. This directory is ignored by Git.

The local workspace currently has two companies, 13 saved ads and no imported financial reports. It is the existing development dataset, not a fresh export of the hosted database. Source media still uses remote URLs; copying the project does not archive the original ad image/video files. No Meta token or production environment secret is needed for local development.

The latest financial report implementation is in `app/financial-overview.tsx` and `app/spend-model.ts`. It leads both company and comparison reports with spend, revenue, ROAS, result costs, weekly/monthly aggregation, cumulative imported amounts, ad rankings and a separate assumptions-only projection tab. Custom date ranges support up to 366 days. Missing dates and measures remain explicit; a larger ad count does not imply a larger budget.

Useful checks:

```sh
npx tsc --noEmit
node tests/run-business-tests.mjs
npm run build
```

The existing `.openai/hosting.json` and Git history are retained for future optional publishing. Starting localhost does not publish or change the hosted site.

Chee Heng’s private competitor-ad research workspace. Companies, ads, pins, annotations, observations, daily account reports and activity are stored in a dedicated Cloudflare D1 database. Every API operation is scoped to the signed-in owner; production access is private through Sites.

## Current interface: spending ranges and response

The local interface uses a white theme with locally bundled Inter, a compact company directory, expandable ad rows, and an assumptions side panel. The report uses linked ad titles with horizontal spend-range and age bars, followed by an interactive source-start calendar. Ad links open the saved record or original Meta page. Calendar dates open the matching ads; months stay synchronized in the comparison view. Missing dates are not treated as known company inactivity. Spending comparisons share a value scale when currency and spending basis match; age charts share a day scale. The cumulative scenario chart has been removed because latest saved Active status cannot reconstruct historical delivery. Missing measured response is summarized in one line; no sample performance figures are inserted.

The company and comparison reports now use one estimator workspace (`app/focused-report.tsx`), with calculations and validation in `app/estimation-model.ts`. Main navigation remains Companies, Compare and Saved ads; import/settings is separate. Prior analytics modules remain as historical source, not active report screens.

The report offers two spending bases:

- **Assumed company budget:** an explicitly illustrative shared daily pool. For each date, the pool is split equally across saved ads whose latest saved status is Active and whose valid source start is on/before that date. This assumes continuous delivery and full spending. It does not reconstruct actual historical budgets or delivery. Additional ads divide the pool rather than multiplying it. Dates with no eligible ads receive no modeled allocation. The displayed totals are explicitly selected-window budget scenarios, not a historical spend series.
- **Delivery evidence & benchmarks:** one method per ad, in priority order: supplied spend; impressions × CPM / 1,000; reach × assumed frequency × CPM / 1,000; paid clicks × CPC. Alternative methods are shown but never added together. Evidence must match the selected window and currency. Company totals are withheld when contributing evidence scope labels differ; even matching labels are user-supplied, not verified. Totals cover the tracked subset only.

Initial CPM, CPC, frequency, CTR and shared daily pool values are illustrative assumptions, not Malaysian benchmarks. Blank assumptions remain missing, confirmed zero stays zero, and derived ranges are not confidence intervals. Modeled clicks cannot generate measured CTR or enter the performance ranking. Exact supplied impressions and paid clicks enable CTR; supplied spend and outcomes enable cost ratios. Public engagement pace is net counter change divided by elapsed days between snapshots, including negative corrections and potential organic activity. Copy quality is not inferred causally from CTR.

Click **Assumptions** to edit and apply the inputs. Each ad has **Add / edit evidence**, with explicit source, scope, currency and dates. Apply changes to preview, then **Save changes** to persist them in the local database. The report indicates unsaved changes. One current model is stored per company; applying new evidence for an ad replaces that ad's previous model evidence entry when saved. Original ad records, observation history and authorized account reports are preserved separately.

The additive migration `drizzle/0002_illegal_eternity.sql` creates `analysis_models`. It was applied to the existing local database after a verified backup under `data/backups/`; it has not been applied to the hosted site. The API scopes model reads/writes to the owner, checks each evidence ad belongs to that company, validates bounds and dates, and removes company models on company deletion. JSON workspace exports include `analysisModels` (schemaVersion 3).

Validation:

```sh
node tests/run-estimation-tests.mjs
node tests/run-business-tests.mjs
python3 tests/estimation-api-smoke.py  # local development server only
npx tsc --noEmit
npm run build
```

There is no automatic public click collector or provider connection. Our saved competitor ads still contain no collected paid click or impression evidence. Authorized account rows remain separately inspectable; no public Library ID is joined to an Ads Manager ID by title. Research references: [Meta SDK account permissions](https://github.com/facebook/facebook-python-business-sdk), [Meta billing events and optimization settings](https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adset.py).

## Available workflows

- Create and edit a company watchlist with Meta Page IDs and market codes.
- Save ads manually; search and filter by company, status and format.
- Pin ads into named collections and compare up to three creatives.
- Keep original copy, hooks, creative angles, research notes and test hypotheses.
- Record manual status checks or import timestamped snapshots.
- Import normalized JSON or supported Apify snapshot fields, up to 200 rows / 2 MB. Library IDs deduplicate within each owner. Reimports preserve existing curation.
- Export the complete workspace as JSON. This is a data backup; the ad importer accepts ads for one selected company and is not a full workspace restore tool.
- Enter sourced reach/spend and optional frequency/CPM assumptions. Scenarios are labeled estimates and apply to the entered reach period, not lifetime spend.

## Analytics and report imports

The charcoal design system follows the supplied PicGen reference: dotted canvas, nested graphite panels, thin borders and restrained green, blue, violet and amber accents. `app/analytics.tsx` renders Recharts visualizations, analytical tables, report preview and the built-in metrics guide. `app/analytics-model.ts` holds normalization and aggregation functions. `app/sample-data.ts` is opt-in fictional data kept in React memory, never written to D1.

- Overview: discovery/check timeline, format mix, competitor table, source-age distribution, annotation coverage and stale checks.
- Creative intelligence: angle distribution and copy/hook/hypothesis comparison.
- Spend & revenue: daily spend and attributed purchase value, weighted ROAS/CTR/CPC/CPM/CPA, reported conversion events, contribution-margin scenario, ad-level rollups and daily source rows.
- Filters: company, 7/30/90-day period, currency and attribution scope. UTC dates define the research window; report dates retain the advertiser's account timezone, recorded in scope.
- Import up to 500 daily ad-level Insights JSON rows (2 MB). Export with `level=ad`, `time_increment=1`, no breakdowns. A downloadable Python Business SDK exporter is in `public/meta-insights-export.py`; it needs the owner's token and authorized account locally. It has not been executed against a real account in this workspace.
- Enter the exact attribution windows, report-time basis and account timezone as the scope. Re-importing the same owner/account/ad/date/currency/scope upserts instead of adding duplicates. Scope removal deletes only that account/currency/attribution combination, with confirmation.
- Canonical `purchase` actions and values are used; overlapping action aliases are not summed. Missing action types remain null. Supply an explicit zero only when the report establishes zero. Aggregates remain unknown if a contributing row lacks that measure. Days without rows render gaps.
- Reach is visible per original daily ad scope and is never summed. Frequency is calculated only for that row. Ratios use summed numerators and denominators; currencies and attribution scopes never mix.
- JSON workspace export includes performance rows. Performance CSV exports the filtered daily records and neutralizes spreadsheet formula prefixes in text cells.

The database migration is additive. Existing companies, ads, curation and observation history remain intact. The schema does not equate public Library IDs with Ads Manager ad IDs.

## Business comparisons and focused reports

`Compare businesses` independently calculates both sides with one date window, currency and reporting scope. Spend, oldest source-start age and reported ROAS lead the view. Inventory completeness, active/unknown status counts, source-age statistics, field coverage and arithmetic differences are available in the detailed table. Format and age distributions, discovery timelines, longevity lists, spend-by-ad charts and account rankings expose the underlying records.

`Company report` opens from either the sidebar or a company card. It includes all saved creatives with full original copy, media where a source URL exists, dates, format, market, source links, Library IDs, manually supplied evidence, notes, hypotheses and check history. Cards are searchable, sortable and paginated (12 per page); a metric-table view shows the same records. Company financial records stay separate from public creative IDs.

Every calculated metric and chart in these reports has a keyboard/touch-accessible info popover describing formula, source/scope and interpretation. Existing overview chart and KPI headers also link to these explanations. `app/business-model.ts` is the common calculation/explanation registry; `app/metric-info.tsx` implements the shared popover. Comparisons use full precision before rounding for display.

Important definitions:
- Source age is UTC calendar days since a valid, non-future source start date, as of the report snapshot. Inactive ads continue to have a calendar age. It is not paid duration.
- Observed-active span requires at least two distinct Active check timestamps, and measures the elapsed whole days between them. Pauses in unobserved gaps are not inferred away. Distinct active-check dates count observations, not paid delivery dates.
- Public inventory is the saved collection, never asserted as all ads the company runs. Library ID coverage flags weak deduplication evidence. No survival or profitability score is inferred from age.
- Account rankings can use spend, ROAS, CPA, purchases or spend per represented date. The latter divides complete reported spend by dates with report rows; it is not a fixed maintenance fee, configured budget or launch-age adjustment. Unknown values rank last; zero denominators remain unavailable.
- Reported reach is inspected only within an original ad/day row. Daily frequency uses that row's impressions/reach. No cross-ad or cross-day reach total is manufactured.
- Manual public-ad spend/reach remains attached to its supplied source text and is never aggregated into business financial totals because scope equivalence is unverified.
- Fictional sample data is optional, read-only and never inserted into the database.

Run `node tests/run-business-tests.mjs` for boundary dates, medians, missing/zero handling, collection and reporting scope, repeated checks, uncertain active spans, weighted ratios and account grouping. Browser checks cover comparison swaps, company report selection, formula popovers, copy search, pagination and responsive overflow.

## Scope and data integrity

No automatic Meta collector, paid provider, LLM analysis, revenue connection or recurring job is configured. Data comes from manual entries and imports. Ad age is elapsed time since the source start date, not proof of continuous delivery or profitable performance. Competitor CTR, clicks, revenue and actual spend remain unknown unless supplied by an authorized or disclosed source.

Image URLs reference the source remotely and may expire; original creative files are not archived. Observations record ingestion/check times. Production begins empty; local QA records are never included in migrations or the deploy archive.

## Verification

Run `npx tsc --noEmit`, `npm run lint`, `node --experimental-strip-types tests/analytics.test.mjs` and the build command below. `python3 tests/performance-smoke.py` verifies daily upserts, invalid-row atomicity, scope isolation and report deletion. With the portable local preview running, `python3 tests/workspace-smoke.py` checks anonymous access, spoofed identity rejection, origin validation, persistence, deduplication, curation retention, timestamp integrity, import atomicity, invalid metric rejection and cascade deletion using local-only fixtures.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git is required only for publishing

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Run `node <plugin-root>/scripts/configure-execution-profile.mjs` only when the profile is unknown for the current checkout and environment. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are ignored by Git. Preserve `.wrangler/state/` or a verified database backup to retain local workspace records; runtime configuration can be regenerated.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

For browser QA on managed Linux, use `sites-preview start`. The project's dev script runs Vite and accepts the supervisor's `--host 0.0.0.0 --port 4173 --strictPort` arguments. The internal browser uses `http://terminal.local:4173/`; it is not a user-facing URL. The supervisor owns the preview lifecycle. The ignored local profile survives the supervisor's cleared process environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Meta connection settings (local)

Open `http://127.0.0.1:5173/settings`, also linked as **Settings → Meta connection** in the dashboard sidebar. This is a single-ad-account pilot connection, independent of public competitor research.

1. Choose/create your Meta Developer app with Marketing API access. Copy its App ID from Settings → Basic.
2. Confirm that your user (or system user) has reporting access to the selected ad account. Copy the ad account ID from Ads Manager.
3. Generate a token for that app with `ads_read`. For a user-token pilot, use Meta's Graph API Explorer. For a system user, assign the app and ad account in Business Settings before generating its token. External client access may require Advanced Access/app review; developer setup does not bypass asset permissions.
4. Enter the IDs and token in Settings, and optionally the app secret for server-side `appsecret_proof`. Save, then press **Test connection**. Do not paste credentials into chat or source code.

The test performs two read-only Graph API requests: account identity/currency/timezone, then one account-level Insights row for `last_7d`. It checks access, not completeness or spend accuracy. An empty successful Insights response is explicitly shown as no recent rows, never interpreted as zero spend. It does not validate the supplied App ID's ownership, inspect token expiry, import reports, change ads, or enable background sync. No OAuth callback is required for this manual-token pilot. No client secret belongs in a browser OAuth flow.

The default Graph API version is `v26.0`, checked against [Meta's Business SDK configuration](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/apiconfig.py). The optional secret proof follows [Meta's SDK session implementation](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/session.py). Setup/permission reference: [Meta's official Marketing API collection](https://www.postman.com/meta/facebook-marketing-api/collection/0zr4mes/facebook-marketing-api-mapi). Interface labels and required app-review steps can differ by app/use case.

Credential protection:

- The token and app secret are encrypted together with AES-256-GCM and a fresh random 96-bit nonce for each save. Authenticated data binds ciphertext to the owner, app ID and account ID. The SQLite table is `meta_connections`; only flags and nonsensitive account metadata are returned to the browser.
- `node scripts/setup-local-credentials.mjs` creates a random 32-byte server key in ignored `.dev.vars` with `0600` permissions. It never prints or replaces an existing key. Restart `npm run dev` after first setup. Cloudflare supplies `CREDENTIALS_ENCRYPTION_KEY` as a server runtime binding; never use a `VITE_` or `NEXT_PUBLIC_` variable for it. Missing/invalid keys disable storage/testing; no plaintext fallback exists.
- Keep the key separate from database backups and restrict access to both. Losing the key requires removing/re-entering saved credentials. Key rotation is not automated. Production credentials/secret provisioning are not configured by this local change.
- Authenticated owner-scoped routes, required same-origin JSON writes, bounded request bodies, revision conflict checks, no-store responses, and a 30-second test cooldown protect the endpoint. Provider errors are mapped to fixed messages rather than logging/returning raw tokens or URLs. Tokens are sent to a fixed Meta HTTPS host in an authorization header, with redirects disabled.
- Vite binds to loopback locally and blocks `.dev.vars`, environment files and local database/state files from static download. Local sign-in is a development convenience, not a personal authentication system; anyone with control of this Mac/server can potentially access credentials. Keep this development server private. Encrypting the database does not protect against compromise of both the server key and the database.
- Workspace exports exclude credentials. Removing a connection removes the live database record only; it does not revoke the token at Meta or erase old backups. Use Meta to revoke tokens that should no longer work.

Verification: `node tests/run-meta-tests.mjs` exercises encryption/tampering, scope binding, origin/input validation and mocked Meta responses. `python3 tests/meta-settings-smoke.py` tests local API protections with dummy credentials and then deletes them; it refuses to run if a connection is already saved and never contacts Meta. Browser visual validation and a real-account connection test are separate from these checks.

## Applying local migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
