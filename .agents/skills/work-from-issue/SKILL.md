---
name: work-from-issue
description: Works on a feature from a GitHub issue checklist without colliding with other agent sessions. The issue is the source of truth. A session claims an item under its session id before touching code, checks the codebase in case it's already built, asks before any database or backend design, keeps the Claude Design canvas and design system ahead of frontend code, links its PR, and records the item as completed (with the PR number) or cancelled (with a note). Use when asked to implement, pick up, continue or update an item from an issue's checklist, to see which items are free or taken, or to claim, release, complete or cancel one.
argument-hint: "[issue number] [item text]"
disable-model-invocation: true
---

# Work from an issue checklist

The issue is the source of truth for what is being built, by whom, and how it ended. Several sessions may work
the same issue at once: claim first, and never work an item another session holds.

The helper is `scripts/issue-checklist.mjs` (Node, over `gh`). Call it by its absolute path from inside the
project's repo, and pass `--repo owner/name` when the issue lives elsewhere. `--dry-run` shows a change without
making it. The protocol, statuses and race handling are in [claims.md](claims.md).

```bash
CL=<this skill's folder>/scripts/issue-checklist.mjs
node $CL list --issue 42                                   # open items, and who holds them
node $CL claim --issue 42 --item "Export the report"       # before any code
node $CL pr --issue 42 --item "Export the report" --number 57
node $CL complete --issue 42 --item "Export the report" --pr 57 --note "e2e passed"
```

## The loop

1. **Identify.** The session id is `$CLAUDE_CODE_SESSION_ID` in Claude Code; another agent passes `--session`.
   The user names the issue. With no item named, run `list` and propose the free ones.
2. **Claim before any code.** Run `claim`.
   - Exit 2 means another session holds the item. Pick another, or ask the user. Never take an item over on your
     own.
   - Before a takeover, tell the user which session holds the item, since when, and whether it is still running.
     `ListAgents` shows the running sessions. Only after a yes, run `claim --takeover`.
3. **Check whether it's already built,** on the default branch, before changing anything
   ([gates.md](gates.md#already-built)).
   - If it is built, run `complete --no-pr --note "<evidence>"` and stop.
   - If it is partly built, add a `note` with what exists and narrow the work to the rest.
4. **Pass the gates** ([gates.md](gates.md)).
   - **Database or backend design:** before a migration, a schema, an API or event contract, a service's
     behaviour or seed data, ask the user. Ask once per item, name what changes, and wait for a yes.
   - **Frontend:** the project's Claude Design canvas and design system are the source of truth. Never change
     frontend code before the canvas shows the change and the user has approved it.
5. **Build** under the project's own rules: its branch, commits, tests, and PR conventions.
6. **Link the PR as soon as it opens:** `pr --number N`. Other sessions see where the work is.
7. **Close the item when the implementation is complete:**
   - `complete --pr N --note "<what was verified, or (not run)>"` writes `- [x] text (#N; note)`;
   - `cancel --note "<why>"` writes `- [x] ~~text~~ _why_`;
   - if the session stops before finishing, `release` the item, so the next session can take it. A linked PR
     stays in the note.

## Always

- One item per claim. Claim each item you will touch, and only those.
- Change the issue only through the helper, or by hand under the same protocol. Never paste a whole body
  you read minutes ago: another session's edit in between would be lost.
- A completed item names its PR. `--no-pr` is only for an item closed without a code change (already built, or a
  decision), and its note names the evidence.
- Report what you claimed, linked, completed, cancelled or released, with the issue link.
