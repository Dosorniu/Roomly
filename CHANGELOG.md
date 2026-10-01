# Changelog

## Update 01 — Working Roomly baseline

Author: Artem (AI-assisted implementation)
Date: 2026-09-16

Added:

- Room search, filters, direct links, check-in, joining and leaving.
- Holder transfer, expiration and independent appearance settings.
- Supplied campus illustration/monogram and 27 demo rooms over five floors.

Changed:

- Product name to Roomly; CBS light green and deep purple themes.

## Update 02 — GitHub team preparation

Author: Codex, at Artem's request
Date: 2026-09-20

Added:

- Pull-request CI: locked install, TypeScript, domain tests, contrast and build.
- Contribution guide, PR template and repository setup checklist.
- Shared Node.js version and generated-cache exclusion.

Changed:

- README expanded with branch and PR workflow.

Application behavior, deployment, backend and authentication are unchanged.
Remote repository settings must be verified separately on GitHub.

<!-- Next iteration: Update 03, actual author/date, Added/Changed/Fixed items. -->

## Update 03 — Engineering cleanup and shared backend preparation

Author: Codex, at Artem's request
Date: 2026-09-21

Added:

- Supabase email sign-in, authenticated RPC repository, private PostgreSQL schema,
  transactional occupancy, account watches and durable availability alerts.
- Database authorization/regression tests, browser E2E tests, lint in CI,
  dependency updates and Dependabot, CSP and response security headers.
- Stable room ID URLs, legacy redirects, true 404 pages and an error boundary.

Fixed:

- Lint errors, README encoding, historical validation wording and dark-theme flash.
- Removed unused UI/template modules, unused dependencies and header-based auth.
- Formatted application and domain code for review.

The Supabase connection is not live yet. Default local demo behavior is preserved;
hosted authentication, email delivery and cross-device testing remain setup gates.

Repository setup note: private Dosorniu/Roomly created; main rule saved but Not enforced on the current plan. The source import is reviewed through the codex/roomly-github-setup pull request; remote CI results are recorded on GitHub.

## Update 04 — Live Supabase deployment and public browsing

Author: ChatGPT, at Artem's request
Date: 2026-10-01

Added:

- Live Supabase project with the existing Roomly schema, 27-room catalog,
  authenticated occupancy RPCs, Realtime revision publication and the first
  verified/approved test account.
- Public read-only room snapshots so visitors can browse room availability,
  occupant counts and estimated end times without signing in.
- Passwordless interaction flow: email verification, persistent Supabase session
  and a one-time campus access code for newly approved accounts.
- Private campus invite-code storage and claim RPC. Invite codes are database
  data and are intentionally not committed to GitHub.
- Public Realtime revision access containing only the revision counter; room
  identities and student data remain private.

Changed:

- Shared-mode UI no longer blocks the whole application behind authentication.
  Sign-in appears only when a visitor tries to check in, join, update a session
  or watch a room.
- Account controls now distinguish signed-out, verified-but-not-approved and
  fully approved states.
- Supabase repository now keeps anonymous visitors synchronized through the
  privacy-safe public projection and preserves private account watches/notices
  only for approved users.
- Shared setup documentation now records the live Cloudflare Workers deployment
  at `https://roomly.dosorniu.workers.dev` and the production auth flow.

Security / privacy:

- Public snapshots expose no email addresses, user IDs or membership rows.
- Mutations still require an authenticated, verified and campus-approved actor.
- Passwords are not collected by Roomly; Supabase email OTP/magic-link
  verification is used instead.

Remaining production gate:

- Configure custom SMTP before class-wide use and change both Confirm signup and
  Magic Link/OTP templates to show the six-digit `{{ .Token }}`. The built-in
  Supabase mailer remains suitable only for limited testing.
