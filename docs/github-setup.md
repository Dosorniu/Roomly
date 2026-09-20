# GitHub setup checklist

Intended configuration; this document does not prove remote settings are active.

1. Create a **private** Roomly repository under the agreed owner. Import source as initial `main` commit (the only bootstrap exception to PR-only changes). Keep `.openai/hosting.json`, `build/`, `vendor/` and the lockfile; exclude files covered by .gitignore.
2. Set default branch to `main`. Allow GitHub Actions with read-only contents permission. No deployment or repository secrets are needed.
3. Run **Roomly CI** successfully once (push or manual). Keep the job name **Roomly checks** stable: branch protection refers to this exact check.
4. Settings → Branches → protection for `main`: require PRs, one approval, dismiss stale approvals, require **Roomly checks**, require up-to-date branches, resolve conversations, and enforce for administrators (no bypass). Keep force pushes and deletion disabled.
5. Allow squash merging. Add agreed usernames under Settings → Collaborators with Write access; keep admin access for maintainers. Obtain exact GitHub usernames before sending invitations.
6. Verify a small PR runs CI and that an unapproved/failed PR cannot merge. Confirm direct pushes are blocked before claiming protection is active.

Protected branches in private repositories require GitHub Pro (personal) or Team/Enterprise (organization). If unavailable, keep the repository private and report the limitation. Written policy does not technically block direct pushes. Do not purchase a plan or change visibility without the owner's decision.

References:
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule

Deployment, shared database and production authentication are out of scope.

## Current setup status — 2026-09-20

Private repository created: https://github.com/Dosorniu/Roomly (default branch: main).
GitHub explicitly reports that branch protection is not enforced for this private repository on its current plan. Do not describe main as protected. Use PRs and successful checks as the team policy until an eligible plan enables enforcement. No plan or visibility change was made.

The main rule is saved on GitHub with PR review, stale-approval dismissal, up-to-date branches, conversation resolution and no bypass. The required Roomly checks status is selected with GitHub Actions as its source. GitHub labels the rule Not enforced; failed/unapproved merge blocking cannot be guaranteed on the current plan.

Source import: https://github.com/Dosorniu/Roomly/pull/1. The first Linux CI run passed dependency installation, TypeScript, domain tests, contrast checks and production build: https://github.com/Dosorniu/Roomly/actions/runs/35515429401.

