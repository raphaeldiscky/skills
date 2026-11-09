# GitHub Workflow

## Commit authorship

**Use your configured Git identity. Do not add AI attribution.**

- Do not add an AI `Co-Authored-By` trailer or a generated-by footer.
- Don't override `--author`; use the configured global git identity.
- If a repo has a stale local `user.email` (e.g. a work address), drop the local
  override so it inherits the global identity — don't silently commit as someone else.

## Commit cadence

**Commit small, and commit every time a milestone is reached** — don't wait to be asked, and don't save it all
for the end. I want to track the work step by step and revert any one step on its own.

- A milestone is a working, self-contained step: a layer done, a test going green, a refactor finished before the
  feature that needs it.
- One logical change per commit; never bundle unrelated changes.
- Push and open PRs once the work is ready; don't wait for my go-ahead. Force-push still needs an explicit ask.

## Branches and syncing main

- Work on the current branch. Don't create a branch or worktree without the user's approval.
- One worktree = one branch = one task. Report unrelated findings; don't fix them there.
- After the user approves a new feature's plan, before any code: with a clean tree (if it is dirty, stop and say
  so), run `git fetch origin && git merge origin/main` into the current branch and resolve conflicts then. Don't
  rebase for this: merging rewrites no history, so no force-push is needed. Stacked PRs follow the stacked PRs rule.
- After a merge, report it. Never delete the branch or its worktree.
- End every task by naming what is uncommitted, unpushed or unverified.

## PR assignee

Assign every PR you open to the authenticated user. Pass `--assignee @me` to
`gh pr create`, and check each PR `gh stack submit` opens. To fix an existing PR, see PR edits.

## PR edits

```bash
gh pr edit <n> --title "..." --body "..."
gh pr edit <n> --add-assignee @me
```
