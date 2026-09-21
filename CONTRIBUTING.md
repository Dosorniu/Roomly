# Contributing to Roomly

`main` is stable. After initial repository import, all changes go through a branch and pull request. Do not push directly to `main`.

1. Update local `main` and create a focused branch: `artem-room-search`, `maria-mobile-layout`, `jane-accessibility` or `william-tests`. Codex branches may use `codex/<task>`.
2. Read README.md and relevant code first. Preserve architecture, dependencies, routes and UI unless the task requires a specific change.
3. Make one or two related changes; avoid unrelated rewrites or dependency upgrades.
4. Run `npm run lint`, `npm run test:database`, `npm run test:e2e`, `npx tsc --noEmit`, `node scripts/test-domain.mjs`, `node scripts/check-appearance.mjs`, and `npm run build`. Use `npm ci` after cloning or lockfile changes.
5. Add the next numbered CHANGELOG.md entry with author, date and changes.
6. Push your branch, open a PR into `main`, describe behavior and validation, and request teammate review.
7. Wait for **Roomly checks** to pass on the latest changes. Resolve review comments and update the branch if required. Merge after successful checks and approval; squash merge is recommended.

AI tools follow the same workflow: inspect first, make focused edits, validate. The contributor reviews AI output and remains responsible for it. Never bypass branch protection or merge failed checks.

Commit source, assets and package-lock.json. Do not commit node_modules, outputs, work, generated builds or credentials. `build/` contains source tooling and must stay tracked. `.openai/hosting.json` is imported by the build and contains project metadata, not an access credential. CI does not deploy or require Sites/Cloudflare credentials.

See docs/github-setup.md for owner-only settings. A workflow file alone cannot protect `main`.
