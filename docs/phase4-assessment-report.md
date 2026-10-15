# Phase 4 — Assessment System implementation and verification

Date: 15 October 2026
Workspace: C:\Users\ragul\Desktop\AI_CLUB_UI_EXPERIMENT
Branch: feature/member-platform
Original site: not edited.

## Delivered

### Admin
- Question banks organized by academic year and batch, with MCQ and coding questions.
- Manual question creation/editing/removal, four MCQ options, correct answer, points, optional programming language and HackerRank HTTPS link.
- Downloadable Excel template (.xlsx), workbook validation/preview and atomic question import; missing headers, invalid answers/options/points, duplicates and malformed files are rejected.
- Assessment creator with required question source, question count, backward navigation toggle, equal/custom point allocation, editable total points.
- Question selection, title, description, instructions, duration, opening/closing dates, attempt limit, academic-year eligibility.
- Draft editing, publishing immutable question/mark snapshots, closing, archiving, submission review and administrator-controlled release of results.
- Manual grading and feedback for coding submissions. Published grades are locked.
- Search and filter by type, live state, year and batch; submission review with member name, status and score.

### Students
- Available, upcoming and finished assessment cards; eligibility and attempt limits enforced on the server.
- Timed assessment taking, MCQ choices, code/text submissions and optional HackerRank link.
- Server-side answer saving, refresh recovery and per-question progress.
- Backward-navigation setting enforced by the API; future/previous question bodies are withheld when backward navigation is disabled.
- Deadline/timeout settlement, submission confirmation and attempt history.
- Correct answers never appear in student attempt APIs; scores are not returned until an administrator publishes results.

### Security and data
- SQLite migration: server/migrations/006_assessments.sql.
- All routes protected by current session, CSRF, account-role and permission middleware.
- Same-origin session cookies and existing authentication were reused.
- Published questions use copied snapshots: editing or deleting a bank question cannot change an existing published assessment.
- Tests use isolated temporary databases; normal database has 2 users, migration version 6 and SQLite integrity = ok.
- No commit, push, merge or deployment.

## Routes
- Admin UI: http://localhost:5174/admin/assessments
- Student UI: http://localhost:5174/student/assessments
- Student attempts: /student/assessments/attempt/:attemptId
- API: /api/assessments/admin/* and /api/assessments/student/*

## Verification
- npm test: 20 passed, 0 failed (including new assessment integration coverage).
- npm run build: passed.
- npm run lint: zero errors, one pre-existing unused containerRef warning in NeuralCanvas.
- git diff --check: passed (Git line-ending notices only).
- Browser QA in isolated DB: Chrome desktop at 1440px and mobile viewport at 390px; 10 screenshots, zero overflow and zero unexpected errors.
- Four 401 responses were expected unauthenticated /api/auth/me session checks during login/logout, not assessment failures.
- Existing unresolved hero-font URL warnings remain.
- Original protected project was never written to. Its existing uncommitted Git changes were left alone.

## Screenshots
Screenshots are in docs/phase4-assessment-evidence:
- admin-assessments-1440.png, admin-assessments-390.png
- admin-question-bank-1440.png
- admin-create-assessment-1440.png, admin-create-assessment-390.png
- student-assessments-1440.png, student-assessments-390.png
- student-attempt-390.png, student-attempt-question2-390.png
- student-submitted-390.png

Repeat browser checks: node server/scripts/verify-assessments-ui.js

## Deliberate scope limits
- HackerRank is an external-link workflow, not automatic remote grading or a built-in code execution sandbox.
- Batch is question-bank organization metadata; eligibility is currently enforceable by students' profile academic year, not by their batch.
- Question scoring uses non-negative point values with at most two decimal places for equal distribution; custom points must total exactly the assessment maximum within floating-point tolerance.
- No physical-device or full assistive-technology audit was performed. Browser testing used Chromium/Chrome viewports.
- No real student answers or credentials were created or changed for QA; separate disposable QA databases were removed.
