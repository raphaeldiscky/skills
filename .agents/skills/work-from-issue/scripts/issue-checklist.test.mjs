// Run: node --test .agents/skills/work-from-issue/scripts/

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addItem,
  addNote,
  assignCodes,
  cancel,
  claimEvents,
  codeAll,
  complete,
  formatProblems,
  fullyCoded,
  coreText,
  findItem,
  holderOf,
  itemKey,
  main,
  markTaken,
  parseItems,
  pickLetter,
  Refusal,
  release,
  replaceLine,
  setPr,
  summarizeCodes,
  withCode,
} from "./issue-checklist.mjs";

const BODY = [
  "## 1. Design review",
  "",
  "- [ ] Every page reviewed at desktop, tablet and phone widths (so far checked only locally)",
  "- [x] ~~Decide whether the admin inbox is designed~~ _Not needed: chat was dropped (#99)._",
  "- [x] Dashboard numbers: orders counted exactly (#40)",
  "  - [ ] States: first visit, empty, loading, error",
  "- [ ] Export report: CSV columns and file name _Open: see `report_exports`._",
  "Not an item",
].join("\n");

const SECTIONS = [
  "Intro line",
  "## 1. Design review",
  "- [ ] Pages reviewed",
  "## 2. Product decisions still open",
  "- [ ] Pricing tiers",
  "## 4. Frontend foundations, before any page",
  "- [ ] Tokens",
  "## 5. Features to build",
  "- [ ] Dashboard",
  "### 5a. Dashboard states",
  "  - [ ] Empty state",
  "## 7. E2E findings",
  "- [x] Fixed bug (#12; checked)",
].join("\n");

const T = { session: "abcd1234", date: "2026-11-21", branch: "feat/x" };

test("parses items with their status, nesting, notes and section", () => {
  const items = parseItems(BODY);
  assert.equal(items.length, 5);
  assert.deepEqual(
    items.map((i) => [i.checked, i.cancelled]),
    [
      [false, false],
      [true, true],
      [true, false],
      [false, false],
      [false, false],
    ],
  );
  assert.equal(items[3].lead, "  - ");
  assert.equal(items[4].core, "Export report: CSV columns and file name");
  assert.equal(items[1].core, "Decide whether the admin inbox is designed");
  assert.equal(items[0].heading, "1. Design review");
  assert.equal(items[0].name, "Design review");
  assert.equal(items[0].code, null);
});

test("keys survive codes, notes, markers, strikes and CRLF bodies", () => {
  const line = parseItems(BODY)[0].line;
  const key = itemKey(line.slice(6));
  const taken = markTaken(withCode(line, "D1"), T);
  const noted = addNote(taken, "half done");
  for (const l of [taken, noted, cancel(line, { note: "dropped" }), cancel(withCode(line, "D1"), { note: "x" })]) {
    assert.equal(parseItems(l)[0].key, key, l);
  }
  assert.equal(parseItems(BODY.replaceAll("\n", "\r\n"))[0].key, key);
  assert.equal(coreText("~~Old~~ _why_"), "Old");
  assert.equal(coreText("`D3` ~~Old~~ _why_"), "Old");
});

test("section letters come from the heading, skip taken letters, and ### inherits", () => {
  const { body, codes, headings } = codeAll(SECTIONS);
  assert.deepEqual(codes, ["D1", "P1", "F1", "T1", "T2", "E1"]);
  assert.equal(headings, 5);
  assert.deepEqual(
    body.split("\n").filter((l) => l.startsWith("#")),
    [
      "## D. Design review",
      "## P. Product decisions still open",
      "## F. Frontend foundations, before any page",
      "## T. Features to build",
      "### 5a. Dashboard states",
      "## E. E2E findings",
    ],
  );
  assert.match(body, /^### 5a\. Dashboard states\n {2}- \[ \] `T2` Empty state$/m);
  assert.match(body, /^- \[x\] `E1` Fixed bug \(#12; checked\)$/m);
  assert.deepEqual(codeAll(body), { body, codes: [], headings: 0 }, "a second pass changes nothing");
  assert.ok(fullyCoded(body));
  assert.ok(!fullyCoded(SECTIONS));
  assert.equal(pickLetter("Intro", new Set(["I"])), "A");
  assert.equal(pickLetter("", new Set(["A", "B"])), "C");
  assert.equal(pickLetter("3a. Backends", new Set()), "B");
  assert.equal(summarizeCodes(codes), "D1, P1, F1, T1–T2, E1");
});

test("a heading's own letter wins and is never given to another section", () => {
  const body = ["## X. Extras", "- [ ] One", "## B. Backlog", "## Bugs", "- [ ] Two"].join("\n");
  const { body: next, codes } = codeAll(body);
  assert.deepEqual(codes, ["X1", "A1"]);
  assert.match(next, /^## A\. Bugs$/m);
  assert.match(next, /^## B\. Backlog$/m);
});

test("check reports where an issue departs from the layout", () => {
  const body = [
    "- [ ] `Z1` Above every heading",
    "## A. Alpha",
    "- [ ] `A1` Fine",
    "  - [ ] `A2` Sub-step",
    "    - [ ] `A3` Too deep",
    "## A. Again",
    "- [ ] Uncoded " + "x".repeat(200),
    "## Unlettered",
    "- [ ] `U1` Fine",
    "- [ ] `U1` Twice",
  ].join("\n");
  assert.deepEqual(formatProblems(body), [
    "line 6: letter A also heads line 2",
    'line 8: heading "Unlettered" has no letter; run ids',
    "line 1 (Z1): item above the first section heading",
    "line 5 (A3): nested more than one level",
    "line 7: no code; run ids",
    "line 7: 208 characters; move detail into a note or a sub-item",
    "code U1 is used twice",
  ]);
  assert.deepEqual(formatProblems(codeAll(SECTIONS).body.replace("Intro line\n", "")), []);
});

test("a new code takes its section's letter and the next number for that letter anywhere", () => {
  const body = [
    "## Design",
    "- [ ] `D1` One",
    "- [ ] `D2` Two",
    "## Backend",
    "- [ ] `B1` Moved here",
    "- [ ] `D7` Moved from Design",
    "- [ ] `B2` Three",
    "- [ ] New backend item",
    "## Docs",
    "- [ ] New docs item",
  ].join("\n");
  const items = parseItems(body);
  const codes = assignCodes(items, items.filter((it) => !it.code));
  assert.deepEqual([...codes.values()], ["B3", "A1"]);
  const after = assignCodes(items, [{ index: -1, section: 0, heading: "Design" }]);
  assert.equal(after.get(-1), "D8");
});

test("finds one item by code or prefix and refuses none, several or a duplicate code", () => {
  const items = parseItems(codeAll(BODY).body);
  assert.equal(findItem(items, "d4").core, "States: first visit, empty, loading, error");
  assert.equal(findItem(items, "States:  first").code, "D4");
  assert.throws(() => findItem(items, "Nothing like this"), Refusal);
  assert.throws(() => findItem(items, ""), /matches 5 items/);
  const dup = parseItems("- [ ] `D1` A\n- [ ] `D1` B");
  assert.throws(() => findItem(dup, "D1"), /share code D1/);
  assert.throws(() => codeAll("- [ ] `D1` A\n- [ ] `D1` B\n- [ ] C"), /used twice: D1/);
});

test("claim, link, release, complete and cancel keep the code and write the documented lines", () => {
  const line = "- [ ] `D3` Build the thing";
  const taken = markTaken(line, T);
  assert.equal(taken, "- [ ] `D3` Build the thing _(taken: session abcd1234, 2026-11-21, feat/x)_");
  const linked = setPr(taken, 12);
  assert.equal(linked, "- [ ] `D3` Build the thing _(taken: session abcd1234, 2026-11-21, feat/x, #12)_");
  assert.equal(markTaken(linked, T), linked, "a re-claim keeps the PR");
  assert.equal(release(linked), "- [ ] `D3` Build the thing _(#12, released by session abcd1234)_");
  assert.equal(release(taken), line);
  assert.equal(complete(linked, { pr: 12, note: "checked in Chrome" }), "- [x] `D3` Build the thing (#12; checked in Chrome)");
  assert.equal(complete(line, { pr: null, note: "built in a1b2c3" }), "- [x] `D3` Build the thing (built in a1b2c3)");
  assert.equal(cancel(taken, { note: "Not needed." }), "- [x] `D3` ~~Build the thing~~ _Not needed._");
  assert.equal(addNote(taken, "API first"), "- [ ] `D3` Build the thing _API first_ _(taken: session abcd1234, 2026-11-21, feat/x)_");
  assert.equal(withCode("- [ ] Plain", "B2"), "- [ ] `B2` Plain");
  assert.equal(withCode(line, "B2"), line, "a code never changes");
});

test("refuses a closed item, a missing note and a missing PR choice", () => {
  assert.throws(() => markTaken("- [x] Done", T), /already closed/);
  assert.throws(() => setPr("- [ ] Free", 3), /claim it first/);
  assert.throws(() => complete("- [ ] X", { pr: 3 }), /--note/);
  assert.throws(() => complete("- [ ] X", { note: "n" }), /--no-pr/);
  assert.throws(() => cancel("- [ ] X", {}), /--note/);
});

test("add puts a coded item at the end of the section and leaves the rest alone", () => {
  const body = codeAll(SECTIONS).body;
  const { body: next, code, line } = addItem(body, 3, "Progress page");
  assert.equal(code, "T3");
  assert.equal(line, "- [ ] `T3` Progress page");
  const lines = next.split("\n");
  assert.equal(lines[lines.indexOf("  - [ ] `T2` Empty state") + 1], line);
  assert.equal(lines.filter((l) => l !== line).join("\n"), body);
  assert.equal(addItem("## Empty\n\nText", 0, "First").body, "## Empty\n- [ ] `E1` First\n\nText");
});

const ev = (id, key, session, action) => ({
  id,
  created_at: `t${id}`,
  body: `<!-- issue-claim v1 key=${key} session=${session} action=${action} -->\ntext`,
});

test("the earliest unreleased claim holds the item; takeover replaces it; old hash keys still count", () => {
  const events = claimEvents([ev(3, "k", "B", "claim"), ev(1, "k", "A", "claim"), ev(2, "j", "C", "claim")]);
  assert.equal(holderOf(events, "k").session, "A");
  assert.equal(holderOf(claimEvents([ev(1, "k", "A", "claim"), ev(2, "k", "B", "release")]), "k").session, "A");
  assert.equal(holderOf(claimEvents([ev(1, "k", "A", "claim"), ev(2, "k", "A", "release")]), "k"), null);
  const after = claimEvents([ev(1, "k", "A", "claim"), ev(2, "k", "A", "complete"), ev(3, "k", "B", "claim")]);
  assert.equal(holderOf(after, "k").session, "B");
  assert.equal(holderOf(claimEvents([ev(1, "k", "A", "claim"), ev(2, "k", "B", "takeover")]), "k").session, "B");
  assert.equal(holderOf(claimEvents([{ id: 1, body: "plain comment" }]), "k"), null);
  const mixed = claimEvents([ev(1, "abc123", "A", "claim"), ev(2, "D3", "A", "release")]);
  assert.equal(holderOf(mixed, ["D3", "abc123"]), null, "a release by code ends a claim made by hash");
  assert.equal(holderOf(mixed.slice(0, 1), ["D3", "abc123"]).session, "A");
});

test("replaceLine keeps the line ending", () => {
  assert.equal(replaceLine("a\r\nb\r\nc", 1, "B"), "a\r\nB\r\nc");
});

class FakeGitHub {
  constructor(body) {
    this.text = body;
    this.comments = [];
    this.nextId = 1;
  }
  body() {
    return this.text;
  }
  setBody(_issue, body) {
    this.text = body;
  }
  claimComments() {
    return this.comments.map((c) => ({ ...c }));
  }
  comment(_issue, body) {
    const id = this.nextId++;
    this.comments.push({ id, created_at: `2026-11-21T00:00:0${id}Z`, body });
    return id;
  }
  deleteComment(id) {
    this.comments = this.comments.filter((c) => c.id !== id);
  }
}

const capture = async (fn) => {
  const out = [];
  const log = console.log;
  console.log = (...a) => out.push(a.join(" "));
  try {
    await fn();
  } finally {
    console.log = log;
  }
  return out;
};

const run = (gh, session, ...args) =>
  main([...args, "--issue", "1", "--repo", "o/r", "--session", session], {}, gh, 0);

test("main: a claim codes the item, a second session is refused, the holder links and completes it", async () => {
  const gh = new FakeGitHub(BODY);
  const out = await capture(() => run(gh, "session-a-123", "claim", "--item", "Export report"));
  assert.deepEqual(out, ["claimed D1"]);
  assert.match(gh.text, /- \[ \] `D1` Export report: CSV columns and file name _Open: see `report_exports`._ _\(taken: session session-, \d{4}-\d\d-\d\d, /);
  assert.match(gh.comments[0].body, /key=D1 .*\nTaken by session `session-`: `D1` Export report/);
  await assert.rejects(run(gh, "session-b-456", "claim", "--item", "d1"), (e) => e.code === 2 && /^D1 is taken/.test(e.message));
  await assert.rejects(run(gh, "session-b-456", "pr", "--item", "D1", "--number", "7"), /claim it first/);
  await run(gh, "session-a-123", "pr", "--item", "D1", "--number", "7");
  await assert.rejects(run(gh, "session-a-123", "complete", "--item", "D1", "--pr", "7"), /--note/);
  await run(gh, "session-a-123", "complete", "--item", "D1", "--pr", "7", "--note", "sandbox checkout passed");
  assert.match(gh.text, /- \[x\] `D1` Export report: CSV columns and file name _Open: see `report_exports`._ \(#7; sandbox checkout passed\)/);
  await assert.rejects(run(gh, "session-a-123", "complete", "--item", "D1", "--no-pr", "--note", "again"), /already closed/);
  assert.deepEqual(
    claimEvents(gh.comments).map((e) => e.action),
    ["claim", "complete"],
  );
  assert.ok(gh.comments.every((c) => / `D1` /.test(c.body)), "every comment names the code");
});

test("main: a claim made by hash before the code still holds after ids", async () => {
  const gh = new FakeGitHub(BODY);
  const key = parseItems(BODY)[4].key;
  gh.comment("1", `<!-- issue-claim v1 key=${key} session=A action=claim -->\nold`);
  await run(gh, "A", "ids");
  await assert.rejects(run(gh, "B", "claim", "--item", "D5"), (e) => e.code === 2);
  await run(gh, "A", "release", "--item", "D5");
  await run(gh, "B", "claim", "--item", "D5");
  assert.match(gh.text, /`D5` Export report.*taken: session B,/);
});

test("main: takeover only with --takeover, and a lost claim deletes its comment", async () => {
  const gh = new FakeGitHub(BODY);
  await run(gh, "A", "claim", "--item", "States:");
  await run(gh, "B", "claim", "--item", "States:", "--takeover");
  assert.equal(holderOf(claimEvents(gh.comments), "D1").session, "B");
  assert.match(gh.text, /`D1` States: .*taken: session B,/);

  const race = new FakeGitHub(codeAll(BODY).body);
  race.comment("1", `<!-- issue-claim v1 key=D1 session=A action=claim -->\nx`);
  const original = race.claimComments.bind(race);
  let calls = 0;
  race.claimComments = () => (calls++ === 0 ? [] : original());
  await assert.rejects(run(race, "B", "claim", "--item", "D1"), (e) => e.code === 2);
  assert.deepEqual(
    claimEvents(race.comments).map((e) => e.session),
    ["A"],
  );
});

test("main: a lost write is reapplied with a fresh code, so two writers never share one", async () => {
  const gh = new FakeGitHub(BODY);
  const setBody = gh.setBody.bind(gh);
  let first = true;
  gh.setBody = (issue, body) => {
    if (first) {
      first = false;
      gh.text = addItem(gh.text, 0, "Written by another session").body;
      return;
    }
    setBody(issue, body);
  };
  await run(gh, "A", "add", "--section", "design", "--text", "Mine");
  const items = parseItems(gh.text);
  assert.deepEqual(
    items.filter((it) => it.code).map((it) => [it.code, it.core]),
    [
      ["D1", "Written by another session"],
      ["D2", "Mine"],
    ],
  );
});

test("main: list, show and next print short lines; --dry-run changes nothing", async () => {
  const gh = new FakeGitHub(codeAll(SECTIONS).body);
  await run(gh, "A", "claim", "--item", "P1");
  const list = await capture(() => run(gh, "A", "list"));
  assert.ok(list.includes("## D  Design review: 1 todo, 0 taken, 0 done, 0 cancelled"), list.join("\n"));
  assert.ok(list.some((l) => /^P1 +taken A 2026-11-21 Pricing tiers$/.test(l)), list.join("\n"));
  assert.ok(!list.some((l) => l.startsWith("E1")), "closed items are hidden");
  assert.deepEqual(await capture(() => run(gh, "A", "list", "--section", "T")), ["T1   todo      Dashboard", "T2   todo      Empty state"]);
  assert.deepEqual(await capture(() => run(gh, "A", "list", "--status", "mine")), [list.find((l) => l.startsWith("P1"))]);
  assert.deepEqual(await capture(() => run(gh, "A", "next", "--section", "P")), ["no free item"]);
  assert.deepEqual(await capture(() => run(gh, "A", "next")), ["D1   todo      Pages reviewed"]);
  const show = await capture(() => run(gh, "A", "show", "--item", "p1"));
  assert.equal(show[0], 'P1 taken A 2026-11-21 in "P. Product decisions still open"');
  assert.match(show[2], /claim A$/);

  const before = gh.text;
  const comments = gh.comments.length;
  const dry = await capture(() => run(gh, "B", "add", "--section", "D", "--text", "New", "--dry-run"));
  assert.deepEqual(dry, ["+ - [ ] `D2` New", "would add D2"]);
  await run(gh, "B", "claim", "--item", "D1", "--dry-run");
  assert.equal(gh.text, before);
  assert.equal(gh.comments.length, comments);

  const fresh = new FakeGitHub(BODY);
  const ids = await capture(() => run(fresh, "A", "ids", "--dry-run"));
  assert.deepEqual(ids, ["would code 5 items: D1–D5; lettered 1 headings"]);
  assert.equal(fresh.text, BODY);
});
