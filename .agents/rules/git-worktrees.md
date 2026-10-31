# Git worktrees: copy the env files

A worktree only materialises **tracked** files, and `.env*`, `.dev.vars`, `*.pem` and `*.key`
are gitignored — so a new worktree starts with none of them. DB-dependent `:test-local` suites
then silently skip, and worker apps have no `.dev.vars` at all.

Always run `copy-worktree-env` from inside every newly created worktree before development, tests, builds, or local services. When entering an existing linked worktree, verify that it has already run successfully; if that is not established, run it before proceeding. Do not assume environment files were copied automatically.

After creating a worktree, run `copy-worktree-env` from inside it:

```bash
git fetch origin
git worktree add ../<name> -b <branch> origin/main
cd ../<name> && copy-worktree-env
```

`copy-worktree-env` (`~/.local/bin`) works in any git repo: it copies every gitignored env
file from the main worktree, skips tracked ones like `.env.example` (the checkout already has
them at this branch's version), and sets `rerere.enabled` + `remote.pushDefault` for gh-stack.

- **Never hand-write a partial `.env` instead** — the copy also brings every app's `.dev.vars`.
- It worked only if the run ends with `Copied: N files` and exit 0.
