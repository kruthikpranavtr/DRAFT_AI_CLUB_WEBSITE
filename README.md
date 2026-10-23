# AI Club member platform

React + Vite frontend, Express API, and PostgreSQL storage (with embedded PGlite for portable demos). Student and administrator access is determined by the server after a single sign-in.

## Clone the current feature-complete preview

The latest Student/Admin Portal, assessment publishing and conditional visibility, AI Club website assistant, enlarged **animated panda chatbot** (including the original `public/images/panda-chatbot.gif`), and updated login illustration are versioned on branch `deploy/render-preserve-data-20261022`.

To get **these exact features** on another computer:

```sh
git clone --branch deploy/render-preserve-data-20261022 --single-branch https://github.com/kruthikpranavtr/DRAFT_AI_CLUB_WEBSITE.git
cd DRAFT_AI_CLUB_WEBSITE
npm ci
npm run demo:dev
```

Open **http://localhost:5175/**. This launches the self-contained demonstration environment. The GIF, artwork and code are included in Git, so there is no need to copy assets separately. Use the demo account details below.

If you have already cloned this branch, update it with `git pull --ff-only origin deploy/render-preserve-data-20261022`.

**Important:** A plain `git clone` checks out the GitHub default `main` branch, which is intentionally not yet promoted to this feature branch. The pending production database/media cutover must be approved before making `main` the live release. Git does **not** transfer actual student accounts, passwords, uploaded private documents, or a local database; the demo creates separate example data. Production and shared-preview backend services need their own approved data and backend deployment before their new features can work against real accounts.

## Try the project on any computer

```sh
npm install
npm run demo:dev
```

Open **http://localhost:5175/login** and use either fixed demonstration account:

| Role | Login identifier | Password |
| --- | --- | --- |
| Admin | `DEMO-ADMIN` | `DemoAdmin@2026!` |
| Student | `DEMO-STUDENT` | `DemoStudent@2026!` |

Demo mode creates a dedicated embedded PostgreSQL-compatible local database with the same mock credentials on every installation, including a sample MCQ assessment. It does not overwrite local member accounts or use the original site's database. No shared central account or shared results database is involved. **Do not expose or deploy these public credentials.**

Run `npm run demo:setup` to create the demo accounts without starting the servers. See [demo account setup](docs/demo-accounts.md) for details, supported ports and safeguards.

## Development and quality checks

Normal development uses the separate `.env.development` configuration (copy and configure `.env.example` if needed), then run `npm run dev`.

```sh
npm test
npm run build
npm run lint
```

The member platform is under development; do not use the demo environment for real student data.
