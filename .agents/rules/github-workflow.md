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

## PR assignee

Assign every PR you open to the authenticated user. Pass `--assignee @me` to
`gh pr create`, and check each PR `gh stack submit` opens.

## PR edits

Use the GitHub REST API to update PR titles and bodies:

```bash
# Update PR title and body
gh api repos/{owner}/{repo}/pulls/{number} --method PATCH \
  -f title="..." \
  -f body="..."
```
