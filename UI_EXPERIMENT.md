# AI Club — Inner Pages UI Experiment

Branch: `ui/light-inner-pages-concept`

This branch prototypes a coordinated light, blue-violet visual system for the **Gallery**, **About**, and **News** pages. It does **not** replace the existing `main` branch or redesign the homepage.

## Pages

- `/gallery` — cinematic hero, filterable photograph mosaic, lightbox, and Events/Achievements views
- `/about` — concise club introduction, mission pillars, faculty and student-team sections, and project showcase
- `/news` — featured article, editorial cards, category filters, search, and accessible article detail dialog

The navbar changes appearance only when one of these experimental pages is active. The homepage and login designs remain unchanged. The Assessment page and public navigation link have been removed on this branch; visiting `/assessment` redirects to the homepage. Previously saved assessment progress remains readable in the student dashboard, without links to start assessments. The previously requested admin-dashboard removal is retained.

## Local preview

The experiment is in a separate Git worktree at `C:\Users\ragul\Desktop\AI_CLUB_UI_EXPERIMENT`.

To run standalone (with an available API port):

```sh
npm install
npm run dev:api
npm run dev:web -- --port 5174
```

Open `http://localhost:5174/gallery`, `http://localhost:5174/about`, or `http://localhost:5174/news`. If both development processes are started separately, keep them in separate terminals.

## Data and imagery

Existing public CMS endpoints and their schemas are reused. Faculty and team placeholders remain clearly identified until official entries are published. Preview gallery items and news entries are labeled **Demo**. On News, sample items fill out the experimental layout only while fewer than four published items exist.

The files in `public/concept/` are licensed example photographs downloaded from [Unsplash](https://unsplash.com/) (photo IDs are retained in the source downloader history, not production CMS assets). Replace them with actual AI Club event photography before production use.

## Review status

- Build and lint validated locally
- Gallery filtering/lightbox, News filters/search/dialog, and mobile navigation tested
- Desktop and mobile renders checked at 1500px and 390px
- No production deployment intended; merge only after design approval
