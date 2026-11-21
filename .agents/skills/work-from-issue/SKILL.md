---
name: work-from-issue
description: Works on a feature from a GitHub issue checklist without colliding with other agent sessions. The issue is the source of truth, and every item has a stable code such as `D3`. A session claims an item under its session id before touching code, checks the codebase in case it's already built, asks before any database or backend design, keeps the Claude Design canvas and design system ahead of frontend code, links its PR, and records the item as completed (with the PR number) or cancelled (with a note). Use when asked to implement, pick up, continue or update an item from an issue's checklist, to see which items are free or taken, to add an item, or to claim, release, complete or cancel one.
argument-hint: "[issue number] [item code or text]"
---

# Work from an issue checklist

The issue is the source of truth for what is being built, by whom, and how it ended. Several sessions may work
the same issue at once: claim first, and never work an item another session holds.

Every item has a code, such as `` `D3` ``: its section's letter (`## D. Design review`) and a number. It never
changes. Name items by it, to the user and in commits and PRs (`#42 D3`). Every checklist issue follows one
layout, sections and groups included: [format.md](format.md).

The helper is `scripts/issue-checklist.mjs` (Node, over `gh`). Call it by its absolute path from inside the
project's repo; pass `--repo owner/name` when the issue lives elsewhere. `--dry-run` shows a change without making
it. The protocol is in [claims.md](claims.md).

**Never read the issue body yourself** (`gh issue view`, the API, the browser): a checklist issue runs to hundreds of
long lines. The helper prints one short line per item; `show` gives one item in full.

```bash
CL=<this skill's folder>/scripts/issue-checklist.mjs
node $CL list --issue 42                       # a line per section, then the open items
node $CL list --issue 42 --section D           # one section; also --status todo|taken|mine|done|all, --grep W
node $CL show --issue 42 --item D3             # the item in full, its holder and claim history
node $CL next --issue 42 [--section D]         # the first free item
node $CL claim --issue 42 --item D3            # before any code
node $CL pr --issue 42 --item D3 --number 57
node $CL complete --issue 42 --item D3 --pr 57 --note "e2e passed"
node $CL add --issue 42 --section D --text "New item"   # prints its code
node $CL ids --issue 42                        # codes items and letters section headings
node $CL check --issue 42                      # where the issue departs from format.md
```

## The loop

1. **Identify.** The session id is `$CLAUDE_CODE_SESSION_ID` in Claude Code; another agent passes `--session`.
   The user names the issue. With no item named, run `list` or `next` and propose free items by code. If `list`
   says items have no code, run `ids`. When writing a new checklist issue, follow [format.md](format.md) and run
   `ids` and `check` on it.
2. **Claim before any code.** Run `claim`.
   - Exit 2 means another session holds the item. Pick another, or ask the user. Never take an item over on your
     own.
   - Before a takeover, tell the user which session holds the item, since when, and whether it is still running.
     `ListAgents` shows the running sessions. Only after a yes, run `claim --takeover`.
3. **Check whether it's already built,** on the default branch, before changing anything
   ([gates.md](gates.md#already-built)). Read the item with `show`.
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
   - `complete --pr N --note "<what was verified, or (not run)>"` writes `` - [x] `D3` text (#N; note) ``;
   - `cancel --note "<why>"` writes `` - [x] `D3` ~~text~~ _why_ ``;
   - if the session stops before finishing, `release` the item, so the next session can take it. A linked PR
     stays in the note.

## Always

- One item per claim. Claim each item you will touch, and only those.
- Change the issue only through the helper. New work found on the way becomes an item with `add`, never a pasted
  body: another session's edit in between would be lost.
- A completed item names its PR. `--no-pr` is only for an item closed without a code change (already built, or a
  decision), and its note names the evidence.
- Report what you claimed, linked, completed, cancelled, released or added, by code, with the issue link.
