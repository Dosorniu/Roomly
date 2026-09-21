# Roomly · Room Finder

## Current development status

Roomly has two explicit modes. `demo` stores sample occupancy locally in the
browser; `supabase` uses authenticated PostgreSQL RPCs, shared statuses and
account-specific watches/alerts. Supabase integration is prepared but no hosted
project is connected yet. Follow [the setup guide](docs/supabase-setup.md) before
enabling it. The historical demo/backend notes below describe the original V1.

Stable room/QR addresses now use `/rooms/<immutable-id>`. Existing hierarchical
links are validated and redirected; unknown/disabled rooms return HTTP 404.
UI code is formatted, unused starter modules are removed, and the unused
OpenAI-header authentication helper has been deleted.

A functional academic prototype for finding, checking into and sharing student study spaces. The interface is English, with a neutral campus identity, architectural line art, compact room rows, and complete light/dark themes. All campus locations, capacities and occupancy records are demonstration data. The building uses the supplied stylized campus illustration. The catalog has five levels (0–4); There are 27 demonstration rooms, including 15 additional sample spaces spread over the five floors. The photo was a reference only.

## Run and edit

Use Node.js 22.13 or newer. From the project folder run `npm ci`, then `npm run dev`. Run `npm run build` for production output. Run `node scripts/test-domain.mjs` for business-rule tests, and `npx tsc --noEmit` for type checking. The project uses standard React and TypeScript with Vinext/Next-compatible routing. Keep the lockfile with the project.

## Structure

- `types/domain.ts`: University → Campus → Building → Floor → Room, plus User, RoomSession, RoomMembership and observations.
- `data/catalog.ts`: normalized sample entities and seed factory. UI renders rooms and floors from these records.
- `services/domain.ts`: framework-independent status calculations and state transitions. No Sites APIs or browser APIs.
- `services/repository.ts`: replaceable RoomRepository interface and browser-local demo adapter.
- `components/study/`: application shell, room cards, status badges, check-in dialog and room detail view.
- `services/routes.ts`: immutable room ID links and validated legacy hierarchy redirects.
- `services/supabase-repository.ts`: authenticated shared-state adapter; server rules live in `supabase/migrations`.
- `services/webmcp.ts`: optional, feature-detected read-only browser tool using the same repository.
- `app/`: thin route entrypoints. All business logic stays outside the framework layer.
- `public/campus-illustration.jpg`: replaceable campus illustration; its path is in the building record.
- `public/team-monogram.png`: supplied team logo, styled through CSS for both modes.
- `data/appearance.ts` and `app/appearance.css`: validated preferences and shared palette/typography tokens.

## Demo operation

No real login is required. Switch between Student A, B and C in the header; each browser tab remembers its selected demo identity. No passwords or emails are collected. Seed participants are anonymous and are not account options.

State is explicitly local to this browser and origin. It persists in localStorage and synchronizes between tabs using storage events. Web Locks serialize updates between tabs in supporting browsers. Without Web Locks, the prototype cannot guarantee simultaneous cross-tab writes; this is not a production concurrency solution. If browser storage is unavailable, the adapter remains usable in memory only. Separate devices and different origins do not share demo state. The initial demo is seeded once per browser; it is not silently refreshed when statuses expire.

Notifications are in-app only, watched per demo user. Watches persist locally; alerts exist while the app is open and are not a durable notification inbox. Switching users simulates accounts, not authentication. No student identities appear on room cards or occupancy lists.

## Business rules

- **Free**: the last registered participant explicitly left, or there is a fresh demo free observation. Free observations last 30 minutes.
- **Occupied**: an active session is closed to additional participants.
- **Open to Share**: an active session permits joining, subject to room capacity. A full shared room remains Open to Share with a disabled join action.
- **Unknown**: no reliable fresh observation, or the estimated session time expired. Expiration never assumes a room is physically empty.
- Check-in makes the user the temporary holder. Unknown rooms require explicit in-person empty-room confirmation.
- A user can belong to only one active room session. Joins reject duplicate memberships, closed sessions and full rooms.
- Only the holder can change the remaining duration or sharing preference. Duration is 1–480 minutes, measured from the update time.
- On holder departure, the earliest remaining member becomes holder (user ID breaks equal-time ties). The final departure marks the room Free.
- Expiration removes the active session and its memberships, then records Unknown. The browser checks every five seconds and before every action; status rendering also checks time. All participants use the holder's session deadline.

## Shared backend and administration

The Supabase adapter implements the same RoomRepository contract. SQL RPCs enforce transactions, uniqueness of one active session per room and one active membership per student, capacity, server time, ownership and expiration. A Realtime revision stream plus polling refreshes authorized snapshots. The UI is not the authorization boundary. Connection and email setup are still required; see docs/supabase-setup.md.

Supabase Auth verifies the account; a private approved-email list determines university access. No emails or other students' IDs appear in room projections. The old header-trusting auth helper is removed.

Administrators currently manage the catalog and approved emails through Supabase SQL, not a public admin UI. Keep the committed display catalog and SQL room IDs/capacities in sync. Watches and in-app alerts are stored per account in shared mode. A booking calendar and push/email availability notifications are not included.

## Portability and hosting

React components, TypeScript business rules and data models can move to a normal Git repository. A conventional Next.js project can use the existing app routes; React Native/Expo can reuse the domain layer and interfaces, while replacing DOM components, storage and navigation.

Sites-specific pieces are `.openai/hosting.json`, the bundled build/runtime helpers and optional deployment configuration. They are unrelated to occupancy logic. Vinext is the current framework runner and can be replaced with a standard React/Next toolchain. The supplied images are normal local JPG/PNG assets, with no runtime image-generation dependency. Essential functionality does not call Sites APIs.

## Implementation assumptions and source priority

The current master specification is authoritative. Relevant discussion in the connected “Учеба” project supplied the dark-green/white direction, modular room naming and replaceable building concept. Older ideas such as chat/comments, full authentication and advanced administration were not imported because they exceed or conflict with current V1 scope. This is a personal prototype, not a claim of completed group coursework. No official campus inventory or building geometry has been verified.

## Design revision

The homepage uses a two-column architectural composition on desktop and the requested stacked mobile flow: heading, search, status pills, illustration, then room rows. Additional floor, capacity, type and status controls are under More filters. All existing routes and room business rules remain intact. CBS IDs remain in data and URLs for compatibility, while visible branding is neutral.

`Header`, `ThemeToggle`, `DiscoverRooms` and `BuildingHeroVisual` separate presentation responsibilities. `AppTheme` exposes independent palette, mode, textSize and fontWeight preferences. `AppearanceSettings` edits them immediately. Preferences persist under `nagroom-appearance-v1`, synchronize across tabs, and migrate the old `study-room-theme` mode when no new record exists. Invalid values fall back to defaults; denied browser storage leaves the current session usable.

Appearance is available from the sliders button on desktop or Menu → Appearance on mobile. Original and CBS-inspired palettes each support Light and Dark. Compact/Standard/Large use 15/16/18px root text sizes. Regular/Medium/Bold change the shared text-weight hierarchy. The header sun/moon button changes only mode. Semantic colors are in `app/appearance.css`; layout is in `app/globals.css`. Add future palettes through the options and token definitions.

All surfaces, text, borders, controls, dialogs, lists, account menus and toast colors use shared CSS tokens. Dark mode displays the unchanged building and logo assets with CSS inversion and blending. Replace the image path in the building catalog to swap the illustration without changing room logic. Run `node scripts/check-appearance.mjs` to verify text contrast for both palettes in both modes (13 key text/background pairs each).

CBS-inspired Light uses a pale green background with contrasting purple text. Dark uses purple surfaces, green headings and off-white body text. The legacy appearance storage key is retained to preserve existing preferences after the Roomly rename.

## Team development on GitHub

Use Node.js **24 LTS** for shared development/CI (`.nvmrc`); the runtime minimum is 22.13. Install with `npm ci`, start with `npm run dev`, and build with `npm run build`.

Before opening a PR:

```sh
npm run lint
npx tsc --noEmit
node scripts/test-domain.mjs
node scripts/check-appearance.mjs
npm run build
```

`.github/workflows/ci.yml` runs `npm ci` and lint and all validation checks on PRs to `main`, pushes to `main` and manual runs. It only validates; it does not deploy. A fresh clone defaults to the portable runtime without requiring the Sites plugin.

`main` stays stable. Work in a separate branch, open a PR, pass **Roomly checks**, obtain review and merge. See [CONTRIBUTING.md](CONTRIBUTING.md), [CHANGELOG.md](CHANGELOG.md) and the owner's [GitHub setup checklist](docs/github-setup.md). Protection is configured separately on GitHub; these files alone do not block direct pushes. Demo room state remains local to each browser.
