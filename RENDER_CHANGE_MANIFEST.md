# Render deployment branch — change review manifest

Branch: `deploy/render-preserve-data-20261022` (local only; no commits). Base: `main` at `7e411eb`.

## Existing uncommitted work carried forward unchanged

- **News backend and database:** `server/news/*`, `shared/news.js`, `server/migrations/pg/002_news_aggregation.sql`, `003_reviewed_news_sources.sql`, news scheduler/collection and QA scripts, and updates to `server/app.js`, public/admin routes, backup/restore table list.
- **News UI:** `src/pages/NewsPage.jsx`, `src/pages/AdminNewsPage.jsx` and CSS, `src/lib/useNews.js`, `src/App.jsx`, dashboard navigation, and news documentation.
- **Site/UI changes:** Navbar, dashboard, login and forgot-password components, common inner pages/styles, and `public/ai-club-new-logo.png` plus `public/ai-club-new-logo1.png`. Preserve these changes; do not silently replace or omit them.
- **Tests and dependencies:** `package.json`, `package-lock.json`, `test/development-config.test.js`, `test/news*.test.js`, and existing news integration tests.
- **Existing Community and assessment functionality:** already in the base repository; not reimplemented or merged from the separate `feature/member-platform` worktree.
- **Railway news cron proposal:** `railway.news-cron.toml` is present as an untracked file but has **not** been activated. It is not used by the Render Blueprint.

## New preparation files (this branch only)

- `render.yaml`: preview web-service definition for the current deployment branch, Singapore region, free preview tier, auto-deploy **off**, no managed database or cron creation, secret placeholders, health check, and startup gate.
- `server/scripts/render-preflight.js`: read-only production startup validation of destination host, existing schema versions, existing administrator/content, and durable media settings. Fails closed rather than booting with a missing/unrestored database.
- `RENDER_DEPLOYMENT_REVIEW.md`: full backup, media, restore, environment, acceptance, cutover and rollback checklist.
- `RENDER_CHANGE_MANIFEST.md`: this review inventory.

## Verification and review gates

- `npm test`: 52 passed, 0 failed on RAGUL. Test runner uses an isolated ephemeral database.
- `npm run build`: passed; existing unresolved font URL warnings remain.
- `npm run lint`: passed with 16 warnings, 0 errors.
- `node --check server/scripts/render-preflight.js`: passed.
- Preflight without a configured destination database: intentionally exits nonzero without connecting to or modifying the local database.
- `render.yaml`: parsed as YAML on RAGUL; auto-deploy/preview-generation fields are quoted `"off"`.
- `git diff --check`: passed for tracked changes.
- Existing PostgreSQL on RAGUL: schema migration 001 only; **no migrations applied**.
- Render workspace: no services or Postgres databases; **no cloud resources created**.

## Not yet reviewed or authorized

The entire combined code diff (including all untracked files), a verified authoritative-source PostgreSQL backup, a separate media backup with manifest, a staging restore, production source permissions, secrets, persistent object storage, and final browser acceptance. Do not stage, commit, push, merge, migrate, restore, create cloud resources, or deploy until authorized.

## Isolated backup restoration verification — 22 October 2026

- Existing verified local archive restored into separately created disposable RAGUL PostgreSQL database `aiclub_render_review_20261022` using `pg_restore` without overwrite.
- Post-restore row-count comparison against local source succeeded: users 2, content_entries 12, files 1, community_posts 1.
- Applied migrations 002 and 003 **only inside the disposable review database** using the actual migration runner; it reached versions 001, 002, 003.
- Row counts remained unchanged after those migrations.
- Original RAGUL database remained at schema version 001; no source data was modified.
- Railway production data remains unverified; the local archive is not yet authorized for production cutover.
