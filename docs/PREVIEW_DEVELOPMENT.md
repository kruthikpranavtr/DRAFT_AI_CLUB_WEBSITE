# AI Club shared preview: sign-in and saved changes

This document applies to the **disposable Render/Vercel preview only**. Do not use these instructions to connect to or modify the original Railway production database.

## One consistent website

Open **https://ai-club-frontend-preview-soloclear.vercel.app/login** on a browser. Save that address as the bookmark and use it consistently.

Old numbered Vercel deployment URLs are immutable snapshots. Refreshing an older snapshot does not deploy newer code. A newer tested frontend release must be assigned to the stable preview alias for new website changes to appear there.

Accounts and content created through this preview are stored in the shared PostgreSQL preview database, not in Vercel's frontend files. Normal frontend/backend redeployments do not reset those records. Site content changes must be saved using their form's Save or Publish action; editing source code locally requires building/deploying a new frontend release.

## Remembered login

On the login page, leave **Keep me signed in on this device** checked. A remembered session uses a secure, HTTP-only cookie valid for up to **30 days**, surviving refreshes and browser restarts. Sign out, clear browser cookies, use a different site address/browser, change/reset your password, or allow the session to expire, and you may need to sign in again.

The stable website and localhost are **different browser origins**. They share preview accounts and saved database records, but each requires one separate initial sign-in on that device.

## KRUTHIKPRANAV local development using the shared preview

On KRUTHIKPRANAV's machine:

1. Create the ignored `.env.preview-local` file with:
   ```text
   VITE_WEB_HOST=127.0.0.1
   VITE_WEB_PORT=5174
   VITE_API_ORIGIN=https://ai-club-api-preview.onrender.com
   ```
2. From the project root run `npm run dev:preview`.
3. Open **http://localhost:5174/login**. If the old `127.0.0.1` link is opened in this mode, the browser redirects automatically to `localhost` because secure cookies cannot be relied on at the numeric loopback hostname.
4. Sign in once using an existing preview account, then create/edit records using the Admin UI. They are saved in the *shared preview* database and also visible at the stable Vercel preview link after refresh.
5. Local JSX/CSS changes appear via Vite immediately on localhost but do **not** change a deployed Vercel snapshot until the branch is deployed. Avoid storing passwords inside source code, scripts or Git.

`npm run dev` uses `.env.development` and a **different localhost PostgreSQL backend**. `npm run demo:dev` uses the **separate portable demo database** and demo-only accounts. Data from either mode does not automatically sync to Render.

## Data retention

The Render preview database is currently on a **free plan with an expiry of November 21, 2026**. Account and content records do not persist beyond deletion or expiry of that database. Plan and verify a PostgreSQL backup and upgrade/migration before expiry for long-term retention. Never copy login passwords to GitHub. Use individual creator accounts and a password manager.
