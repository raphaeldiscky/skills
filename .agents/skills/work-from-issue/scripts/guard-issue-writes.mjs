#!/usr/bin/env node
// Claude Code PreToolUse hook: refuses shell commands that rewrite an issue body or edit or delete a comment, so
// checklist issues change only through issue-checklist.mjs. Setup and limits: ../hook.md.

import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HELPER = "issue-checklist.mjs";

// One shell command split into its simple commands, each as a list of words with quotes removed.
export function commands(line) {
  const out = [];
  let words = [];
  let word = "";
  let quote = null;
  let started = false;
  const endWord = () => {
    if (started) words.push(word);
    word = "";
    started = false;
  };
  const endCommand = () => {
    endWord();
    if (words.length) out.push(words);
    words = [];
  };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === "\\" && quote === '"' && i + 1 < line.length) word += line[++i];
      else word += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      started = true;
    } else if (c === "\\" && i + 1 < line.length) {
      word += line[++i];
      started = true;
    } else if (/\s/.test(c) && c !== "\n") endWord();
    else if (";&|\n()`".includes(c) || (c === "$" && line[i + 1] === "(")) endCommand();
    else {
      word += c;
      started = true;
    }
  }
  endCommand();
  return out;
}

const SHELLS = new Set(["bash", "sh", "zsh", "dash"]);
const API_VALUE_FLAGS = new Set(["-H", "--header", "--hostname", "-q", "--jq", "-t", "--template", "--cache", "-p",
  "--preview"]);
const BODY_FIELD = /^body(=|$)/;
const ISSUE = /(^|\/)repos\/[^/]+\/[^/]+\/issues\/\d+\/?$/;
const COMMENT = /(^|\/)repos\/[^/]+\/[^/]+\/issues\/comments\/\d+\/?$/;
const MUTATION = /\b(updateIssue|updateIssueComment|deleteIssueComment)\b/i;

// A field flag, attached (-fbody=x, --field=body=x) or not, as [flag, value or null when the next word holds it].
function field(a) {
  const m = /^(-f|-F|--field|--raw-field)(=?)(.*)$/.exec(a);
  if (!m) return null;
  if (m[1].startsWith("--") && !m[2] && m[3]) return null;
  return m[3] ? m[3] : null;
}

function ghApiWrite(args) {
  let method = null;
  const paths = [];
  const values = [];
  let input = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = () => args[++i] ?? "";
    if (a === "-X" || a === "--method") method = next().toUpperCase();
    else if (a.startsWith("--method=")) method = a.slice(9).toUpperCase();
    else if (/^-X./.test(a)) method = a.slice(2).toUpperCase();
    else if (/^(-f|-F|--field|--raw-field)$/.test(a)) values.push(next());
    else if (field(a) !== null) values.push(field(a));
    else if (a === "--input" || a.startsWith("--input=")) {
      if (a === "--input") next();
      input = true;
    } else if (API_VALUE_FLAGS.has(a)) next();
    else if (!a.startsWith("-")) paths.push(a);
  }
  if (paths.some((p) => p.replace(/[/?#].*$|\/+$/g, "") === "graphql" || /\/graphql\/?$/.test(p))) {
    if (input || values.some((v) => /^\w+=@/.test(v))) return "a GraphQL query read from a file or stdin";
    return values.some((v) => MUTATION.test(v)) ? "a GraphQL issue mutation" : null;
  }
  if (method === "GET") return null;
  const sendsBody = input || values.some((v) => BODY_FIELD.test(v));
  const issue = paths.find((p) => ISSUE.test(p));
  if (issue && sendsBody) return `a new body for ${issue}`;
  const comment = paths.find((p) => COMMENT.test(p));
  if (comment && (method === "PATCH" || method === "DELETE" || sendsBody)) return `${method ?? "a write"} on comment ${comment}`;
  return null;
}

const base = (w) => w.slice(w.lastIndexOf("/") + 1);

// Why the command is refused, or null when it may run. Fails closed: every "gh" word is checked, whatever precedes it.
export function refusal(command) {
  for (const words of commands(command)) {
    for (let i = 0; i < words.length; i++) {
      if (SHELLS.has(base(words[i]))) {
        const c = words.findIndex((w, j) => j > i && /^-[A-Za-z]*c[A-Za-z]*$/.test(w));
        const why = c > 0 && words[c + 1] ? refusal(words[c + 1]) : null;
        if (why) return why;
      }
      if (base(words[i]) !== "gh") continue;
      const [group, sub, ...rest] = words.slice(i + 1);
      if (group === "issue" && sub === "edit" && rest.some((w) => /^(-b|-F)|^--body(-file)?(=|$)/.test(w)))
        return "gh issue edit with a new body";
      if (group === "issue" && sub === "comment" && rest.some((w) => /^--(edit|delete)-last$/.test(w)))
        return "gh issue comment editing or deleting a comment";
      if (group === "api") {
        const why = ghApiWrite([sub, ...rest].filter((w) => w !== undefined));
        if (why) return `gh api ${why}`;
      }
    }
  }
  return null;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }
  const why = input.tool_name === "Bash" ? refusal(input.tool_input?.command ?? "") : null;
  if (why) {
    console.error(
      `Blocked: ${why}. Checklist issues change only through the work-from-issue helper (${HELPER}): ` +
        "claim, pr, note, complete, cancel, release, add, ids. If it has no command for this, ask the user.",
    );
    process.exit(2);
  }
}
