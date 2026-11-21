// Run: node --test .agents/skills/work-from-issue/scripts/

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { commands, refusal } from "./guard-issue-writes.mjs";

test("splits a shell line into simple commands and strips quotes", () => {
  assert.deepEqual(commands(`echo "a b" | gh api x --input - && node h.mjs 'gh api'; $(gh issue view 5)`), [
    ["echo", "a b"],
    ["gh", "api", "x", "--input", "-"],
    ["node", "h.mjs", "gh api"],
    ["gh", "issue", "view", "5"],
  ]);
});

const blocked = [
  "gh issue edit 42 --body 'new text'",
  "gh issue edit 42 -F body.md",
  "gh issue edit 42 --body-file=- < body.md",
  "gh issue comment 42 --edit-last --body x",
  "gh issue comment 42 --delete-last",
  "gh api -X PATCH repos/acme/app/issues/42 -f body=@body.md",
  "gh api repos/acme/app/issues/42 --method=PATCH --input body.json",
  "gh api repos/{owner}/{repo}/issues/42 -F 'body=new'",
  "cat b.json | /usr/bin/gh api /repos/acme/app/issues/42 --input -",
  "gh api -XDELETE repos/acme/app/issues/comments/99",
  "gh api repos/acme/app/issues/comments/99 -X PATCH -f body=x",
  `gh api graphql -f query='mutation { updateIssue(input: {id: "I_1", body: "x"}) { issue { id } } }'`,
  "git status && gh issue edit 42 --body x",
  "GH_REPO=acme/app gh issue edit 42 --body x",
  "printf x | xargs gh issue edit 42 --body",
  "gh api -H 'Accept: application/json' repos/acme/app/issues/42 -X PATCH -f body=x",
  "gh api --jq .id repos/acme/app/issues/42 --input b.json",
  "gh api repos/acme/app/issues/42 -fbody=x",
  "gh api repos/acme/app/issues/42 -Fbody=@b.md",
  "gh api repos/acme/app/issues/42 --field=body=x",
  "gh api graphql -F query=@mutation.graphql",
  "gh api graphql --input query.json",
  "gh api graphql -f query='mutation { UPDATEISSUE(input: {}) { clientMutationId } }'",
  "gh issue edit 42 -b'x'",
  "timeout 60 gh issue edit 42 --body x",
  "if true; then gh issue edit 42 --body x; fi",
  "{ gh issue edit 42 --body x; }",
  "bash -c 'gh issue edit 42 --body x'",
  "bash -lc 'gh issue edit 42 --body x'",
  "nice -n 10 gh issue edit 42 --body x",
  "sudo -u me gh api repos/acme/app/issues/42 -f body=x",
  "echo gh issue edit 42 --body x",
  "gh api /graphql -f query='mutation { updateIssue(input: {}) { clientMutationId } }'",
  "gh api https://api.github.com/graphql --input q.json",
  "env -i GH_TOKEN=t gh api repos/acme/app/issues/42 -f body=x",
];

const allowed = [
  "gh issue view 42",
  "gh issue list --state open",
  "gh issue edit 42 --add-label bug --title 'New title'",
  "gh issue comment 42 --body 'A note for people'",
  "gh issue create --title t --body b",
  "gh api repos/acme/app/issues/42",
  "gh api repos/acme/app/issues/42/comments --paginate",
  "gh api -X PATCH repos/acme/app/issues/42 -f state=closed",
  "gh api repos/acme/app/issues/42/comments -f body=hello",
  "gh api graphql -f query='{ repository(owner: \"a\", name: \"b\") { issue(number: 1) { body } } }'",
  "gh pr edit 7 --body-file pr.md",
  "node .claude/skills/work-from-issue/scripts/issue-checklist.mjs note --issue 42 --item D3 --text 'gh api -X PATCH'",
  "gh api -H 'Accept: application/json' repos/acme/app/issues/42",
  "gh api graphql -f query='query { viewer { login } }'",
  "bash -c 'gh issue view 42'",
  "timeout 60 gh issue list",
];

test("refuses every way of rewriting an issue body or editing a comment", () => {
  for (const c of blocked) assert.ok(refusal(c), c);
});

test("allows reads, new comments, other fields, PRs and the helper", () => {
  for (const c of allowed) assert.equal(refusal(c), null, c);
});

test("speaks the PreToolUse protocol: exit 2 with a reason, 0 otherwise", () => {
  const script = fileURLToPath(new URL("./guard-issue-writes.mjs", import.meta.url));
  const hook = (input) => spawnSync(process.execPath, [script], { input, encoding: "utf8" });
  const deny = hook(JSON.stringify({ tool_name: "Bash", tool_input: { command: blocked[0] } }));
  assert.equal(deny.status, 2);
  assert.match(deny.stderr, /^Blocked: gh issue edit with a new body\. .*issue-checklist\.mjs/);
  assert.equal(hook(JSON.stringify({ tool_name: "Bash", tool_input: { command: allowed[0] } })).status, 0);
  assert.equal(hook(JSON.stringify({ tool_name: "Read", tool_input: { file_path: "x" } })).status, 0);
  assert.equal(hook("not json").status, 0);
});
