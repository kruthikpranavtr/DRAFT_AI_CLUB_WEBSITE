# AI Club Member Platform — PostgreSQL Deployment & Operations Guide

This guide covers local development, managed deployment on Railway, security best practices, and operational recovery procedures.

---

## 1. Local Development Setup (Windows)

### 1.1 Install PostgreSQL
Use the Windows Package Manager in PowerShell (Admin):
```powershell
winget install PostgreSQL.PostgreSQL --source winget
```
Alternatively, download the official Windows installer from [EnterpriseDB](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).

### 1.2 Create the Database
```powershell
& "C:\Program Files\PostgreSQL\17\bin\createdb.exe" -U postgres aiclub_db
```

### 1.3 Configure Local Environment
In your `.env.development`:
```ini
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/aiclub_db
DATABASE_SSL=false
PG_POOL_MAX=20
```

### 1.4 Run Migrations
```powershell
npm run db:pg:migrate
```

### 1.5 Migrate Existing SQLite Data (Optional)
To import historical data from your existing SQLite database snapshot:
```powershell
# Preflight check without writing
node server/scripts/migrate-sqlite-to-pg.js --dry-run

# Execute data copy and integrity verification
node server/scripts/migrate-sqlite-to-pg.js
```

---

## 2. Railway PostgreSQL Managed Deployment

### 2.1 Provision Database on Railway
1. In your Railway project, click **New** &rarr; **Database** &rarr; **Add PostgreSQL**.
2. Railway automatically provisions a managed PostgreSQL instance and injects the `DATABASE_URL` environment variable into your linked backend service.

### 2.2 Configure Backend Environment Variables
In your Railway backend service settings, ensure the following are defined:

| Variable | Recommended Value | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Managed connection string (injected automatically). |
| `NODE_ENV` | `production` | Enables production security policies and secure cookies. |
| `PG_POOL_MAX` | `20` | Bounded pool connection limit. |
| `PG_REJECT_UNAUTHORIZED` | `true` | Validates TLS/SSL certificates on production connections. |
| `PORT` | `3002` (or Railway default) | HTTP server port. |
| `ALLOWED_ORIGINS` | `https://your-frontend-domain.com` | Strict CORS origin verification for API calls. |
| `MAX_UPLOAD_BYTES` | `104857600` | Maximum upload size (100 MB). |

### 2.3 Railway Configuration (`railway.toml`)
The repository includes a production-ready `railway.toml`:
```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm ci && npm run build"

[deploy]
startCommand = "npm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 120
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5
```

---

## 3. Security & Operational Hardening

### 3.1 Connection Security
* All production connections require TLS/SSL.
* `DATABASE_URL` must **never** be committed to Git or exposed via `VITE_` frontend variables.
* The connection pool uses bounded limits (`PG_POOL_MAX=20`) to prevent exhaustion of PostgreSQL connection slots.

### 3.2 Persistent File Storage
* Railway app containers have ephemeral disks.
* Profile avatars, community images, and attachments should use S3-compatible cloud storage in production:
  * Configure `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`.
  * The storage abstraction in `server/storage.js` seamlessly stores files in the bucket while retaining metadata in PostgreSQL.

---

## 4. Backup & Disaster Recovery

### 4.1 Creating a Backup (`pg_dump`)
### 4.1 Native PostgreSQL Backup (`pg_dump`)
Run a compressed binary dump of your database:
```powershell
pg_dump -Fc -d "postgresql://user:password@host:port/database" -f "aiclub_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"
```
Or with host/port parameters:
```powershell
pg_dump -h 127.0.0.1 -p 5432 -U postgres -d aiclub_db -F c -b -v -f "aiclub_backup.dump"
```

### 4.2 Native PostgreSQL Recovery (`pg_restore`)
Restore to a clean database target:
```powershell
pg_restore -h 127.0.0.1 -p 5432 -U postgres -d aiclub_db --clean --if-exists -v "aiclub_backup.dump"
```

### 4.3 Node.js Application Backup & Production Safeguard
The application provides programmatic JSON backup and restore with foreign-key topology:
```powershell
# Create full application JSON backup
node server/scripts/backup-restore-pg.js backup

# Restore from backup file (Safeguarded against accidental production execution)
node server/scripts/backup-restore-pg.js restore path/to/backup.json
```

> [!CAUTION]
> **Production Restore Protection:**
> To prevent catastrophic data loss, `backup-restore-pg.js` actively checks `NODE_ENV`. If running in production (`NODE_ENV=production`), all restore commands fail immediately with `Error: Refusing to restore into a production database without explicit override.`
> To override intentionally during disaster recovery, set `ALLOW_PRODUCTION_RESTORE=true`:
> ```bash
> ALLOW_PRODUCTION_RESTORE=true node server/scripts/backup-restore-pg.js restore backup.json
> ```

### 4.4 Separate Durable Backup Strategy for Uploaded Media
Database dumps (`pg_dump` or `backup-restore-pg.js`) store relational metadata and attachment references, but **NOT** the physical binary files on disk or in S3.

1. **Local Media Backups (`member-platform-uploads`)**:
   - The CLI provides dedicated media archiving:
     ```powershell
     node server/scripts/backup-restore-pg.js backup-media
     node server/scripts/backup-restore-pg.js restore-media path/to/media-archive
     ```
   - Every file is indexed with SHA-256 checksums in a `manifest.json` to detect corruption or tampering.
2. **Cloud Object Storage (S3 / R2 / Railway Bucket)**:
   - Configure S3 bucket versioning to retain past versions of uploaded assets.
   - Configure lifecycle rules for staged temporary uploads.
   - Enable Cross-Region Replication (CRR) for production disaster recovery.

### 4.5 Automated Backups on Railway
Railway PostgreSQL provides daily automated snapshots and point-in-time recovery in the **Data** tab of the Railway dashboard.

