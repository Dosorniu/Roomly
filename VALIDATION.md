# V1 validation

## Hosted shared deployment — 2026-10-01

- Supabase project is ACTIVE_HEALTHY on the Free plan and connected to the
  production Worker at `https://roomly.dosorniu.workers.dev`.
- Core, catalog and public-browsing/auth migrations are applied in the hosted
  database. The live catalog contains 27 rooms.
- Hosted Auth email delivery was exercised successfully with the owner test
  account; the email is confirmed and approved.
- `public.roomly_revision` is published to Supabase Realtime.
- Anonymous role can execute `roomly_public_snapshot()` and cannot execute
  `roomly_command(...)`.
- Live anonymous snapshot returned only revision, sessions, empty memberships and
  room observations. No email addresses or user IDs are part of the public API.
- One private campus invite code is provisioned in the hosted database. The code
  itself is intentionally not committed to GitHub.
- Custom SMTP and six-digit-only Confirm signup / Magic Link email templates are
  still manual production gates before class-wide testing.
- This branch adds automated database coverage for the public projection,
  rejected invalid invite codes and successful verified access claiming.
- Full branch CI and the final two-device acceptance scenario must pass before
  this update is treated as presentation-ready.

## Current checks — 2026-09-21

- Lint: 0 errors; two advisory warnings remain for locally supplied img assets.
- TypeScript, domain/routes tests, 52 contrast pairs and production build pass.
- Four automated Chromium browser scenarios pass in development and production: real HTTP 404/legacy redirects,
  mobile search over 27 rooms, cross-tab check-in/join/holder-transfer/leave, and
  pre-hydration restoration of the saved dark appearance.
- Real SQL migrations/RPCs pass in local PostgreSQL WASM (PGlite): authentication
  and approved-email gates, private identities, rejected direct writes, capacity,
  holder permissions/transfer, durable watches/alerts and expiration to Unknown.
- CI also passed the migrations against PostgreSQL 17 and the race between two
  independent connections for one room (run 35582332211). Final CI results are recorded on PR #2.
- Dependency audit after the targeted toolchain updates: 0 known vulnerabilities.
- No live Supabase project is connected. Hosted email delivery, Realtime and
  two-device sign-in remain unverified and are required before shared deployment.

The sections below are historical checks of earlier iterations.

- TypeScript: `tsc --noEmit` passed.
- Production build: passed; emitted Worker default export exposes a callable `fetch`.
- Business-rule tests: check-in; conflicting check-in; joining; one active membership per user; holder permissions; holder transfer; sharing toggle; final leave; free-status freshness; Unknown confirmation; session expiration; invalid durations; room capacity.
- Browser scenario: Student A checked into Barcelona 1.12 with sharing enabled; Student B joined (2/6); A left; B became holder (1/6); B left; the room became Free.
- Search for 2.14 returned Copenhagen. Combined filters correctly produced an empty state, and Clear filters restored the then-current 12-room catalog. This historical check predates the expansion to 27 rooms; current tests cover the 27-room catalog.
- Desktop and 390×844 mobile views inspected. Mobile document width did not exceed viewport width; the first room begins in the initial viewport. Floor and status selectors scroll horizontally within their own controls.
- WebMCP read tool registered; valid search returned current room availability, and a non-string query was intentionally rejected.
- Cross-device synchronization, production authentication, server concurrency and push notifications are intentionally outside this local demonstration.

## Architectural design revision

TypeScript and domain regression tests passed after the UI refactor. Checked light/dark theme toggling, room detail and check-in dialog in dark mode, the mobile menu and neutral brand. At 390px the page content does not overflow horizontally. The illustration is visible on mobile between primary filters and room rows as requested. Demo records were not reset or falsely marked Free to match the visual reference.

## Appearance and campus revision — 2026-09-16

- Production build, TypeScript and existing domain regression tests passed.
- Both palettes and both modes checked through the UI. Text size and weight choices apply independently; Large/Bold survives a page reload.
- Desktop at 1280px and mobile at 390px inspected. Large text in the detail metrics uses a single column on narrow screens; document width stays within the viewport.
- Mobile Menu → Appearance, each size/weight choice, room details and check-in dialog checked. Unknown-room confirmation remains required.
- Contrast test covers 52 semantic text/background pairs at >=4.5:1; lowest result is 4.76:1. This is token validation, not a full accessibility audit.
- Campus illustration and monogram load from local assets. The catalog now exposes floors 0–4, with existing room inventory preserved.
- Demo occupancy data was preserved; old expired sessions remain Unknown.

## Roomly revision
Added 15 sample rooms (27 total), distributed across floors 0-4. Browser verified the full room list and both revised CBS palettes. Production build, TypeScript, domain tests and 52 contrast checks passed. Existing browser occupancy and appearance records are preserved.


## GitHub preparation — 2026-09-20

A clean source copy installed successfully with npm ci using Node.js 24.19.0 on Windows. TypeScript, domain tests, all 52 appearance contrast pairs and npm run build passed in that clean copy, without local execution-profile settings. GitHub Actions also passed all steps on Linux in run 35515429401 for import commit 5d3d758c1eb4145ca88836f462ec7ab245bb5777. Source export excludes generated directories and credentials; lockfile dependency URLs use the public npm registry.
