#!/usr/bin/env node
// Claims, links and closes the items of a GitHub issue checklist so parallel agent sessions never take one item twice.
// Protocol: ../claims.md. Run with --help for usage.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

export const MARKER = "issue-claim v1";
const ITEM = /^(\s*[-*] )\[( |x|X)\] (.*)$/;
const CODE = /^`([A-Z]{1,2}\d+)` /;
const CODE_ARG = /^[A-Za-z]{1,2}\d+$/;
const SECTION = /^#{1,2} (.*)$/;
const LETTERED = /^([A-Z]{1,2})\. (.+)$/;
const TAKEN = / _\(taken: ([^)]*)\)_$/;
const COMMENT = /<!-- issue-claim v1 key=(\w+) session=(\S+) action=(\w+) -->/;
const KEY_CHARS = 60;
const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

export class Refusal extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

const normalize = (s) => s.replace(/\s+/g, " ").trim();
const cut = (s, n) => (n && s.length > n ? s.slice(0, n - 1) + "…" : s);

// The item's own words: no code, no status box, no strike, no taken marker, and nothing from the first note on.
export function coreText(text) {
  let t = text.replace(CODE, "").replace(TAKEN, "");
  const note = t.indexOf(" _");
  if (note >= 0) t = t.slice(0, note);
  return normalize(t.replace(/~~/g, ""));
}

// Claims made before an item had a code are keyed by this hash; coreText drops the code, so it never moves.
export const itemKey = (text) =>
  createHash("sha1").update(coreText(text).slice(0, KEY_CHARS)).digest("hex").slice(0, 12);

// A section is a # or ## heading; "## D. Design sign-off" names its letter, "## 1. Design sign-off" leaves it open.
export function parseSections(body) {
  const sections = [];
  body.split("\n").forEach((raw, index) => {
    const line = raw.replace(/\r$/, "");
    const m = SECTION.exec(line);
    if (!m) return;
    const title = normalize(m[1]);
    const lettered = LETTERED.exec(title);
    sections.push({
      id: sections.length,
      index,
      hashes: line.slice(0, line.indexOf(" ")),
      title,
      letter: lettered?.[1] ?? null,
      name: lettered ? lettered[2] : title.replace(/^\d+[a-z]?\.\s+/, ""),
    });
  });
  return sections;
}

// The returned array also carries .sections, so code assignment sees letters of sections with no items yet.
export function parseItems(body) {
  const sections = parseSections(body);
  const items = [];
  items.sections = sections;
  let section = -1;
  body.split("\n").forEach((raw, index) => {
    if (sections[section + 1]?.index === index) section++;
    const line = raw.replace(/\r$/, "");
    const m = ITEM.exec(line);
    if (!m) return;
    const text = m[3];
    const code = CODE.exec(text)?.[1] ?? null;
    items.push({
      index,
      line,
      lead: m[1],
      box: m[2],
      checked: m[2] !== " ",
      cancelled: text.replace(CODE, "").startsWith("~~"),
      text,
      code,
      core: coreText(text),
      key: itemKey(text),
      taken: parseTaken(text),
      section,
      heading: sections[section]?.title ?? "",
      name: sections[section]?.name ?? "",
    });
  });
  return items;
}

export function parseTaken(text) {
  const m = TAKEN.exec(text);
  if (!m) return null;
  const [session, date, branch, pr] = m[1].split(", ");
  return { session: session.replace(/^session /, ""), date, branch, pr: pr ? Number(pr.slice(1)) : null };
}

const splitCode = (code) => {
  const [, letter, n] = /^([A-Z]+)(\d+)$/.exec(code);
  return { letter, n: Number(n) };
};

// A section's letter: the one its heading names, else the one its codes use most; absent when it has neither.
export function sectionLetters(items) {
  const letters = new Map();
  for (const s of items.sections ?? []) if (s.letter) letters.set(s.id, s.letter);
  const counts = new Map();
  for (const it of items) {
    if (!it.code || letters.has(it.section)) continue;
    const per = counts.get(it.section) ?? new Map();
    const { letter } = splitCode(it.code);
    per.set(letter, (per.get(letter) ?? 0) + 1);
    counts.set(it.section, per);
  }
  for (const [section, per] of counts) {
    letters.set(section, [...per].reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0]);
  }
  return letters;
}

export function pickLetter(title, taken) {
  const words = title
    .split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z0-9]+/, ""))
    .filter((w) => /^[A-Za-z]/.test(w));
  for (const w of words) if (!taken.has(w[0].toUpperCase())) return w[0].toUpperCase();
  for (const l of LETTERS) if (!taken.has(l)) return l;
  for (const a of LETTERS) for (const b of LETTERS) if (!taken.has(a + b)) return a + b;
  throw new Refusal("no section letter left");
}

// Codes for the target items: their section's letter and the next number for that letter in the whole body.
export function assignCodes(items, targets) {
  const max = new Map();
  for (const it of items) {
    if (!it.code) continue;
    const { letter, n } = splitCode(it.code);
    max.set(letter, Math.max(max.get(letter) ?? 0, n));
  }
  const letters = sectionLetters(items);
  const taken = new Set([...max.keys(), ...letters.values()]);
  const codes = new Map();
  for (const it of targets) {
    let letter = letters.get(it.section);
    if (!letter) {
      letter = pickLetter(it.name, taken);
      letters.set(it.section, letter);
      taken.add(letter);
    }
    const n = (max.get(letter) ?? 0) + 1;
    max.set(letter, n);
    codes.set(it.index, `${letter}${n}`);
  }
  return codes;
}

export function duplicateCodes(items) {
  const seen = new Map();
  for (const it of items) if (it.code) seen.set(it.code, (seen.get(it.code) ?? 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([c]) => c);
}

export function findItem(items, sel) {
  if (CODE_ARG.test(sel.trim())) {
    const hit = findByCode(items, sel.trim().toUpperCase());
    if (hit) return hit;
  }
  const want = normalize(sel);
  const hits = items.filter((it) => it.core.startsWith(want));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) throw new Refusal(`no checklist item has code or starts with "${want}"`);
  throw new Refusal(
    `"${want}" matches ${hits.length} items; pass a code:\n${hits.map((h) => `  ${h.code ?? "-"}  ${cut(h.core, 80)}`).join("\n")}`,
  );
}

export function findByCode(items, code) {
  const hits = items.filter((it) => it.code === code);
  if (hits.length > 1) throw new Refusal(`${hits.length} items share code ${code}; fix the issue by hand`);
  return hits[0] ?? null;
}

export function findByKey(items, key) {
  const hits = items.filter((it) => it.key === key);
  if (hits.length > 1) throw new Refusal(`${hits.length} items share key ${key}; give them codes with ids`);
  return hits[0] ?? null;
}

export function findSection(items, sel) {
  const sections = items.sections ?? [];
  const letters = sectionLetters(items);
  if (/^[A-Za-z]{1,2}$/.test(sel)) {
    const hit = sections.find((s) => letters.get(s.id) === sel.toUpperCase());
    if (hit) return hit.id;
  }
  const want = sel.toLowerCase();
  const hits = sections.filter((s) => s.title.toLowerCase().includes(want));
  if (hits.length === 1) return hits[0].id;
  throw new Refusal(`${hits.length ? `${hits.length} sections match` : "no section matches"} "${sel}"; pass its letter`);
}

const parse = (line) => {
  const it = parseItems(line)[0];
  if (!it) throw new Refusal(`not a checklist line: ${line}`);
  return it;
};

export function withCode(line, code) {
  const it = parse(line);
  return it.code ? line : `${it.lead}[${it.box}] \`${code}\` ${it.text}`;
}

const takenMarker = (t) =>
  ` _(taken: session ${t.session}, ${t.date}, ${t.branch}${t.pr ? `, #${t.pr}` : ""})_`;

const withoutMarker = (it) => it.text.replace(TAKEN, "");

export function markTaken(line, { session, date, branch }) {
  const it = parse(line);
  if (it.checked) throw new Refusal("the item is already closed");
  const pr = it.taken?.session === session ? it.taken.pr : null;
  return `${it.lead}[ ] ${withoutMarker(it)}${takenMarker({ session, date, branch, pr })}`;
}

export function setPr(line, pr) {
  const it = parse(line);
  if (!it.taken) throw new Refusal("the item is not taken; claim it first");
  return `${it.lead}[ ] ${withoutMarker(it)}${takenMarker({ ...it.taken, pr })}`;
}

export function release(line) {
  const it = parse(line);
  const pr = it.taken?.pr ? ` _(#${it.taken.pr}, released by session ${it.taken.session})_` : "";
  return `${it.lead}[ ] ${withoutMarker(it)}${pr}`;
}

export function complete(line, { pr, note }) {
  if (!note) throw new Refusal("complete needs --note: what was checked, or (not run)");
  if (pr === undefined) throw new Refusal("complete needs --pr N, or --no-pr when no code changed");
  const it = parse(line);
  return `${it.lead}[x] ${withoutMarker(it)} (${pr ? `#${pr}; ` : ""}${note})`;
}

export function cancel(line, { note }) {
  if (!note) throw new Refusal("cancel needs --note with the reason");
  const it = parse(line);
  const code = it.code ? `\`${it.code}\` ` : "";
  const text = withoutMarker(it).replace(CODE, "").replace(/~~/g, "");
  return `${it.lead}[x] ${code}~~${text}~~ _${note}_`;
}

export function addNote(line, text) {
  if (!text) throw new Refusal("note needs --text");
  const it = parse(line);
  const marker = it.taken ? takenMarker(it.taken) : "";
  return `${it.lead}[${it.checked ? "x" : " "}] ${withoutMarker(it)} _${text}_${marker}`;
}

// Inserts a new top-level item after the section's last item, or under its heading when it has none.
export function addItem(body, section, text) {
  if (!text) throw new Refusal("add needs --text");
  const items = parseItems(body);
  const inSection = items.filter((it) => it.section === section);
  const heading = parseSections(body)[section];
  const after = inSection.length ? inSection.at(-1).index : heading?.index;
  if (after === undefined) throw new Refusal("the issue has no such section");
  const probe = { index: -1, section, heading: heading?.title ?? "", name: heading?.name ?? "" };
  const code = assignCodes(items, [probe]).get(-1);
  const line = `- [ ] \`${code}\` ${normalize(text)}`;
  const lines = body.split("\n");
  const cr = lines[after].endsWith("\r") ? "\r" : "";
  lines.splice(after + 1, 0, line + cr);
  return { body: lines.join("\n"), line, code };
}

export function codeAll(body) {
  const items = parseItems(body);
  const dupes = duplicateCodes(items);
  if (dupes.length) throw new Refusal(`codes used twice: ${dupes.join(", ")}; fix the issue by hand`);
  const targets = items.filter((it) => !it.code);
  const codes = assignCodes(items, targets);
  let next = body;
  for (const it of targets) next = replaceLine(next, it.index, withCode(it.line, codes.get(it.index)));
  const coded = parseItems(next);
  const letters = sectionLetters(coded);
  const headings = coded.sections.filter((s) => !s.letter && letters.has(s.id));
  for (const s of headings) next = replaceLine(next, s.index, `${s.hashes} ${letters.get(s.id)}. ${s.name}`);
  return { body: next, codes: targets.map((it) => codes.get(it.index)), headings: headings.length };
}

// True when every item has a unique code and every section with items names its letter.
export function fullyCoded(body) {
  const items = parseItems(body);
  const letters = new Set(items.sections.filter((s) => s.letter).map((s) => s.id));
  return items.every((it) => it.code && (it.section < 0 || letters.has(it.section))) && !duplicateCodes(items).length;
}

// Where the body departs from format.md, one line each.
export function formatProblems(body) {
  const items = parseItems(body);
  const problems = [];
  const seen = new Map();
  for (const s of items.sections) {
    const has = items.some((it) => it.section === s.id);
    if (has && !s.letter) problems.push(`line ${s.index + 1}: heading "${cut(s.title, 40)}" has no letter; run ids`);
    if (s.letter && seen.has(s.letter)) problems.push(`line ${s.index + 1}: letter ${s.letter} also heads line ${seen.get(s.letter) + 1}`);
    if (s.letter) seen.set(s.letter, s.index);
  }
  for (const it of items) {
    const where = `line ${it.index + 1}${it.code ? ` (${it.code})` : ""}`;
    if (it.section < 0) problems.push(`${where}: item above the first section heading`);
    if (!it.code) problems.push(`${where}: no code; run ids`);
    if (it.lead.length > 4) problems.push(`${where}: nested more than one level`);
    if (it.core.length > 200) problems.push(`${where}: ${it.core.length} characters; move detail into a note or a sub-item`);
  }
  for (const c of duplicateCodes(items)) problems.push(`code ${c} is used twice`);
  return problems;
}

// "D1–D9, P1–P4" for a list of new codes, grouped by letter.
export function summarizeCodes(codes) {
  const by = new Map();
  for (const c of codes) {
    const { letter, n } = splitCode(c);
    by.set(letter, [...(by.get(letter) ?? []), n]);
  }
  return [...by]
    .map(([l, ns]) => {
      const lo = Math.min(...ns);
      const hi = Math.max(...ns);
      return lo === hi ? `${l}${lo}` : `${l}${lo}–${l}${hi}`;
    })
    .join(", ");
}

export function claimEvents(comments) {
  return comments
    .map((c) => {
      const m = COMMENT.exec(c.body ?? "");
      return m && { id: c.id, at: c.created_at, key: m[1], session: m[2], action: m[3] };
    })
    .filter(Boolean)
    .sort((a, b) => a.id - b.id);
}

// The earliest claim that its holder has not released; a takeover replaces the holder.
export function holderOf(events, keys) {
  const wanted = [keys].flat().filter(Boolean);
  let holder = null;
  for (const e of events) {
    if (!wanted.includes(e.key)) continue;
    if (e.action === "claim" && !holder) holder = e;
    else if (e.action === "takeover") holder = e;
    else if (["release", "complete", "cancel"].includes(e.action) && holder?.session === e.session) holder = null;
  }
  return holder;
}

export function replaceLine(body, index, line) {
  const lines = body.split("\n");
  const cr = lines[index].endsWith("\r") ? "\r" : "";
  lines[index] = line + cr;
  return lines.join("\n");
}

const short = (session) => session.slice(0, 8);

class GitHub {
  constructor(repo) {
    this.repo = repo;
  }

  api(args, input) {
    return execFileSync("gh", ["api", ...args], {
      input: input === undefined ? undefined : JSON.stringify(input),
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  }

  body(issue) {
    return JSON.parse(this.api([`repos/${this.repo}/issues/${issue}`])).body ?? "";
  }

  setBody(issue, body) {
    this.api(["-X", "PATCH", `repos/${this.repo}/issues/${issue}`, "--input", "-"], { body });
  }

  claimComments(issue) {
    const out = this.api([
      "--paginate",
      `repos/${this.repo}/issues/${issue}/comments`,
      "--jq",
      `.[] | select(.body | contains("${MARKER}")) | {id, created_at, body}`,
    ]);
    return out.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  }

  comment(issue, body) {
    return JSON.parse(this.api([`repos/${this.repo}/issues/${issue}/comments`, "--input", "-"], { body })).id;
  }

  deleteComment(id) {
    this.api(["-X", "DELETE", `repos/${this.repo}/issues/comments/${id}`]);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lineSet = (body) => new Set(body.split("\n").map((l) => l.replace(/\r$/, "")));

// Last write wins on an issue body, so each writer re-reads and reapplies its own change until it sticks.
// change(body) returns { body, done(freshBody), result }, or null when nothing needs writing.
async function editBody(gh, issue, change, { dryRun, settleMs, show }) {
  let pending = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const body = gh.body(issue);
    if (pending?.done(body)) return pending.result;
    const next = change(body);
    if (!next) return null;
    if (dryRun) {
      show(next);
      return next.result;
    }
    pending = next;
    gh.setBody(issue, next.body);
    await sleep(settleMs);
  }
  if (pending.done(gh.body(issue))) return pending.result;
  throw new Refusal("the issue body kept changing; the edit did not stick after 5 tries");
}

// ref is { code } or, for an item without one, { key }; transform(item, items) returns the new line.
async function editLine(gh, issue, ref, transform, opts) {
  let current = null;
  const result = await editBody(
    gh,
    issue,
    (body) => {
      const items = parseItems(body);
      const it = ref.code ? findByCode(items, ref.code) : findByKey(items, ref.key);
      if (!it) throw new Refusal(`the item (${ref.code ?? `key ${ref.key}`}) is no longer in the issue`);
      current = it.line;
      const line = transform(it, items);
      if (line === it.line) return null;
      return { body: replaceLine(body, it.index, line), done: (b) => lineSet(b).has(line), result: line, old: it.line };
    },
    { ...opts, show: (n) => console.log(`- ${cut(n.old, opts.width)}\n+ ${cut(n.result, opts.width)}`) },
  );
  return result ?? current;
}

const coded = (it, items) => (it.code ? it.line : withCode(it.line, assignCodes(items, [it]).get(it.index)));

function markerComment(key, session, action, text) {
  return `<!-- ${MARKER} key=${key} session=${session} action=${action} -->\n${text}`;
}

const status = (it, h) =>
  it.checked ? (it.cancelled ? "cancelled" : "done") : h ? `taken ${short(h.session)} ${h.at.slice(0, 10)}` : "todo";

const itemLine = (it, h, width) => `${(it.code ?? "-").padEnd(4)} ${status(it, h).padEnd(9)} ${cut(it.core, width)}`;

const USAGE = `Usage: issue-checklist.mjs <command> --issue N [--item <code or text prefix>] [options]

Read (prints one short line per item; never read the issue body yourself):
  list [--section S] [--status open|todo|taken|mine|done|cancelled|all] [--grep W] [--limit N]
  show --item D3                        the item's full line, section, holder and claim history
  next [--section S]                    the first free item

Write:
  ids                                   code every item (\`D3\`) and letter every section heading (## D. Title)
  check                                 where the issue departs from the layout in format.md (exit 1 if anywhere)
  add --section S --text T              a new item at the end of section S (letter or heading words)
  claim [--takeover]                    take an item (takeover only after the user agrees)
  pr --number N                         link the item's PR
  release                               give the item back
  complete (--pr N | --no-pr) --note T  tick it: "- [x] \`D3\` text (#N; T)"
  cancel --note T                       strike it: "- [x] \`D3\` ~~text~~ _T_"
  note --text T                         add an italic note

Options: --repo owner/name, --session ID (default $CLAUDE_CODE_SESSION_ID), --dry-run, --full (no cut text)
Exit codes: 0 done, 1 refused or failed, 2 held by another session.`;

export async function main(argv, env = process.env, gh = null, settleMs = 3000) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      issue: { type: "string" },
      item: { type: "string" },
      repo: { type: "string" },
      session: { type: "string" },
      number: { type: "string" },
      pr: { type: "string" },
      "no-pr": { type: "boolean" },
      note: { type: "string" },
      text: { type: "string" },
      section: { type: "string" },
      status: { type: "string" },
      grep: { type: "string" },
      limit: { type: "string" },
      all: { type: "boolean" },
      full: { type: "boolean" },
      verbose: { type: "boolean" },
      takeover: { type: "boolean" },
      "dry-run": { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  const command = positionals[0];
  if (values.help || !command) {
    console.log(USAGE);
    return 0;
  }
  if (!values.issue) throw new Refusal("--issue is required");
  const repo =
    values.repo ??
    execFileSync("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], { encoding: "utf8" }).trim();
  gh ??= new GitHub(repo);
  const issue = values.issue;
  const session = values.session ?? env.CLAUDE_CODE_SESSION_ID;
  const width = values.full ? 0 : 80;
  const opts = { dryRun: values["dry-run"], settleMs, width: values.full ? 0 : 120 };
  const events = () => claimEvents(gh.claimComments(issue));
  const keysOf = (it) => [it.code, it.key];

  if (command === "list") {
    const items = parseItems(gh.body(issue));
    const evs = events();
    const want = values.all ? "all" : (values.status ?? "open");
    if (want === "mine" && !session) throw new Refusal("--status mine needs a session id");
    const section = values.section === undefined ? null : findSection(items, values.section);
    const overview = !values.section && !values.status && !values.grep && !values.all;
    if (overview) {
      const letters = sectionLetters(items);
      for (const s of new Set(items.map((it) => it.section))) {
        const of = items.filter((it) => it.section === s);
        const name = of[0].name || "(no heading)";
        const count = (f) => of.filter(f).length;
        const taken = count((it) => !it.checked && holderOf(evs, keysOf(it)));
        const todo = count((it) => !it.checked) - taken;
        const done = count((it) => it.checked && !it.cancelled);
        const cancelled = count((it) => it.cancelled);
        console.log(
          `## ${(letters.get(s) ?? "?").padEnd(2)} ${cut(name, 50)}: ${todo} todo, ${taken} taken, ${done} done, ${cancelled} cancelled`,
        );
      }
    }
    const grep = values.grep?.toLowerCase();
    const rows = [];
    for (const it of items) {
      if (section !== null && it.section !== section) continue;
      if (grep && !it.core.toLowerCase().includes(grep)) continue;
      const h = it.checked ? null : holderOf(evs, keysOf(it));
      const match = {
        open: !it.checked,
        todo: !it.checked && !h,
        taken: !!h,
        mine: h?.session === session,
        done: it.checked && !it.cancelled,
        cancelled: it.cancelled,
        all: true,
      }[want];
      if (match === undefined) throw new Refusal(`unknown --status ${want}`);
      if (match) rows.push(itemLine(it, h, width));
    }
    const limit = Number(values.limit ?? 40);
    rows.slice(0, limit).forEach((r) => console.log(r));
    if (rows.length > limit) console.log(`… ${rows.length - limit} more; narrow with --section, --status or --grep`);
    const uncoded = items.filter((it) => !it.code).length;
    if (uncoded) console.log(`${uncoded} items have no code; run ids`);
    return 0;
  }

  if (command === "next") {
    const items = parseItems(gh.body(issue));
    const evs = events();
    const section = values.section === undefined ? null : findSection(items, values.section);
    const it = items.find(
      (i) => !i.checked && (section === null || i.section === section) && !holderOf(evs, keysOf(i)),
    );
    console.log(it ? itemLine(it, null, 0) : "no free item");
    return 0;
  }

  if (command === "show") {
    if (!values.item) throw new Refusal("--item is required");
    const it = findItem(parseItems(gh.body(issue)), values.item);
    const evs = events().filter((e) => keysOf(it).includes(e.key));
    const h = it.checked ? null : holderOf(evs, keysOf(it));
    console.log(`${it.code ?? "-"} ${status(it, h)} in "${it.heading || "(no heading)"}"`);
    console.log(it.line.trim());
    for (const e of evs) console.log(`  ${e.at} ${e.action} ${short(e.session)}`);
    return 0;
  }

  if (command === "ids") {
    const result = await editBody(
      gh,
      issue,
      (body) => {
        const { body: next, codes, headings } = codeAll(body);
        if (!codes.length && !headings) return null;
        return { body: next, done: fullyCoded, result: { codes, headings } };
      },
      {
        ...opts,
        show: (n) => {
          if (values.verbose) for (const c of n.result.codes) console.log(c);
        },
      },
    );
    if (!result) console.log("every item and section is coded");
    else {
      const items = result.codes.length ? `${result.codes.length} items: ${summarizeCodes(result.codes)}` : "no items";
      console.log(`${opts.dryRun ? "would code" : "coded"} ${items}; lettered ${result.headings} headings`);
    }
    return 0;
  }

  if (command === "check") {
    const problems = formatProblems(gh.body(issue));
    const limit = Number(values.limit ?? 40);
    problems.slice(0, limit).forEach((p) => console.log(p));
    if (problems.length > limit) console.log(`… ${problems.length - limit} more`);
    if (!problems.length) console.log("ok");
    return problems.length ? 1 : 0;
  }

  if (command === "add") {
    if (!values.section) throw new Refusal("add needs --section");
    let added = null;
    await editBody(
      gh,
      issue,
      (body) => {
        const section = findSection(parseItems(body), values.section);
        added = addItem(body, section, values.text);
        return { body: added.body, done: (b) => lineSet(b).has(added.line), result: added.code };
      },
      { ...opts, show: () => console.log(`+ ${cut(added.line, opts.width)}`) },
    );
    console.log(`${opts.dryRun ? "would add" : "added"} ${added.code}`);
    return 0;
  }

  if (!session) throw new Refusal("no session id: set $CLAUDE_CODE_SESSION_ID or pass --session");
  if (!values.item) throw new Refusal("--item is required");
  const item = findItem(parseItems(gh.body(issue)), values.item);

  let code = item.code;
  if (!code) {
    const line = await editLine(gh, issue, { key: item.key }, coded, opts);
    code = parse(line).code;
  }
  const ref = item.code || !opts.dryRun ? { code } : { key: item.key };
  const keys = [code, item.key];
  const edit = (f) => editLine(gh, issue, ref, (it, items) => f(coded(it, items)), opts);
  const heldByOther = (h) => h && h.session !== session;
  const refuseHeld = (h) => {
    throw new Refusal(`${code} is taken by session ${short(h.session)} since ${h.at}; ask the user before a takeover`, 2);
  };
  const post = (action, verb) =>
    opts.dryRun ? null : gh.comment(issue, markerComment(code, session, action, `${verb} by session \`${short(session)}\`: \`${code}\` ${item.core}`));
  const say = (msg) => console.log(opts.dryRun ? `(dry run) ${msg}` : msg);

  switch (command) {
    case "claim": {
      if (item.checked) throw new Refusal(`${code} is already closed`);
      let h = holderOf(events(), keys);
      if (heldByOther(h) && !values.takeover) refuseHeld(h);
      if (heldByOther(h)) {
        const from = short(h.session);
        if (!opts.dryRun)
          gh.comment(
            issue,
            markerComment(code, session, "takeover", `Taken over from session \`${from}\` by \`${short(session)}\`, with the user's agreement: \`${code}\` ${item.core}`),
          );
      } else if (!h) {
        const id = post("claim", "Taken");
        if (id) {
          await sleep(Math.min(settleMs, 2000));
          h = holderOf(events(), keys);
          if (heldByOther(h)) {
            gh.deleteComment(id);
            refuseHeld(h);
          }
        }
      }
      const branch = gitBranch();
      await edit((l) => markTaken(l, { session: short(session), date: today(), branch }));
      say(`claimed ${code}`);
      return 0;
    }
    case "pr": {
      const pr = Number(values.number);
      if (!pr) throw new Refusal("pr needs --number N");
      const h = holderOf(events(), keys);
      if (h?.session !== session) throw new Refusal(`only the session holding ${code} links its PR; claim it first`);
      await edit((l) => setPr(l, pr));
      say(`linked #${pr} to ${code}`);
      return 0;
    }
    case "release": {
      const h = holderOf(events(), keys);
      if (h?.session !== session) throw new Refusal(`this session does not hold ${code}`);
      post("release", "Released");
      await edit(release);
      say(`released ${code}`);
      return 0;
    }
    case "complete":
    case "cancel": {
      if (item.checked) throw new Refusal(`${code} is already closed`);
      const pr = values["no-pr"] ? null : values.pr ? Number(values.pr) : undefined;
      const transform =
        command === "complete" ? (l) => complete(l, { pr, note: values.note }) : (l) => cancel(l, { note: values.note });
      transform(item.line);
      const h = holderOf(events(), keys);
      if (heldByOther(h)) refuseHeld(h);
      post(command, command === "complete" ? "Completed" : "Cancelled");
      await edit(transform);
      say(command === "complete" ? `completed ${code}${pr ? ` (#${pr})` : ""}` : `cancelled ${code}`);
      return 0;
    }
    case "note": {
      const h = holderOf(events(), keys);
      if (heldByOther(h)) refuseHeld(h);
      await edit((l) => addNote(l, values.text));
      say(`noted ${code}`);
      return 0;
    }
    default:
      throw new Refusal(`unknown command "${command}"\n\n${USAGE}`);
  }
}

const today = () => new Date().toISOString().slice(0, 10);

function gitBranch() {
  try {
    const out = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.trim() || "-";
  } catch {
    return "-";
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      const plain = err instanceof Refusal || String(err.code).startsWith("ERR_PARSE_ARGS");
      console.error(plain ? err.message : err.stack);
      process.exit(err instanceof Refusal ? err.code : 1);
    },
  );
}
