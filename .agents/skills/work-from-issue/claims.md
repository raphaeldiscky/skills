# Claims protocol

## Statuses in the issue body

| Status    | Line                                                                          |
| --------- | ----------------------------------------------------------------------------- |
| Todo      | `` - [ ] `D3` text ``                                                         |
| Taken     | `` - [ ] `D3` text _(taken: session abcd1234, 2026-11-21, feat/branch, #57)_ `` |
| Completed | `` - [x] `D3` text (#57; what was verified) ``                                |
| Cancelled | `` - [x] `D3` ~~text~~ _why_ ``                                               |

- The taken marker always ends the line. `#57` appears once the PR is linked.
- A note added with `note` sits before the marker, in italics.
- A released item drops the marker. If it had a PR, it keeps `_(#57, released by session abcd1234)_`.
- Completed and cancelled lines always carry a note. A closed item can't be completed or cancelled again.

## Item codes

Every item is named by its code (layout in [format.md](format.md)). A command on an item without one gives it the
next code first, in the same way as any other body edit. `ids` codes every item and letters every section heading
at once.

## Claims are comments

GitHub has no compare-and-set on an issue body: the last write wins. So the body only shows the status, and
claims are decided by comments, which are append-only.

Each claim comment carries a hidden marker, and its visible text names the code:

```
<!-- issue-claim v1 key=D3 session=<full session id> action=claim|takeover|release|complete|cancel -->
Taken by session `abcd1234`: `D3` Export report: CSV columns and file name
```

- **The holder** of an item is the earliest `claim` (by comment id) that its own session has not since released,
  completed or cancelled. A `takeover` replaces the holder.
- **Racing claims:** a session posts its claim, waits about 2 s, and reads the comments again. If an earlier claim
  holds the item, it deletes its own comment and exits 2. Both racers read the same order, so exactly one wins.
- **`key`** is the item's code. Claims made before items had codes carry a 12-hex hash of the item's first 60
  characters; the helper still counts them, so adding codes never frees a taken item.

## Body edits

Each change reads the body and changes only the lines it needs. It writes the body back, re-reads it after about 3 s,
and checks its change is there. If it was lost because another session wrote at the same moment, it computes the
change again on the new body (a new code takes the next free number) and reapplies it, up to 5 times. Every writer
checks its own change, so a lost edit gets reapplied by its owner.

## Takeover

A claim from a session that crashed or ended stays until someone releases it. Takeover always goes through the user:

1. Report the holder (8-character session id), the claim time, and the branch and PR in the marker.
2. Check whether that session still runs. Claude Code's `ListAgents` lists the local sessions.
3. Ask. Only after a yes, run `claim --takeover`. The comment records that the user agreed.
