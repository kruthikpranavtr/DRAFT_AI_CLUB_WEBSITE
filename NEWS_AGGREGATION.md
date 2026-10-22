# News aggregation: architecture, operations and handoff

## Status

Implemented in `DRAFT_AI_CLUB_WEBSITE` on `codex/automated-news-aggregation`, following the latest attached task's explicit target. This superseded the older experimental-only target for this task. No commit, push, merge, production database operation, service creation or deployment was performed. Existing logo/style changes were preserved; the experimental project remained clean on `feature/member-platform`. `main` still points to `7e411eb`.

**Not production-activated or production-verified.** Migration 002 was exercised only on disposable PostgreSQL-compatible databases. All provider switches default to off. Resolve the pre-existing development-config test mismatch and perform native PostgreSQL/staging acceptance before release.

## Existing functionality discovered

- React/Vite public News page: editorial hero, featured item, recent sidebar, card grid, category buttons, search and a story dialog. It consumed `/api/public/content?page=news`, mapping generic CMS entries. Demo fallback stories appeared with too few real posts.
- Existing manual content model: `content_entries`; generic administrator content CRUD; published/draft/hidden workflows; news capability `content:news`; session authentication, CSRF and Origin protection; activity audit logging.
- Backend uses Express and PostgreSQL through `server/db.js` / `server/pg.js`; SQLite is retained for legacy migration utilities. Existing PostgreSQL migration runner provides checksum verification, transaction rollback and an advisory migration lock.
- Railway configuration builds and runs the Express application. No Vercel application configuration was found in this checkout. No remote hosting configuration or live environment was changed or asserted to match the checked-in files.

## Architecture and behavior

`sources.json` reviewed allowlist → bounded/pinned HTTPS client → RSS/Atom parser → metadata validation/classification → canonical URL/external-ID deduplication → existing CMS entry plus `news_details` → category policy / administrator moderation → public News APIs.

- One reviewed provider initially: arXiv's official Atom API, metadata only. See [permission evidence](NEWS_SOURCES.md). It starts disabled. Other candidates cannot be enabled while unverified.
- The parser also supports RSS, but no unreviewed RSS source is enabled. Other authorized API formats require a format-specific adapter, rather than an unrestricted URL fetcher.
- Summaries are deliberately modest, original templates derived only from supplied metadata. No LLM, abstracts, complete articles, third-party images, publisher logos or author contact information are imported. Research is labeled as preprint metadata, not guaranteed peer-reviewed news.
- Canonical HTTPS URLs strip tracking fragments/parameters. arXiv version suffixes map to the same abstract page. Database constraints and transactional inserts prevent duplicates; repeated collection does not overwrite reviewed, rejected or hidden entries.
- AI/Technology auto-publication requires a reviewed, enabled source, valid metadata and category opt-in. Hackathons/events/opportunities always require human approval. Policies can disable AI/Technology auto-publication; manual posts retain explicit visibility controls.
- Unknown opportunity fields remain null/absent. Editors can record organizer, format, location, registration dates, event dates, eligibility, team size, prize, official registration URL and verification timestamp. Verified status requires a registration URL and verification timestamp. Dates are stored as ISO UTC, with local-time form controls. Expired registration and completed events are distinct. End/expiry drives archiving; registration expiry alone does not invent an event end. Administrators can override dates, archived state and automatic archiving.
- A shared five-minute run lease prevents normal overlapping workers, with a one-minute dispatch budget. Per-source reservations enforce six-hour minimum polling. Each request is bounded to 12 seconds and 1 MiB; DNS resolution to three seconds; retries to one with backoff. Longer Retry-After reservations are respected. Crashed runs become failed once a subsequent run observes their expired worker lease. Native PostgreSQL multi-process stress/failure validation remains required.
- Failure is recorded per run/source. A source outage does not prevent serving existing manual news. Logs are limited to 30 recent runs per administrator request, not silently discarded; a retention policy can be added later.

## Database

Additive migration: `server/migrations/pg/002_news_aggregation.sql`.

| Table | Purpose |
| --- | --- |
| `news_sources` | Runtime switches, editor/timestamps; legal approval and exact URLs remain in the reviewed server catalog |
| `news_category_policies` | Per-category publication policy |
| `news_details` | One-to-one FK extension of existing CMS content; source FK, URL/external-ID uniqueness, moderation, archive/feature flags, timestamps and opportunity metadata |
| `news_ingestion_runs` | Run status, actor, timestamps and structured source results |
| `news_ingestion_leases` | Shared worker exclusion and source request reservations |

Indexes support moderation, source lookup, categories/date sorting and recent-run history. No existing content was rewritten. Backup/restore includes the new tables in dependency order. Automated backup/restore verifies moderation metadata and run logs survive restoration, and migration tests verify legacy manual content remains intact.

The application now expects migration 002: do not start the changed API against an unmigrated normal database. Migrate a backed-up approved environment before switching its application code. No startup migration or destructive startup operation was added.

## Administrator controls

`/admin/news`, visible and accessible only with `content:news` (or existing Super Admin/domain-wildcard authority):

- Entries: search, moderation filter, pagination, create manual post, review/edit title/summary/category, approve/reject, publish/hide/draft, feature, archive, opportunity/deadline verification and delete confirmation.
- Sources: inspect permission references and attribution, enable reviewed providers, disable providers, manually collect.
- Publication policies: AI/Technology auto-publication switches; opportunity review remains mandatory.
- Collection history: recent run statuses, timestamps, inserted/duplicate/rejected counts and errors.

Aggregated publisher URLs are immutable through editing. Generic CMS updates to aggregated entries are rejected; News Management preserves moderation and attribution. Both public APIs hide disabled/unreviewed sources and unapproved entries. Disabling a source keeps its administrator records. Deleting an entry is permanent and allows future collection to rediscover it; reject/hide instead when retaining a moderation decision is desired.

## API surface

- `GET /api/public/news`: category/search/archive filter, bounded offset pagination, featured then newest sorting, safe metadata/attribution. Existing manual posts are included.
- Existing `GET /api/public/content` also applies collected-news moderation/source gates.
- `GET/POST /api/admin/news`, `PUT/DELETE /api/admin/news/:id`.
- `GET /api/admin/news/sources`, `PUT /api/admin/news/sources/:id` (enable/disable only; no arbitrary URLs or credentials).
- `GET/PUT /api/admin/news/policies`.
- `POST /api/admin/news/collect`, `GET /api/admin/news/runs`.
- `POST /api/internal/news/collect`: machine-only bearer authentication with `NEWS_CRON_SECRET`; no cookie/session authorization. It is mounted separately from browser CSRF handling. Existing browser mutations still require existing CSRF and Origin protections.

Inputs are validated and rendered as text, queries parameterized, admin actions audited, and collection endpoints rate limited. HTTPS fetching uses an exact reviewed URL and validated, pinned public IPv4 DNS result. Private/loopback/link-local/reserved addresses, credentials, unsafe protocols, redirects, DTDs/entities, invalid XML and oversized content are rejected. No external publisher page, image, PDF or registration URL is fetched by the collector.

## Public design

No public CSS, typography, branding or unrelated page redesign was introduced. Existing News hero/sidebar/cards/dialog classes remain. Necessary additions use that UI: category options, attribution/source links, deadline/verification/archive labels, pagination and explicit loading/empty/error/retry states. The old demo fallback was removed in favor of truthful empty/error states. The story dialog now focuses its close button, traps Tab and returns focus.

## Scheduler: approval required before setup

Use a **separate Railway cron service**, not an in-process interval or the web service itself. The opt-in `railway.news-cron.toml` sets the documented six-hour UTC schedule, runs `npm run news:collect`, exits when finished and does not restart continuously. Existing `railway.toml` and `.railway/railway.ts` are unchanged.

After code/migration release approval:

1. Back up the selected PostgreSQL environment using existing operational procedures (prefer a native `pg_dump` snapshot), restore it to an isolated native PostgreSQL instance and verify counts/FKs before migration. Existing production credentials must stay in the hosting secret store.
2. Run the existing PostgreSQL migration command against that explicitly selected, backed-up environment. It checksum-verifies and applies migration 002 transactionally. Do not apply the SQLite migration command or import over existing data.
3. Configure a new random server-side `NEWS_CRON_SECRET` of at least 32 characters on the API and the separate worker. The worker additionally needs `NEWS_API_ORIGIN` containing only the API's HTTPS origin. Neither variable uses a `VITE_` prefix. Do not place secrets in the catalog, source control, frontend responses or command arguments.
4. Create the separate cron service only after explicit deployment approval, selecting `railway.news-cron.toml` as its configuration file and leaving web health checks off for this finite worker. Do not replace the web service's start command.
5. In News Management, review the evidence and deliberately enable arXiv. Run once manually, inspect public attribution and the persisted run record, then verify an actual scheduled execution and failure alert in Railway before calling production automation working.
6. Confirm account plan, execution duration, reachability and outbound DNS/TLS in the actual environment. Re-review source terms and coordinate other controlled arXiv consumers' request rates.

The checked-in setup follows [Railway cron execution requirements](https://docs.railway.com/cron-jobs) and [config-as-code options](https://docs.railway.com/config-as-code/reference). It was not deployed or run on Railway. If deployment changes to Vercel, re-evaluate its scheduler authentication and execution limits instead of assuming a persistent server or copying this service configuration blindly.

## Verification results (2026-10-22)

- `npm test`: **45 passed / 1 failed / 46 total**. All **nine new news tests pass**: RSS/Atom, malformed/oversized XML, URL/DNS/allowlist, dates/classification, unknown/expired opportunities, additive migration/deduplication/leases/retries, API permission/CSRF/moderation/scheduler gates and complete news backup/restore.
- Existing failure: `test/development-config.test.js:22` expects experimental `.env.development` `VITE_WEB_PORT=5174`, but it is undefined in this original-project checkout. That test and environment file were not modified to mask it.
- Tests use a newly provisioned, disposable in-memory PGlite socket database with inherited database URLs overridden. No configured normal or production database is used. The PGlite socket emulator emitted an idle-client protocol warning after the existing backup/restore test; its assertions passed. No native PostgreSQL server was available locally; validate natively in staging.
- `npm run build`: passed. Existing unresolved font warnings: `hero-inter.woff2`, `hero-instrument-serif-italic.woff2`.
- `npm run lint`: exit 0, zero errors, 16 existing warnings; none from new news code.
- `git diff --check`: passed (a pre-existing shared-CSS LF/CRLF advisory may print).
- `npm audit`: two existing moderate findings in ExcelJS/transitive UUID; no new parser finding. No force downgrade or unrelated dependency repair was attempted.
- One live read-only arXiv request passed DNS/TLS/body parsing with 30 entries, with no persistence or publication.
- Actual in-app-browser QA on separate ports 5318/3318 and disposable data: administrator sign-in, unauthorized redirect, manual create, pending state, approve/feature/publish, reject/hide disappearing publicly, source controls with unverified providers disabled, authorized collect with sources off and persisted history, search, empty category state, load-more to all 26 initial fixtures without duplicate cards, dialog focus/Escape, mobile menu and logout/access denial.
- Layouts checked: 1440px desktop, 768px tablet, 390px mobile; no horizontal overflow observed. Home, Gallery and About headings/content rendered; their source files are unchanged. No warnings/errors were recorded in the inspected browser console logs.
- React review: independent admin requests parallelized; primitive effect dependencies; abort/timeout cleanup; query-scoped pagination reset and deduplication; stable entry IDs; labeled controls; native editor modal focus; safe text and validated external links; no client authorization or secret handling.
- QA cleanup completed: agent-created browser tabs closed, viewport reset, the two verified QA processes stopped, and ports 5318/3318 no longer listening. Only synthetic in-memory test data was discarded; the normal runtime and database were not replaced.

## Files in this feature (not unrelated pre-existing changes)

- Existing: `package.json`, `package-lock.json`, `server/app.js`, `server/routes/admin.js`, `server/routes/public.js`, `server/scripts/backup-restore-pg.js`, `src/App.jsx`, `src/components/DashboardShell.jsx` (news nav only; existing logo edit retained), `src/pages/NewsPage.jsx`.
- Added: `server/migrations/pg/002_news_aggregation.sql`; `server/news/{catalog.js,sources.json,fetch.js,normalize.js,service.js,routes.js,scheduler.js}`; `server/scripts/{collect-news.js,run-isolated-suite.js,news-browser-qa.js}`; `shared/news.js`; `src/lib/useNews.js`; `src/pages/AdminNewsPage.{jsx,css}`; `test/{news.test.js,news.integration.test.js,news-backup.test.js}`; `railway.news-cron.toml`; `NEWS_SOURCES.md`; this document.

Pre-existing changes left intact: logo assets and edits in Navbar, PortalAuth, InnerCommon, InnerPages CSS, global CSS, ForgotPasswordPage and the sidebar logo. They are not news-feature changes.

## Remaining approvals / limitations

Not an unconditional production-readiness sign-off. Required: resolve/approve the legacy config-test discrepancy, native PostgreSQL migration/restore/concurrency acceptance, production source/permission review, backup+migration release approval, scheduler secret provisioning/service deployment and actual scheduled-run verification. No approved hackathon/organizer feed is currently configured; administrators can create verified manual opportunities. No deployment resources or paid services were provisioned.


## Verification update: RAGUL native PostgreSQL (2026-10-22)

This follow-up **supersedes the earlier 45/46 test result and configuration-test blocker** recorded above. All work occurred on `codex/automated-news-aggregation` on RAGUL; no other Desktop Commander device was used.

- Reproduced the existing `test/development-config.test.js` failure. It expected optional `VITE_*` variables and experimental SQLite/upload paths from a different worktree. Corrected the test to validate the original checkout's Vite defaults, PostgreSQL endpoint, API ports and CORS allowlist. The configured database, source files for the existing logo and development `.env` were not changed.
- Created a **disposable native PostgreSQL 16 schema-only clone** of `aiclub_db`. No normal user, student or admin records were copied. Seeded synthetic manual news only in the disposable database.
- Ran migration 002 through the real PostgreSQL migration runner with **two concurrent migration attempts**; version 002 applied exactly once, repeat application was a no-op, and the existing synthetic CMS record was byte-for-byte preserved. Verified five news tables, foreign keys, policy defaults and **six source switches disabled**.
- Exercised **16 simultaneous native PostgreSQL inserts** of the same normalized article (one inserted, fifteen duplicates) and simultaneous collection workers (one ran, one skipped, only one mocked fetch; subsequent source polling correctly skipped). Verified persisted collection history and released collection lease. No live third-party request was needed.
- Added the guarded reusable script `server/scripts/verify-news-native-pg.js`, which refuses to run unless `DATABASE_URL` points to a local, explicitly named `aiclub_news_qa_*` database on port 5434.
- **All 46 tests passed**, including all nine news tests (`npm test`). `npm run build` succeeded with the two previously noted missing-font warnings. `npm run lint` returned **zero errors and 16 existing warnings**.
- **Cleanup verified:** the disposable PostgreSQL database and its schema dump were deleted. Normal `aiclub_db` remains on migration version **1**, without any `news_details` table; none of its content was migrated or changed by this QA.
- No news sources enabled in the normal database. No code commit, push, merge, scheduler activation or deployment.

**Still required for release:** an approved backup and full representative PostgreSQL staging restore/migration, staging API and browser acceptance with backed-up data, source permission sign-off and deliberate activation, cron credentials and actual Railway scheduled-run verification. A schema-only clone is strong native SQL/concurrency validation but is **not** a full production-like staging sign-off.


## Official feed expansion / final local verification (RAGUL, 2026-10-22)

The original one-source statement earlier in this document is superseded by the detailed source review in `NEWS_SOURCES.md`. Three additional official, narrowly reviewed metadata feeds are now configured: NASA Technology, NIST Information Technology, and NIST Events. They use exact official RSS URLs, publisher-host allowlists, independent summaries and appropriate source attribution; third-party article bodies, copyrighted media and images are not imported.

Added migration **003_reviewed_news_sources.sql**, which inserts the three new switches as disabled and preserves any pre-existing administrator settings. The normal project's `aiclub_db` is **not migrated**, remains at version 1, and has no news tables. **Nothing was enabled, deployed or published.** A separate Railway schedule remains opt-in and unconfigured.

Event feed entries are fixed to `Events and Opportunities` and always require approval. NIST RSS event `pubDate` is treated as a scheduled event start and stored in `opportunity.startDate`; the first-collection timestamp is used as the listing's discovery timestamp. Eligibility and registration information remain unverified until an administrator reviews the original event page. No deadline/end date is invented. This prevents AI-themed events from being accidentally published as general AI news.

Live read-only feed checks on RAGUL, with pinned-address SSRF protection and no persistence: NASA 10/10 entries accepted; NIST Information Technology 36/40 (four invalid/incomplete entries rejected); NIST Events 28/28. The DNS address range checks were corrected to allow a legitimate NASA CDN public IPv4 address without permitting RFC test networks and reserved/private ranges.

Tests: **52/52 automated tests pass**, including five new source unit tests and a full public API integration test. They cover allowlisting, default-disabled switches, category pinning, event moderation and dates, DNS ranges, technology publication, event privacy, and immediate public hiding when a source is disabled. Integration tests clean up their own synthetic records and reset temporary source switches so other scheduler/auth tests remain isolated. The additive migrations **002 and 003** and concurrent collection/deduplication checks passed on a disposable **native PostgreSQL 16 schema-only clone**. That temporary database and its dump were removed; normal database was verified unchanged at version 1.

Remaining production tasks: approve backed-up staging migration and end-to-end UI testing; assess individual-source reuse/attribution and activate approved sources deliberately; provision the separate Railway cron service with server-only credentials and verify a real scheduled execution; find permitted hackathon feeds or continue manual moderation. No Git commit/push/merge, no other worktree changes and no production changes.
