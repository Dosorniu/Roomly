# V1 validation

- TypeScript: `tsc --noEmit` passed.
- Production build: passed; emitted Worker default export exposes a callable `fetch`.
- Business-rule tests: check-in; conflicting check-in; joining; one active membership per user; holder permissions; holder transfer; sharing toggle; final leave; free-status freshness; Unknown confirmation; session expiration; invalid durations; room capacity.
- Browser scenario: Student A checked into Barcelona 1.12 with sharing enabled; Student B joined (2/6); A left; B became holder (1/6); B left; the room became Free.
- Search for 2.14 returned Copenhagen. Combined filters correctly produced an empty state, and Clear filters restored the 12 rooms.
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

A clean source copy installed successfully with npm ci using Node.js 24.19.0 on Windows. TypeScript, domain tests, all 52 appearance contrast pairs and npm run build passed in that clean copy, without local execution-profile settings. Linux execution remains to be verified by GitHub Actions. Source export excludes generated directories and credentials; lockfile dependency URLs use the public npm registry.
