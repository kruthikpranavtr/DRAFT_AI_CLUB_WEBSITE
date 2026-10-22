# AI Club — dedicated LOGIN PREVIEW setup (NOT production)

This plan targets only Render free web service `ai-club-api-preview` and PostgreSQL instance `dpg-dbcu193ncjis73dl38mg-a` / database `ai_club_preview_db`. The frontend is `ai-club-frontend-preview` on Vercel. Railway, GitHub main, and the original RAGUL database must remain unchanged.

## Already completed
- Render build: Node 22.12.0 and `NPM_CONFIG_INCLUDE=dev` give a successful Vite/Node build.
- Explicit opt-in script `server/scripts/initialize-render-preview.js` can initialize **only** the named Render database **when its public schema is empty**. The normal preflight does not create records or migrate any database.
- Initializer applies migrations 001–003, creates two dedicated accounts from secure Render environment variables and seeds public placeholder site content. On future startups it only verifies expected tables/accounts and performs no writes.
- Preview blocks `multipart/form-data` writes, because Render free disk does not persist uploaded media. Real media uploads and true production data are NOT supported in this login-only preview.

## Required Render environment keys
- `DATABASE_URL`: obtain the **Internal Database URL** from [Render preview database](https://dashboard.render.com/d/dpg-dbcu193ncjis73dl38mg-a) and add it directly under [Render preview API service → Environment](https://dashboard.render.com/web/srv-dbcu44eq1p3s73dans8g). Never paste this URL into a chat or Git.
- `RENDER_EXPECTED_DB_HOST=dpg-dbcu193ncjis73dl38mg-a` — explicitly approved preview destination.
- `NODE_ENV=production`, `NODE_VERSION=22.12.0`, `NPM_CONFIG_INCLUDE=dev`, `AI_CLUB_PREVIEW_MODE=1`, `AI_CLUB_PREVIEW_BOOTSTRAP=fresh-preview-only`.
- `BOOTSTRAP_ADMIN_ID=PREVIEW-ADMIN-01`, `BOOTSTRAP_ADMIN_EMAIL=preview-admin@example.invalid`.
- `BOOTSTRAP_STUDENT_ID=PREVIEW-STUDENT-01`, `BOOTSTRAP_STUDENT_EMAIL=preview-student@example.invalid`.
- `BOOTSTRAP_ADMIN_PASSWORD` and `BOOTSTRAP_STUDENT_PASSWORD`: unique random values. They are kept in a local file outside the repository and set in Render environment, **not in Git**.
- `ALLOWED_ORIGINS`: include the exact HTTPS Vercel preview domain in addition to any other authorized preview aliases. No wildcard origins.
- `PG_REJECT_UNAUTHORIZED=false` **only on this isolated preview backend**: Render internal PostgreSQL's self-signed TLS certificate cannot be CA-verified by this Node client. This retains encrypted transport; `server/pg.js` refuses the exception unless the preview mode and expected private DB host both match. Never use this flag on the real production database.

The URL must refer specifically to `ai_club_preview_db`. The initializer compares the URL hostname against the authorized Render instance ID and expected host, and refuses to initialize any other database. Existing/partially populated databases are not rewritten, dropped, or truncated.

Once the Render URL is configured, deploy the existing preview branch manually and verify `/api/health`; test `/api/auth/csrf`, login, session, permissions, and Vercel reverse proxy with both dedicated accounts. The database free plan expires **2026-11-21**. DO NOT store real user data, real documents, or sensitive media on this temporary preview.

## Important caveats
- A successful frontend build does not prove login works. Verify both admin and student authentication over the Vercel origin before sharing credentials.
- Normal production preflight remains intentionally strict: requires an existing verified backup restore, admin, content, and durable S3 storage.
- Render MCP currently does not expose the Postgres connection string through its database inspection call; copying the Internal Database URL in Render dashboard is a required user action. Never attempt to guess or reconstruct database secrets.
- This is **not a migration or cutover** from Railway. Existing accounts/posts are not available in the separate preview.
