# Portable demo accounts — AI Club member platform

These accounts are **fixed mock identities**, reproducible on Windows, macOS, and Linux. They are not accounts in a shared cloud service: each computer runs a separate demo database with the **same identifiers and passwords**. Test attempts and scores do not synchronize between computers.

## One-command test environment

1. Clone the project (once the assessment and demo changes are committed and pushed) and run `npm install`.
2. Run `npm run demo:dev` from the project directory.
3. Open **http://localhost:5175/login** and sign in using either account below.

| Role | Login ID | Password | Alternative login |
| --- | --- | --- | --- |
| Administrator | `DEMO-ADMIN` | `DemoAdmin@2026!` | `demo.admin@aiclub.test` |
| Student | `DEMO-STUDENT` | `DemoStudent@2026!` | Student ID only |

Both accounts are active without first-login password changes; the administrator has Super Admin permissions to test the assessment builder, question bank, and grading; the demo student has academic year 2 so they can take the preloaded **Demo — AI Fundamentals Quiz**. Sample questions, an active MCQ assessment, and published question snapshots are included automatically. The same demo credentials are printed in the terminal and displayed on the **demo login screen only**.

`npm run demo:setup` creates or verifies the two accounts without starting servers. Running setup again is safe: it does not duplicate accounts, question banks, assessments, or attempts. It restores the documented demo passwords if a tester changed them. Use `npm run demo:dev` to seed and start the demo frontend and API in one command.

## Isolation and safeguards

- Demo frontend: `http://localhost:5175`; demo API: `http://localhost:3003`.
- Demo database: `server/data/ai-club-portable-demo.db`; demo uploads and backups are separate.
- Normal experimental frontend (`5174`), API (`3002`), and database are not modified by demo setup.
- Generated `.env.demo`, databases, uploads and secrets are excluded from version control via `.gitignore`.
- These **public, deliberately weak demo passwords** are unsuitable for actual club members or deployment. Demo setup refuses `NODE_ENV=production`; production authentication rejects `DEMO-` member IDs.
- The original `DRAFT_AI_CLUB_WEBSITE` project is not modified.
- Do not expose the demo server on a public network or production host. It is bound to loopback for local testing.

For the real platform, continue using unique administrator-provisioned student identities and proper credentials. Using the same demo credentials on different installations does **not** imply shared accounts in a centrally hosted database.
