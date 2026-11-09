# Git worktrees: only when approved, and copy the env files

Do not create a worktree or branch on your own. Work in the worktree and branch you are in, also for a fix, an
experiment, a review or a stack layer. If one is needed, ask the user and wait for approval. Approval of a stack
plan covers its layers. Never delete a worktree or branch: the user removes workspaces, unless they ask you to.

A worktree only materialises **tracked** files, and `.env*`, `*.pem` and `*.key` are gitignored —
so a new worktree starts with none of them, and tests or apps that need them fail or silently skip.

Before development, tests, builds, or local services in a new worktree, copy every gitignored env and
secret file from the main worktree. When entering an existing linked worktree, verify the copy already
happened; if that is not established, do it before proceeding. Do not assume the files were copied automatically.

When the user approves a worktree, create it:

```bash
git fetch origin
git worktree add ../<name> -b <branch> origin/main
```

Use a copy helper if you have one (for example a `copy-worktree-env` script on your `PATH`).

- **Never hand-write a partial `.env` instead** — copy the real files.
- Confirm the copy succeeded (exit status, files copied) before relying on it.
