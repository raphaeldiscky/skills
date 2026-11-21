# Guard hook: no issue edits outside the helper

The skill tells a session to change checklist issues only through `issue-checklist.mjs`. `guard-issue-writes.mjs`
makes that a block in Claude Code. It is a `PreToolUse` hook that refuses the shell commands that would overwrite
another session's claim or code.

| Refused                                                                         | Still allowed                                       |
| ------------------------------------------------------------------------------- | --------------------------------------------------- |
| `gh issue edit` with `--body` or `--body-file`                                  | `gh issue view`, `list`, `create`                   |
| `gh issue comment --edit-last` or `--delete-last`                               | a new comment, `gh issue edit` of labels or title   |
| `gh api` sending a `body` field or `--input` to `repos/…/issues/N`              | `gh api` reads, and writes of other fields (`state`) |
| `gh api` PATCH or DELETE on `repos/…/issues/comments/N`                         | everything on pull requests (`gh pr …`)             |
| `gh api graphql` with `updateIssue`, `updateIssueComment` or `deleteIssueComment` | the helper itself (it calls `gh` from Node)         |

A refused command exits 2. Claude Code shows the reason to the session, which points it at the helper or tells it to
ask the user. Items, `###` groups and sections are added through the helper (`add`, `add --group`, `section`); only
the issue's intro and prose need a person.

## Setup

The skill installs the script; each project turns it on. Add this to the project's `.claude/settings.json`. Change
the path if the skill was installed somewhere other than `.claude/skills/`.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/skills/work-from-issue/scripts/guard-issue-writes.mjs\""
          }
        ]
      }
    ]
  }
}
```

Check it in a session: `gh issue edit 1 --body x` must come back blocked, and a `list` from the helper must run.

## Limits

- It reads Bash commands only. It doesn't see GitHub MCP tools, the browser, or edits people make on github.com.
  The helper's re-read and retry still protects claims from those.
- It fails closed: every `gh` word on the line is checked, whatever comes before it (`timeout`, `sudo`, `bash -c`),
  so `echo gh issue edit 1 --body x` is refused too.
- It parses the command line, not what runs: a script file, `eval` or an alias that edits an issue gets through.
- It blocks writes, not reads. The "never read the issue body" rule stays guidance, so reading an ordinary issue
  still works.
