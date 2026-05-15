# Git Branching & Release Workflow

Adopted 2026-05-14. Replaces the prior "branch off `master`, PR back to `master`" pattern, which mixed in-progress work with releases.

## The branches

| Branch | Role | Who pushes here |
|---|---|---|
| `master` | Production / demo-ready. Tagged on every release. | Only via merged PR from `develop` (release) or `hotfix/*` (emergency). Never direct commits. |
| `develop` | Integration branch. Always green, but ahead of `master` by whatever's accumulated for the next release. | Only via merged PR from `feat/*`, `fix/*`, `chore/*`. |
| `feat/<slug>` | New user-facing functionality. | One author per branch. |
| `fix/<slug>` | Bug fix that isn't urgent enough to hotfix. | One author per branch. |
| `chore/<slug>` | Tooling, docs, refactors, deps. No user-visible behavior change. | One author per branch. |
| `hotfix/<slug>` | Emergency fix for a bug already in `master`. | Author. Must merge to **both** `master` and `develop`. |

## Standard flow (the 95% case)

```
feat/X        ─┐
fix/Y         ─┼─→ develop ──→ master (release tag vX.Y.Z)
chore/Z       ─┘
```

1. Branch from `develop`:
   ```bash
   git checkout develop && git pull
   git checkout -b feat/cool-thing
   ```
2. Work, commit, push, open PR **into `develop`**.
3. PR reviewed and merged.
4. When `develop` is release-ready, open a release PR `develop → master`. Tag the merge commit.

## Hotfix flow (urgent prod-only fix)

```
master ──→ hotfix/critical ──→ master (tag)
                             ╲
                              └─→ develop  (forward-port so the fix survives the next release)
```

1. Branch from `master` (not develop):
   ```bash
   git checkout master && git pull
   git checkout -b hotfix/critical
   ```
2. Make the smallest possible fix. Test. Open PR `hotfix/critical → master`.
3. After merge to `master`, **also** merge or cherry-pick the same commit into `develop` so the fix doesn't get clobbered by the next release.
4. Tag the `master` merge commit.

## Naming conventions

- Branches: `<type>/<short-slug>` — kebab-case, ≤4 words. Good: `feat/illustration-mode-labels`, `fix/browse-button-scroll`. Bad: `mybranch`, `nicks-work-2`.
- Commit messages: imperative present tense, first line ≤72 chars. Match the existing repo style (`Add multi-character cast...`, `Fix image generation...`).
- PR titles: same as the first commit line unless the PR has multiple commits with different intent.

## What can't go on `develop` directly

- Direct pushes to `develop` (use a branch + PR).
- Half-finished work behind no flag. If it isn't safe to be on `develop` for hours/days, gate it with a feature flag or keep it on the feature branch.
- Schema migrations without a tested rollback plan.

## What can't go on `master` directly

- Anything that hasn't passed through `develop` or `hotfix/*`. Period.

## Branch protection (recommended GitHub settings)

Set these manually under repo Settings → Branches:

- `master`: require PR review, require status checks (when CI exists), block force-push, block deletion.
- `develop`: require PR review, require status checks, block force-push.

Until CI exists, "require status checks" is a no-op but worth pre-setting.

## Cheat sheet

```bash
# New feature
git checkout develop && git pull
git checkout -b feat/whatever
# ...work...
git push -u origin feat/whatever
gh pr create --base develop

# Cut a release
git checkout master && git pull
gh pr create --base master --head develop --title "Release vX.Y.Z"
# (after merge)
git tag vX.Y.Z && git push --tags

# Hotfix
git checkout master && git pull
git checkout -b hotfix/<thing>
# ...minimal fix...
gh pr create --base master --head hotfix/<thing>
# (after merge to master)
git checkout develop && git pull
git merge master   # forward-port the hotfix
git push
```
