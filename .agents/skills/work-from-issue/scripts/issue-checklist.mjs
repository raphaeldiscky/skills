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
const TAKEN = / _\(taken: ([^)]*)\)_$/;
const COMMENT = /<!-- issue-claim v1 key=(\w+) session=(\S+) action=(\w+) -->/;
const KEY_CHARS = 60;

export class Refusal extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

const normalize = (s) => s.replace(/\s+/g, " ").trim();

// The item's own words: no status box, no strike, no taken marker, and nothing from the first note on.
export function coreText(text) {
  let t = text.replace(TAKEN, "");
  const note = t.indexOf(" _");
  if (note >= 0) t = t.slice(0, note);
  return normalize(t.replace(/~~/g, ""));
}

export const itemKey = (text) =>
  createHash("sha1").update(coreText(text).slice(0, KEY_CHARS)).digest("hex").slice(0, 12);

export function parseItems(body) {
  const items = [];
  body.split("\n").forEach((raw, index) => {
    const line = raw.replace(/\r$/, "");
    const m = ITEM.exec(line);
    if (!m) return;
    const text = m[3];
    items.push({
      index,
      line,
      lead: m[1],
      checked: m[2] !== " ",
      cancelled: text.startsWith("~~"),
      text,
      core: coreText(text),
      key: itemKey(text),
      taken: parseTaken(text),
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

export function findItem(items, prefix) {
  const want = normalize(prefix);
  const hits = items.filter((it) => it.core.startsWith(want));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) throw new Refusal(`no checklist item starts with "${want}"`);
  throw new Refusal(`"${want}" matches ${hits.length} items:\n${hits.map((h) => "  " + h.core).join("\n")}`);
}

export function findByKey(items, key) {
  const hits = items.filter((it) => it.key === key);
  if (hits.length > 1) throw new Refusal(`${hits.length} items share key ${key}; make the item text unique`);
  return hits[0] ?? null;
}

const parse = (line) => {
  const it = parseItems(line)[0];
  if (!it) throw new Refusal(`not a checklist line: ${line}`);
  return it;
};

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
  const text = withoutMarker(it).replace(/~~/g, "");
  return `${it.lead}[x] ~~${text}~~ _${note}_`;
}

export function addNote(line, text) {
  if (!text) throw new Refusal("note needs --text");
  const it = parse(line);
  const marker = it.taken ? takenMarker(it.taken) : "";
  return `${it.lead}[${it.checked ? "x" : " "}] ${withoutMarker(it)} _${text}_${marker}`;
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
export function holderOf(events, key) {
  let holder = null;
  for (const e of events) {
    if (e.key !== key) continue;
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

// Last write wins on an issue body, so each writer re-reads and reapplies its own change until it sticks.
async function editLine(gh, issue, key, transform, { dryRun, settleMs }) {
  let expected = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const body = gh.body(issue);
    const lines = body.split("\n").map((l) => l.replace(/\r$/, ""));
    if (expected && lines.includes(expected)) return expected;
    const it = findByKey(parseItems(body), key);
    if (!it) throw new Refusal(`the item (key ${key}) is no longer in the issue`);
    const next = transform(it.line);
    if (dryRun) {
      console.log(`- ${it.line}\n+ ${next}`);
      return next;
    }
    if (next === it.line) return next;
    expected = next;
    gh.setBody(issue, replaceLine(body, it.index, next));
    await sleep(settleMs);
  }
  const lines = gh.body(issue).split("\n").map((l) => l.replace(/\r$/, ""));
  if (lines.includes(expected)) return expected;
  throw new Refusal("the issue body kept changing; the edit did not stick after 5 tries");
}

function markerComment(key, session, action, text) {
  return `<!-- ${MARKER} key=${key} session=${session} action=${action} -->\n${text}`;
}

const USAGE = `Usage: issue-checklist.mjs <command> --issue N [--item "<text prefix>"] [options]

Commands:
  list [--all]                          open items and who holds them
  claim [--takeover]                    take an item (takeover only after the user agrees)
  pr --number N                         link the item's PR
  release                               give the item back
  complete (--pr N | --no-pr) --note T  tick it: "- [x] text (#N; T)"
  cancel --note T                       strike it: "- [x] ~~text~~ _T_"
  note --text T                         add an italic note

Options: --repo owner/name, --session ID (default $CLAUDE_CODE_SESSION_ID), --dry-run
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
      all: { type: "boolean" },
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

  if (command === "list") {
    const holders = claimEvents(gh.claimComments(issue));
    for (const it of parseItems(gh.body(issue))) {
      if (it.checked && !values.all) continue;
      const h = holderOf(holders, it.key);
      const status = it.checked
        ? it.cancelled
          ? "cancelled"
          : "done"
        : h
          ? `taken ${short(h.session)} since ${h.at}`
          : "todo";
      console.log(`${status.padEnd(9)} ${it.core}`);
    }
    return 0;
  }

  const session = values.session ?? env.CLAUDE_CODE_SESSION_ID;
  if (!session) throw new Refusal("no session id: set $CLAUDE_CODE_SESSION_ID or pass --session");
  if (!values.item) throw new Refusal("--item is required");
  const item = findItem(parseItems(gh.body(issue)), values.item);
  const key = item.key;
  const opts = { dryRun: values["dry-run"], settleMs };
  const events = () => claimEvents(gh.claimComments(issue));
  const heldByOther = (h) => h && h.session !== session;
  const refuseHeld = (h) => {
    throw new Refusal(`taken by session ${short(h.session)} since ${h.at}; ask the user before a takeover`, 2);
  };
  const post = (action, text) => (opts.dryRun ? null : gh.comment(issue, markerComment(key, session, action, text)));

  switch (command) {
    case "claim": {
      if (item.checked) throw new Refusal("the item is already closed");
      let h = holderOf(events(), key);
      if (heldByOther(h) && !values.takeover) refuseHeld(h);
      if (heldByOther(h)) post("takeover", `Taken over from session \`${short(h.session)}\` by \`${short(session)}\`, with the user's agreement: ${item.core}`);
      else if (!h) {
        const id = post("claim", `Taken by session \`${short(session)}\`: ${item.core}`);
        if (id) {
          await sleep(Math.min(settleMs, 2000));
          h = holderOf(events(), key);
          if (heldByOther(h)) {
            gh.deleteComment(id);
            refuseHeld(h);
          }
        }
      }
      const branch = gitBranch();
      await editLine(gh, issue, key, (l) => markTaken(l, { session: short(session), date: today(), branch }), opts);
      console.log(`claimed: ${item.core}`);
      return 0;
    }
    case "pr": {
      const pr = Number(values.number);
      if (!pr) throw new Refusal("pr needs --number N");
      const h = holderOf(events(), key);
      if (h?.session !== session) throw new Refusal("only the session holding the item links its PR; claim it first");
      await editLine(gh, issue, key, (l) => setPr(l, pr), opts);
      console.log(`linked #${pr}: ${item.core}`);
      return 0;
    }
    case "release": {
      const h = holderOf(events(), key);
      if (h?.session !== session) throw new Refusal("this session does not hold the item");
      post("release", `Released by session \`${short(session)}\`: ${item.core}`);
      await editLine(gh, issue, key, release, opts);
      console.log(`released: ${item.core}`);
      return 0;
    }
    case "complete":
    case "cancel": {
      const pr = values["no-pr"] ? null : values.pr ? Number(values.pr) : undefined;
      const transform =
        command === "complete" ? (l) => complete(l, { pr, note: values.note }) : (l) => cancel(l, { note: values.note });
      transform(item.line);
      const h = holderOf(events(), key);
      if (heldByOther(h)) refuseHeld(h);
      post(command, `${command === "complete" ? "Completed" : "Cancelled"} by session \`${short(session)}\`: ${item.core}`);
      await editLine(gh, issue, key, transform, opts);
      console.log(`${command === "complete" ? "completed" : "cancelled"}: ${item.core}`);
      return 0;
    }
    case "note": {
      const h = holderOf(events(), key);
      if (heldByOther(h)) refuseHeld(h);
      await editLine(gh, issue, key, (l) => addNote(l, values.text), opts);
      console.log(`noted: ${item.core}`);
      return 0;
    }
    default:
      throw new Refusal(`unknown command "${command}"\n\n${USAGE}`);
  }
}

const today = () => new Date().toISOString().slice(0, 10);

function gitBranch() {
  try {
    return execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim() || "-";
  } catch {
    return "-";
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err instanceof Refusal ? err.message : err.stack);
      process.exit(err instanceof Refusal ? err.code : 1);
    },
  );
}
