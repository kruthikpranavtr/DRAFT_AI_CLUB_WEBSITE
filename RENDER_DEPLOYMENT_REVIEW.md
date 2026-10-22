# AI Club — Render deployment review (RAGUL)

**Status: preparation only. Not approved for migration, push, or deployment.**

Local Git branch: `deploy/render-preserve-data-20261022` (based on `main` at `7e411eb`). Existing news, website, community, admin and logo edits remain **uncommitted**. No changes were made to `main`, GitHub, the other worktree, Render resources, or any source/destination database.

## Architecture and safety boundaries

- Render will host **one Node.js web service**: `npm ci && npm run build` followed by `node server/scripts/render-preflight.js && npm start`. The existing Express server serves `dist` and `/api/*` on Render's `PORT`.
- `render.yaml` defines **only** the preview web service. It creates **no PostgreSQL database, cron job, storage bucket or migration**. The Render workspace currently contains no web services or PostgreSQL databases.
- The Blueprint uses Singapore, a free **preview-only** instance, `autoDeployTrigger: off`, and disabled preview generation. Do not enable Blueprint auto-sync, trigger any deployment or connect the branch to production until this review is signed off.
- The source-of-truth database is **not yet identified or backed up**. RAGUL's local PostgreSQL `aiclub_db` has schema version 001 only. It must **not** be mistaken for the Railway production database. Confirm whether the latest real data resides in Railway, a different host, or local RAGUL before making any copy.
- The project uses persistent PostgreSQL data plus files/media. **Database backup alone does not preserve uploaded photos and documents.** Render free web-service disk is ephemeral; production media requires durable S3-compatible object storage or an approved persistent-disk architecture.
- News collection sources remain disabled. No Render cron job is configured; the website will not automatically fetch external news until separately authorized.

## Required review before any push, migration or deploy

1. **Identify authoritative source:** confirm the original production database host and version, current user/content/community/news counts, and whether users have been writing to it. Do not use the local database as a surrogate without explicit confirmation.
2. **Inventory media:** identify existing upload directory or S3 bucket; enumerate CMS files, gallery, community media/variants, profile images, and videos. Confirm how each database `storage_key` resolves and whether `MEDIA_FALLBACK_BASE_URL` is required. Avoid copying private uploads into Git.
3. **Create protected backup after authorization:** use `pg_dump` in PostgreSQL custom format for the full source database (schema + data, including `schema_migrations`). Capture version, file size, SHA-256 digest, and `pg_restore --list` verification without disclosing data. Independently back up media and create a checksum manifest. Store both outside Git, under restricted access; avoid displaying URLs/passwords in logs.
4. **Verify restore in isolated staging:** create a fresh private Render PostgreSQL destination **only after approval**. Restore to an empty database without truncating the source. Verify row counts and relationships, passwords/sessions handling, CMS/gallery/community records, and media checksum/key mapping. Confirm whether source migrations 002 and 003 should be applied **after** the source backup is restored. Re-run migrations only with explicit approval and verified backups.
5. **Cutover integrity:** arrange a short write-freeze or a final incremental backup/reconciliation so data written after the initial backup is not lost. Validate admin identity and media before switching traffic.
6. **Secrets and security:** set `DATABASE_URL` to the **destination** Render database only; set `RENDER_EXPECTED_DB_HOST` to its exact hostname, and `BOOTSTRAP_ADMIN_ID`/`BOOTSTRAP_ADMIN_EMAIL` to an administrator already present in the restored database. Configure `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` for persistent media. Verify TLS/certificate settings for the chosen PostgreSQL connection. Never commit `.env`, passwords, tokens or backup files.
7. **Source review and code release:** review all tracked and untracked code and logo changes; run `npm test`, `npm run build`, `npm run lint`, and inspect `git diff --check`. Commit to the deployment branch **only after approval**, push it to GitHub, review a PR, and deploy a protected preview **only after backup/restore sign-off**.
8. **Browser acceptance:** check `/api/health`, frontend deep links, admin/student login, role boundaries, community posts and images, CMS edits, gallery, file download, assessments, News moderation, and public filtering. Verify persistent uploads survive service restart and that no external news feeds or scheduled jobs activate unexpectedly.
9. **Production approval:** decide paid compute/storage plan, database retention/backup policy, rollback plan, domain/DNS, maintenance window, monitoring, and permission to cut over. Preserve old Railway data until the new service is proven stable.

## Render startup guard

`server/scripts/render-preflight.js` is **read-only**. It refuses startup if the environment is not production, demo/SQLite mode is enabled, database URL/approved destination host do not match, HTTPS S3 storage settings are missing, schema migrations 001–003 are absent, the reviewed admin identity is missing, or the content table is empty. It does **not** copy data, seed users, run migrations or check source backups. After it passes, the existing server startup **does** run `seedDatabase()`, which can insert missing default content. Review this behavior before first deployment.

**Important:** a passing startup guard is not proof that all rows, uploaded media, or credentials have been restored correctly. Compare backup manifests and perform staging acceptance first.

## Data-preservation risks and unresolved dependencies

- The connected Render workspace is new and empty; no destination database or durable object storage exists yet.
- Railway connection is currently unavailable; its database contents and existing backups have **not** been inspected.
- The local `aiclub_db` has 25 tables and schema migration 001 only, whereas the news feature requires 002 and 003. Read-only local inventory: 2 users, 12 content entries, 1 file record and 1 community post. These counts do **not** establish what is currently in Railway or another production database.
- A **RAGUL-local precautionary backup** was created at `server/data/backups/pg/render-preparation-20261022-152022/`: PostgreSQL custom-format dump (76,863 bytes, SHA-256 recorded in `local-backup-manifest.txt`), plus a ZIP containing 3 local upload files with a reported SHA-256 digest. The database dump passed `pg_restore --list` structural verification. This snapshot is **not** a verified Railway production backup and has not been test-restored. It remains inside the ignored local backup folder; do not add it to Git. The Railway/production backup is still mandatory before migration or cutover. The S3 adapter expects keys in the `storage_key` column; existing local file keys must be migrated into object storage **without changing lookup semantics**, or an explicit tested mapping must be made.
- Existing media and account sessions may need special handling at cutover; test login, uploads, deletion and thumbnails against restored data.
- The free Render plan is for preview only, not a promise of always-on production hosting.
- Do not run `npm run db:pg:migrate` unchanged on Render: that script loads `.env.development` and could target the wrong database. Use a reviewed, explicit destination-only migration command when authorized.
- Avoid `server/scripts/backup-restore-pg.js` restore on an unreviewed destination: it uses `TRUNCATE ... CASCADE`. The standard `npm run db:backup` script is for legacy SQLite, not PostgreSQL.

## Current review decision

**GO for local preparation and testing only. NO-GO for pushing, creating services/databases, migrating, restoring, switching DNS, or deploying** until the source backup and full code diff have been reviewed and approved.
