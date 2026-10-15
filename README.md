# AI Club member platform

React + Vite frontend, Express API, and SQLite storage. Student and administrator access is determined by the server after a single sign-in.

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

Demo mode creates a dedicated local database with the same mock credentials on every installation, including a sample MCQ assessment. It does not overwrite local member accounts or use the original site's database. No shared central account or shared results database is involved. **Do not expose or deploy these public credentials.**

Run `npm run demo:setup` to create the demo accounts without starting the servers. See [demo account setup](docs/demo-accounts.md) for details, supported ports and safeguards.

## Development and quality checks

Normal development uses the separate `.env.development` configuration (copy and configure `.env.example` if needed), then run `npm run dev`.

```sh
npm test
npm run build
npm run lint
```

The member platform is under development; do not use the demo environment for real student data.
