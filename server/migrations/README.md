# Database migrations

Migrations are ordered, immutable SQL files. Their names and SHA-256 checksums are
recorded in `schema_migrations`. Never edit an applied migration; add a new numbered
file instead.

Before applying pending migrations to an existing database, the runner creates a
consistent SQLite `VACUUM INTO` backup, restores it to a temporary verification copy,
compares tables and row counts, and runs integrity and foreign-key checks. Migration
execution stops if backup verification or a checksum check fails.

Commands:

- `npm run db:backup` creates and verifies a manual backup without migrating.
- `npm run db:migrate` applies pending migrations and reports the verified backup.
- `npm test` exercises migration preservation and idempotency against temporary data.

Backups default to `server/data/backups`, which is excluded from Git. The experimental
development configuration uses `server/data/member-platform-backups` and the npm
database scripts load that configuration. Set `MIGRATION_BACKUP_DIR` to use another
durable location. A real recovery drill should
restore the selected backup to a separate path, validate it, and only then replace a
stopped application's database under explicit operator approval.
