# Issue layout

One shape for every checklist issue, so people can scan it and the helper can parse it. `check` reports where an
issue departs from it; `ids` adds the codes and the heading letters.

```markdown
What this issue delivers, in one or two sentences, with links to the plan or design.

## D. Design review

- [ ] `D1` Every page reviewed at desktop, tablet and phone widths
- [x] `D2` Empty states drawn (#12; checked in the browser)

## B. Backend

### Reports

- [ ] `B1` Export report: CSV columns and file name _Open: which time zone?_
  - [ ] `B2` Large exports run in the background
- [x] `B3` ~~Excel export~~ _Dropped: CSV covers every request._

### Notifications

- [ ] `B4` Weekly digest email _(taken: session abcd1234, 2026-11-21, feat/digest, #57)_
```

## Sections

- A section is a `##` heading: `## <letter>. <name>`. The letter is unique in the issue and starts every code in it.
- Order sections by when the work happens: decisions and design first, then backend, frontend, verification.
- `###` groups items inside a section by feature or area. A group has no letter; its items use the section's.
- Every item sits under a section. The text above the first section says what the issue delivers, nothing to tick.

## Items

- `` - [ ] `D3` <what is delivered> ``: one deliverable a session can claim, build and close with one PR.
- Lead with the noun a reader scans for (the page, endpoint or table), then what must be true. Keep it under
  ~200 characters; detail goes in a note or a sub-item.
- A sub-item is a step of its parent, one level deep at most. It has its own code and is claimed on its own.
- Notes are italic and follow the text: `_Open: …_`, `_exists: …; missing: …_`. The helper writes the status
  markers ([claims.md](claims.md)); don't type them by hand.
- Add items with `add`, not by editing the body, so they get the next code.

## Codes

- Codes never change and are never reused, even when an item moves to another section or closes.
- `ids` turns a numbered heading (`## 2. Name`) into a lettered one (`## P. Name`) and rewrites `§2` in the issue to
  `§P`. It prints the mapping; references outside the issue keep the old number.
- A new code takes its section's letter and the next number for that letter in the whole issue.
- Name items by code everywhere else: `#42 D3` in commits, PRs, comments and to the user.
