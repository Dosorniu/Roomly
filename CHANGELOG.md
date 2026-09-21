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
