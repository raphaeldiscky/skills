# Claims protocol

## Statuses in the issue body

| Status    | Line                                                                    |
| --------- | ----------------------------------------------------------------------- |
| Todo      | `- [ ] text`                                                            |
| Taken     | `- [ ] text _(taken: session abcd1234, 2026-11-21, feat/branch, #57)_` |
| Completed | `- [x] text (#57; what was verified)`                                   |
| Cancelled | `- [x] ~~text~~ _why_`                                                  |

- The taken marker always ends the line. `#57` appears once the PR is linked.
- A note added with `note` sits before the marker, in italics.
- A released item drops the marker. If it had a PR, it keeps `_(#57, released by session abcd1234)_`.
- Completed and cancelled lines always carry a note.

## Claims are comments

GitHub has no compare-and-set on an issue body: the last write wins. So the body only shows the status, and
claims are decided by comments, which are append-only.

Each claim comment carries a hidden marker:

```
<!-- issue-claim v1 key=<12 hex> session=<full session id> action=claim|takeover|release|complete|cancel -->
```

- **The holder** of an item is the earliest `claim` (by comment id) that its own session has not since released,
  completed or cancelled. A `takeover` replaces the holder.
- **Racing claims:** a session posts its claim, waits about 2 s, and reads the comments again. If an earlier claim
  holds the item, it deletes its own comment and exits 2. Both racers read the same order, so exactly one wins.
- **`key`** is a hash of the first 60 characters of the item's own text: no status box, no `~~`, and nothing from
  the first ` _` on. Notes and markers therefore never move a claim. Two items that share those 60 characters
  share a key, and the helper refuses them until one is reworded.

## Body edits

Each change reads the body and changes only the matched line. It writes the body back, re-reads it after about 3 s,
and checks the line. If the line was lost because another session wrote at the same moment, it applies the change
again, up to 5 times. Every writer checks its own line, so a lost edit gets reapplied by its owner.

## Takeover

A claim from a session that crashed or ended stays until someone releases it. Takeover always goes through the user:

1. Report the holder (8-character session id), the claim time, and the branch and PR in the marker.
2. Check whether that session still runs. Claude Code's `ListAgents` lists the local sessions.
3. Ask. Only after a yes, run `claim --takeover`. The comment records that the user agreed.
