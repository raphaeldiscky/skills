# Gates before code

Pass these in order, after the claim and before changing the codebase.

## Already built

Items go stale: work merges under another item, another issue, or a PR that never ticked anything. Check the
default branch, not your working copy:

1. Run `git fetch origin`. Read files with `git show origin/<default>:<path>` if your branch is behind.
2. Search the code for the item's nouns: endpoint, table, component, config key, test name.
3. Search the merged PRs (`gh pr list --state merged --search "<words>"`) and the log
   (`git log origin/<default> --oneline -S '<symbol>'`).
4. Where it's cheap, run it: a test, a request, or a page in the browser.

| Finding         | Action                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------- |
| Fully built     | `complete --no-pr --note "built in #N, <file>; <checked how>"` (or "(not run)"), then stop. |
| Partly built    | `note --text "exists: …; missing: …"`, then build only the missing part.                     |
| Not built       | Continue.                                                                                    |

A finding from reading code alone says so: "(not run)".

## Database or backend design

Ask the user, and wait for a yes, before any of:

- a migration or schema change;
- an API, event or RPC contract (OpenAPI, proto, message shape);
- a service's behaviour, ownership or data flow;
- seed or reference data.

The rule holds when a frontend item turns out to need one of these. Ask once per item, and name:

- the service;
- the endpoint or message;
- the migration;
- the options, with your recommendation.

Until it is approved, the item stays open with a note. Never mock the missing backend to unblock the frontend.

## Design first

The project's design source (a Claude Design canvas, a Figma file, a design system) is the source of truth for
every screen. It is usually linked from the project's design doc or the issue. A project with no design source skips
this gate.

- **Never change frontend code before the design shows the change.** The board, or the design system for a shared
  part, is updated first, and the user approves it.
- **A difference between a board and the build is fixed in code,** never by editing the board to match the build.
  Change a board only when the user decides the design itself changes.
- **With no board for the item,** design it first, then build.
- **The proof** is the board and the build side by side at the widths the board draws, in the browser, plus the
  states the board shows (empty, loading, error).
