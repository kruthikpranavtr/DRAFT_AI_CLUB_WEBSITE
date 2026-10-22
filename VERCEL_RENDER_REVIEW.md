# AI Club — Vercel frontend + Render backend preparation

**Local-only preparation. No commits, pushes, database migrations, Render resource creation, or deployments authorized by this step.**

Deployment branch: `deploy/render-preserve-data-20261022` on RAGUL. Frontend is Vite/React; Express API and session endpoints remain on Render with a persistent PostgreSQL database and durable S3-compatible media storage.

## New config

`vercel.json` builds the frontend and rewrites all `/api/:path*` requests to the Render Express backend. Remaining browser paths are routed to `/index.html` for React Router deep links. **The Render destination is a deliberately invalid placeholder** (`REPLACE_WITH_APPROVED_RENDER_HOST.onrender.com`). Replace it only after approving a verified Render service hostname. Do not deploy with this placeholder.

## Auth and API notes

The frontend uses relative `/api` paths with `credentials: 'include'`. Authentication and CSRF cookies currently use `SameSite=Strict` and `Secure` in production. With the Vercel same-origin reverse proxy rewrite, the browser sees responses at its Vercel origin; this is preferable to changing cookies to cross-site mode. Test response `Set-Cookie` behavior, login/session persistence, CSRF validation, uploads, downloads, streaming video, and origin checks with the actual staging domains before approving release. Do not hardcode a cross-origin API base into browser JavaScript.

The Render service uses `render.yaml` with auto-deploy disabled and startup preflight. It will require an existing restored database, verified admin, migrations 001–003 and persistent object storage. Render resources are NOT yet provisioned.

## Blocking items before release

1. Confirm the authoritative source of real website user accounts and content. Railway still cannot be accessed; the verified RAGUL backup may be incomplete relative to production.
2. Confirm a secure media backup and recovery strategy, and establish S3-compatible object storage.
3. Restore verified backup into approved Render PostgreSQL, apply approved migrations only there, verify row counts and media keys.
4. Review all existing tracked and untracked code/UI/news changes on the branch. Do not include unrelated material by accident.
5. Provision Render API service, verify its actual hostname and health, and replace the deliberately invalid `vercel.json` target.
6. Review Vercel account scope and target project. Stage a preview against Render staging, then test login, CSRF, Community, News, CMS, assessments, uploads/downloads and deep links.
7. Approve production cutover only after source data reconciliation and rollback planning.

## Testing

Validate configuration syntax with Node JSON parse and URL checks; run `npm test`, `npm run build`, `npm run lint`, and `git diff --check`. Success does not prove the yet-unavailable Render API proxy is operational.
