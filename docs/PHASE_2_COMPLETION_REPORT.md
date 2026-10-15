# Phase 2 completion report
15 October 2026 · Community & Moderation · isolated local implementation

## Outcome and isolation

Implemented the Reddit-inspired member Community with persistent posts, secure image attachments, nested replies, voting, New/Top/Popular sorting, search, topic filters, pagination, reporting, moderation and administrator-pinned announcements. Phase 3 Notifications was not implemented.

All source changes, installation/build artifacts, synthetic accounts, databases, uploads and backups are confined to:

```text
C:\Users\Krith\.codex\visualizations\2026\10\15\01a1401d-d300-7ff0-8e03-52b250f257fb\ai-club-phase-2
Branch: codex/phase-2-community-moderation
Base HEAD: 9e597e58d0e2c817504463cc84c5858f3097d27d
```

This independent clone has its own Git metadata. At the initial local handoff it had no remote, and no commit, push, merge or deployment had been performed. The owner subsequently authorized committing and pushing this isolated branch to the existing GitHub repository. Merge and deployment remain unapproved. The original project at C:\Users\Krith\AI_CLUB_TEST remains on main with the same HEAD and four dirty files. Their final hashes match preserved-baseline.json. The copied AdminAssessmentsPage.jsx is also byte-identical to the user's original, including Select All Questions, Clear selection and the 200-question guard.

The source documents' historical RAGUL path was treated as background; the user's explicit checkout/isolation instructions governed this implementation.

## Feature completion and verification

| Audit gap | Delivered | Main source / evidence |
|---|---|---|
| No member Community | Student/admin feed and discussion routes; existing directory retained | src/pages/CommunityPage.jsx, CommunityPostPage.jsx; feed screenshots |
| No persistent post workflow | Create/edit/soft-delete, HTTPS reference, topics, live feedback and safe current bylines | server/routes/community.js; integration suite and browser workflow |
| No secure post images | Upload, describe, reorder, remove, thumbnail and full image view; validated private derivatives | server/community-media.js, CommunityComponents.jsx; actual browser multipart uploads |
| No threaded discussion | Root comments plus two nested reply levels, lazy paginated expansion, edit/delete/tombstones | CommunityComments.jsx; three distinct authors/avatar screenshot |
| No reliable voting | Up/down/undo/switch, unique FK-backed votes and immediate transactions | server/community.js; 12 concurrent retry requests, exact score checks |
| No feed controls | New, Top, seven-day Popular, literal search, tags and bounded cursors | integration suite; mobile browser filters and 6,000-post performance fixture |
| No reports/moderation | Scoped queue, inspect text/images, resolve/dismiss, hide/remove/restore, lock/unlock and audit reasons | AdminModerationPage.jsx; private queue/screenshots and negative API tests |
| No pinned announcements | Three-pin maximum, separate filtered section, pin/unpin audit, edit and hide safety | moderation routes; browser pin/lock/hide/restore and API limit tests |
| Existing feature preservation | Authentication, profiles, directory, Excel assessment APIs and Select All kept | existing tests + browser regressions; preserved hashes |
| No upgrade/restore assurance | Additive migrations 007/008; old-row preservation and database/media restore drill | test/community-migration.test.js; server/community-backup.js |

AC-05, AC-06 and AC-07 are verified for the local Phase 2 scope. The conditional moderation/reply notice delivery remains unconfigured, as required by the Phase 3 boundary.

## Tests and evidence

Baseline before implementation: 21 tests passed; Vite build passed; lint had 14 pre-existing warnings. An early dependency-copy run and sandbox-restricted loopback run were not counted as successful tests; completed dependency copy and authorized loopback runs supplied the recorded results.

Final automated suite: **34 passed, 0 failed, 0 skipped**. It includes all pre-existing tests plus Community authorization, CSRF/ownership/privacy, malformed/oversize image rejection, EXIF removal, private image access, binding, search/pagination, nested ancestry/depth, concurrent votes, pin limits, report throttling, moderation, suspension revocation, cleanup, integrity and backup/restore tests.

Migration testing builds a populated version-6 fixture with accounts, session, profile/skills, CMS/files/gallery/settings/audit and a complete published assessment/question/attempt/answer chain. It compares every old application row after 007/008, checks FK/integrity, reruns idempotently and restores a verified database plus ordinary and Community uploads to a different destination. **No real user database was migrated or imported.** A real-data rehearsal remains a separately authorized integration step.

The 6,000-post fixture verifies 20-row results, no overlap between stable first/second pages, all three sorts, and an index-based chronological plan. Actual local timings are in phase2-evidence/tests.txt; they are local measurements, not a production capacity claim.

Final build passed (approximately 437 kB JS / 172 kB CSS before compression). Final lint: **0 errors, 14 existing warnings, no new warnings**. git diff --check passes. Detailed logs: [tests](phase2-evidence/tests.txt), [build](phase2-evidence/build.txt), [lint](phase2-evidence/lint.txt), [preservation](phase2-evidence/preservation.json).

Browser QA used the Codex in-app Chromium browser and the standalone synthetic preview; [recorded checks and page console](phase2-evidence/browser-qa.json) accompany the screenshots:
- Student, moderator, Super Admin and limited admin sign-in/navigation; ordinary admin has no moderation/pin controls, and direct moderation navigation redirects.
- Actual two-image upload, descriptions, reordering/removal, publish, edit/reload, full image/Escape, post votes, comments/replies, edited comment and parent deletion preserving its child.
- Report, pin, lock/unlock, hide, reload private moderator media, restore and resolve; resolved queue state persists. Author delete removes the disposable post.
- Profile photo upload/save, member directory, safe admin profile, and current protected avatars on every nested level.
- Select All (3) updates count and checked questions; Clear selection restores automatic mode; 201-question bank disables Select All under the existing 200 limit.
- Mobile search/no-match, Top/Popular/topic selection, native dialog focus wrap/Escape; viewport checks at 390, 768 and 1440 px. No unintended Community horizontal overflow.
- Real server shutdown produces accessible Failed to fetch + Try again. Restart retains synthetic session/data and Vite reconnect reload restores the feed.
- Public Home/Gallery/News/About smoke checks; no public page source was edited.

No unexpected application console warnings/errors occurred during normal Community flows. The intentional network-outage test produces expected network failures. Tool-side Statsig telemetry 403 messages are separate from the tested page console. Cross-browser Firefox/Safari and external object storage were not exercised.

### Screenshots

All imagery/activity is synthetic QA content confined to the preview.

| Evidence | File |
|---|---|
| Final Community after workflow cleanup | [community-final.png](phase2-evidence/community-final.png) |
| Desktop Community | [community-1440.jpg](phase2-evidence/community-1440.jpg) |
| Mobile Community | [community-390.jpg](phase2-evidence/community-390.jpg) |
| Tablet Community | [community-768.jpg](phase2-evidence/community-768.jpg) |
| Mobile post composer | [composer-390.jpg](phase2-evidence/composer-390.jpg) |
| Mobile discussion/tombstone | [discussion-390.jpg](phase2-evidence/discussion-390.jpg) |
| Three-level attribution | [nested-discussion-1440.jpg](phase2-evidence/nested-discussion-1440.jpg) |
| Moderator report queue | [moderation-1440.jpg](phase2-evidence/moderation-1440.jpg) |
| Mobile resolved report | [moderation-390.jpg](phase2-evidence/moderation-390.jpg) |
| Preserved Select All | [assessment-select-all.jpg](phase2-evidence/assessment-select-all.jpg) |
| Real network error state | [network-error.jpg](phase2-evidence/network-error.jpg) |

## Local preview

Use this checkout only. The provided node.exe and node_modules are local runtime conveniences and ignored by Git.

```powershell
Set-Location -LiteralPath 'C:\Users\Krith\.codex\visualizations\2026\10\15\01a1401d-d300-7ff0-8e03-52b250f257fb\ai-club-phase-2'
& .\.local-runtime\node.exe server/scripts/phase2-preview.js
```

Open [local sign-in](http://127.0.0.1:5182/login). API uses 127.0.0.1:3012. Keep this terminal running; Ctrl+C stops it. If already running, simply open the URL. Do not start a second instance on those ports.

All synthetic accounts use password `Community-QA-2026!`:

| Login | Role |
|---|---|
| QA-STUDENT / QA-PEER | Active student |
| QA-MODERATOR | Community moderation only |
| QA-ADMIN-LIMITED | Admin without moderation |
| QA-ADMIN | Super Admin; assessment regression |

Open Community from the sidebar. QA-MODERATOR also has Moderation. QA-ADMIN → Assessments → New assessment → QA Fundamentals Bank demonstrates Select All. The 201-question bank demonstrates its existing cap.

Preview explicitly sets its own database/uploads/backups under .phase2-data/preview, clears S3 credentials, refuses production mode or an unrecognized populated DB and binds both servers to loopback. It preserves preview data between restarts. No original .env or database is used. Do not use this synthetic preview launcher for deployment.

To rerun checks, from this directory:
```powershell
& .\.local-runtime\node.exe --test --test-concurrency=1
& .\.local-runtime\node.exe node_modules/vite/bin/vite.js build
& .\.local-runtime\node.exe node_modules/oxlint/bin/oxlint src server shared test vite.config.js
git diff --check
```
These are the package test/build/lint commands invoked directly with the portable runtime. On a machine with supported Node/npm on PATH, npm test, npm run build and npm run lint are equivalent.

## Schema, backup and restoration

See [PHASE_2_API.md](PHASE_2_API.md) for endpoint contracts, DTOs, permission matrix, ER relationships, limits and privacy decisions.

Migrations 007 and 008 are additive and checksum tracked. Existing runner creates and verifies a pre-upgrade database backup when upgrading a non-empty schema. Do not edit applied migration SQL.

For a complete **stopped local instance** backup, server/community-backup.js exports:
```js
backupCommunityInstance({databasePath, uploadDir, backupDir})
verifyCommunityBackup(manifestPath)
```
Use absolute paths belonging to the isolated instance. Backup captures SQLite through the existing verified VACUUM backup and copies every files/community_media_variants storage key, with sizes and SHA-256 manifest. Verification checks database hash, every derivative and SQLite integrity/FKs. It fails if referenced uploads are missing. This local utility is not an S3 backup utility.

Restore procedure: stop the preview; verify the manifest; copy the verified database into a **new isolated restore directory**, and copy its adjacent .media directory into that instance's upload root; verify checksums/integrity before starting against it. Never copy a live SQLite/WAL pair blindly or replace the original project database. The restore drill exercises a separate destination and retains assessment results plus ordinary/private media.

## Changed files and boundaries

New runtime files: server/community.js, community-media.js, community-events.js, community-backup.js, routes/community.js, routes/community-moderation.js, migrations/007_community.sql, 008_community_media.sql and scripts/phase2-preview.js.

New UI files: src/lib/community.js, components/CommunityComponents.jsx, CommunityComments.jsx, pages/CommunityPage.jsx, CommunityPostPage.jsx, AdminModerationPage.jsx and Community.css.

Integration changes: server/app.js mounts routes and handles expected validation errors; server/index.js schedules staged cleanup; server/storage.js validates local paths and permits authorized private files under hidden directories; routes/members.js adds safe admin byline profiles. src/App.jsx, DashboardShell.jsx and MemberProfilePage.jsx add protected navigation/routes and role-aware back links. package.json/package-lock.json retain the user's version changes and add pinned Sharp 0.35.5. .gitignore retains user edits and excludes isolated runtime/data/cache/logs.

Tests added: community.integration.test.js and community-migration.test.js. Existing migrations.test.js expects versions 7/8. AdminAssessmentsPage.jsx appears dirty relative to base because it contains the user's copied changes; Phase 2 did not edit it.

## Operational limits and decisions

No release/deployment is authorized or performed. Before a future live integration, the owner still needs a moderator roster, institutional code of conduct/appeals contact and approved retention/deletion periods. Unattached staged images expire automatically; detached images and images retained with soft-deleted/moderated posts remain private and count toward quota. They are not automatically purged without that policy.

File writes and SQLite cannot form a single filesystem transaction: failed normal uploads attempt derivative cleanup; expired staged cleanup retries. A process crash between storage write and metadata commit, or a storage deletion failure, can leave an unreferenced object requiring operator reconciliation. The error is logged; no orphan becomes publicly accessible. Filesystem backup assumes the instance is stopped. Multi-process hosting requires shared rate/concurrency limits and an object-storage backup/retention arrangement; this local run did not configure either.

The event emitter is an integration hook, with no durable notification delivery. No notifications inbox, fan-out, campaigns or Phase 3 worker was created. Existing assessment behavior and public UI remain preserved.
