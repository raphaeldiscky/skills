# Stacked PRs (gh-stack)

Break a large change into a chain of small, dependent PRs with the
[`gh-stack`](https://github.com/github/gh-stack) CLI extension. Guides:
[stacked-prs](https://github.github.com/gh-stack/guides/stacked-prs/),
[workflows](https://github.github.com/gh-stack/guides/workflows/),
[ui](https://github.github.com/gh-stack/guides/ui/),
[modify](https://github.github.com/gh-stack/guides/modify/).

A stack is an ordered list of branches, each built on the one below, rooted on
the trunk (`main`). Each branch maps to one PR whose **base is the branch below
it** — so the **bottom PR bases on `main`**, and each higher PR bases on the
previous branch. Reviewers see only that layer's diff.

```
main
 └── layer-1  → PR #1 (base: main)          # bottom (closest to trunk)
  └── layer-2 → PR #2 (base: layer-1)
   └── layer-3→ PR #3 (base: layer-2)        # top
```

**One-time setup** (avoids interactive prompts — required for non-interactive use):

```bash
gh extension install github/gh-stack
git config rerere.enabled true            # remember conflict resolutions
git config remote.pushDefault origin      # skip remote picker
```

**Core workflow** (always pass branch names + `--auto` so nothing prompts):

```bash
gh stack init layer-1            # create+checkout the bottom branch (base: main)
# ...commit work...
gh stack add layer-2             # next layer, based on layer-1's tip
# ...commit work...
gh stack submit --auto           # push all branches + open the PRs with correct bases
gh stack push                    # push updates (safe force-with-lease) after amending
gh stack sync                    # fetch + rebase the whole stack onto latest trunk + push
gh stack rebase                  # cascade-rebase the stack onto trunk (conflict resolution)
gh stack view                    # show the stack + PR status
gh stack modify                  # add / remove / reorder / rename branches in the stack
```

Navigation: `gh stack checkout <branch>` / `up` / `down` / `top` / `bottom`
(`up` = away from trunk, `down` = toward it). **Merge behavior:** merging any
stacked PR also merges every unmerged PR below it.
