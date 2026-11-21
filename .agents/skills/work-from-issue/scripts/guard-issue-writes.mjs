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

const PREFIX = new Set(["env", "command", "exec", "time", "sudo", "nohup", "xargs"]);
const BODY_FIELD = /^body(=|$)/;
const ISSUE = /(^|\/)repos\/[^/]+\/[^/]+\/issues\/\d+\/?$/;
const COMMENT = /(^|\/)repos\/[^/]+\/[^/]+\/issues\/comments\/\d+\/?$/;
const MUTATION = /\b(updateIssue|updateIssueComment|deleteIssueComment)\b/;

function ghApiWrite(args) {
  let method = null;
  let path = null;
  let sendsBody = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const value = () => args[++i] ?? "";
    if (a === "-X" || a === "--method") method = value().toUpperCase();
    else if (a.startsWith("--method=")) method = a.slice(9).toUpperCase();
    else if (/^-X./.test(a)) method = a.slice(2).toUpperCase();
    else if (["-f", "-F", "--field", "--raw-field"].includes(a)) sendsBody ||= BODY_FIELD.test(value());
    else if (/^--(raw-)?field=/.test(a)) sendsBody ||= BODY_FIELD.test(a.slice(a.indexOf("=") + 1));
    else if (a === "--input" || a.startsWith("--input=")) {
      if (a === "--input") value();
      sendsBody = true;
    } else if (!a.startsWith("-") && path === null) path = a;
  }
  if (path === "graphql") return args.some((a) => MUTATION.test(a)) ? "a GraphQL issue mutation" : null;
  if (!path || method === "GET") return null;
  if (ISSUE.test(path) && sendsBody) return `a new body for ${path}`;
  if (COMMENT.test(path) && (method === "PATCH" || method === "DELETE" || sendsBody))
    return `${method ?? "a write"} on comment ${path}`;
  return null;
}

// Why the command is refused, or null when it may run.
export function refusal(command) {
  for (const words of commands(command)) {
    let at = 0;
    while (at < words.length && (PREFIX.has(words[at]) || /^\w+=/.test(words[at]))) at++;
    if (words[at] !== "gh" && !words[at]?.endsWith("/gh")) continue;
    const [group, sub, ...rest] = words.slice(at + 1);
    if (group === "issue" && sub === "edit" && rest.some((w) => /^(-b|--body|-F|--body-file)(=|$)/.test(w)))
      return "gh issue edit with a new body";
    if (group === "issue" && sub === "comment" && rest.some((w) => /^--(edit|delete)-last$/.test(w)))
      return "gh issue comment editing or deleting a comment";
    if (group === "api") {
      const why = ghApiWrite([sub, ...rest].filter((w) => w !== undefined));
      if (why) return `gh api ${why}`;
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
