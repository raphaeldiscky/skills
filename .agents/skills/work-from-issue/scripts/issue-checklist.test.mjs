// Run: node --test .agents/skills/work-from-issue/scripts/

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addNote,
  cancel,
  claimEvents,
  complete,
  coreText,
  findItem,
  holderOf,
  itemKey,
  main,
  markTaken,
  parseItems,
  Refusal,
  release,
  replaceLine,
  setPr,
} from "./issue-checklist.mjs";

const BODY = [
  "## 1. Design sign-off",
  "",
  "- [ ] Every canvas page reviewed at 1440, 834 and 390 (so far checked only in a local render)",
  "- [x] ~~Decide whether the admin side of support chat is designed~~ _Not needed: live chat was dropped (#499)._",
  "- [x] Overview numbers: tests taken as a true count (#540)",
  "  - [ ] States: first visit, no exam date, a test in progress, Premium",
  "- [ ] AI credit packs: prices, expiry and refund rules _Open: see `credit_packs`._",
  "Not an item",
].join("\n");

const T = { session: "abcd1234", date: "2026-11-21", branch: "feat/x" };

test("parses items with their status, nesting and notes", () => {
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
  assert.equal(items[4].core, "AI credit packs: prices, expiry and refund rules");
  assert.equal(items[1].core, "Decide whether the admin side of support chat is designed");
});

test("keys survive notes, markers, strikes and CRLF bodies", () => {
  const line = parseItems(BODY)[0].line;
  const key = itemKey(line.slice(6));
  const taken = markTaken(line, T);
  const noted = addNote(taken, "half done");
  for (const l of [taken, noted, cancel(line, { note: "dropped" })]) {
    assert.equal(parseItems(l)[0].key, key, l);
  }
  assert.equal(parseItems(BODY.replaceAll("\n", "\r\n"))[0].key, key);
  assert.equal(coreText("~~Old~~ _why_"), "Old");
});

test("finds one item by prefix and refuses none or several", () => {
  const items = parseItems(BODY);
  assert.equal(findItem(items, "States:  first").index, 5);
  assert.throws(() => findItem(items, "Nothing like this"), Refusal);
  assert.throws(() => findItem(items, ""), /matches 5 items/);
});

test("claim, link, release, complete and cancel write the documented lines", () => {
  const line = "- [ ] Build the thing";
  const taken = markTaken(line, T);
  assert.equal(taken, "- [ ] Build the thing _(taken: session abcd1234, 2026-11-21, feat/x)_");
  const linked = setPr(taken, 12);
  assert.equal(linked, "- [ ] Build the thing _(taken: session abcd1234, 2026-11-21, feat/x, #12)_");
  assert.equal(markTaken(linked, T), linked, "a re-claim keeps the PR");
  assert.equal(release(linked), "- [ ] Build the thing _(#12, released by session abcd1234)_");
  assert.equal(release(taken), line);
  assert.equal(complete(linked, { pr: 12, note: "checked in Chrome" }), "- [x] Build the thing (#12; checked in Chrome)");
  assert.equal(complete(line, { pr: null, note: "already built in a1b2c3" }), "- [x] Build the thing (already built in a1b2c3)");
  assert.equal(cancel(taken, { note: "Not needed." }), "- [x] ~~Build the thing~~ _Not needed._");
  assert.equal(addNote(taken, "API first"), "- [ ] Build the thing _API first_ _(taken: session abcd1234, 2026-11-21, feat/x)_");
});

test("refuses a closed item, a missing note and a missing PR choice", () => {
  assert.throws(() => markTaken("- [x] Done", T), /already closed/);
  assert.throws(() => setPr("- [ ] Free", 3), /claim it first/);
  assert.throws(() => complete("- [ ] X", { pr: 3 }), /--note/);
  assert.throws(() => complete("- [ ] X", { note: "n" }), /--no-pr/);
  assert.throws(() => cancel("- [ ] X", {}), /--note/);
});

const ev = (id, key, session, action) => ({
  id,
  created_at: `t${id}`,
  body: `<!-- issue-claim v1 key=${key} session=${session} action=${action} -->\ntext`,
});

test("the earliest unreleased claim holds the item; takeover replaces it", () => {
  const events = claimEvents([ev(3, "k", "B", "claim"), ev(1, "k", "A", "claim"), ev(2, "j", "C", "claim")]);
  assert.equal(holderOf(events, "k").session, "A");
  assert.equal(holderOf(claimEvents([ev(1, "k", "A", "claim"), ev(2, "k", "B", "release")]), "k").session, "A");
  assert.equal(holderOf(claimEvents([ev(1, "k", "A", "claim"), ev(2, "k", "A", "release")]), "k"), null);
  const after = claimEvents([ev(1, "k", "A", "claim"), ev(2, "k", "A", "complete"), ev(3, "k", "B", "claim")]);
  assert.equal(holderOf(after, "k").session, "B");
  assert.equal(holderOf(claimEvents([ev(1, "k", "A", "claim"), ev(2, "k", "B", "takeover")]), "k").session, "B");
  assert.equal(holderOf(claimEvents([{ id: 1, body: "plain comment" }]), "k"), null);
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
    this.comments.push({ id, created_at: `t${id}`, body });
    return id;
  }
  deleteComment(id) {
    this.comments = this.comments.filter((c) => c.id !== id);
  }
}

const run = (gh, session, ...args) =>
  main([...args, "--issue", "1", "--repo", "o/r", "--session", session], {}, gh, 0);

test("main: a second session is refused, then the holder links, completes and frees it", async () => {
  const gh = new FakeGitHub(BODY);
  await run(gh, "session-a-123", "claim", "--item", "AI credit packs");
  assert.match(gh.text, /refund rules _Open: see `credit_packs`._ _\(taken: session session-, \d{4}-\d\d-\d\d, /);
  await assert.rejects(run(gh, "session-b-456", "claim", "--item", "AI credit"), (e) => e.code === 2);
  await assert.rejects(run(gh, "session-b-456", "pr", "--item", "AI credit", "--number", "7"), /claim it first/);
  await run(gh, "session-a-123", "pr", "--item", "AI credit", "--number", "7");
  await assert.rejects(run(gh, "session-a-123", "complete", "--item", "AI credit", "--pr", "7"), /--note/);
  await run(gh, "session-a-123", "complete", "--item", "AI credit", "--pr", "7", "--note", "sandbox checkout passed");
  assert.match(gh.text, /- \[x\] AI credit packs: prices, expiry and refund rules _Open: see `credit_packs`._ \(#7; sandbox checkout passed\)/);
  assert.deepEqual(
    claimEvents(gh.comments).map((e) => e.action),
    ["claim", "complete"],
  );
});

test("main: takeover only with --takeover, and a lost claim deletes its comment", async () => {
  const gh = new FakeGitHub(BODY);
  await run(gh, "A", "claim", "--item", "States:");
  await run(gh, "B", "claim", "--item", "States:", "--takeover");
  assert.equal(holderOf(claimEvents(gh.comments), parseItems(gh.text)[3].key).session, "B");
  assert.match(gh.text, /taken: session B,/);

  const race = new FakeGitHub(BODY);
  const key = parseItems(BODY)[0].key;
  race.comment("1", `<!-- issue-claim v1 key=${key} session=A action=claim -->\nx`);
  const original = race.claimComments.bind(race);
  let calls = 0;
  race.claimComments = () => (calls++ === 0 ? [] : original());
  await assert.rejects(run(race, "B", "claim", "--item", "Every canvas"), (e) => e.code === 2);
  assert.deepEqual(
    claimEvents(race.comments).map((e) => e.session),
    ["A"],
  );
});

test("main: --dry-run changes nothing", async () => {
  const gh = new FakeGitHub(BODY);
  await run(gh, "A", "claim", "--item", "States:", "--dry-run");
  assert.equal(gh.text, BODY);
  assert.equal(gh.comments.length, 0);
});
