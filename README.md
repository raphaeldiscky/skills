# Agent Rules and Skills

Reusable engineering rules and agent skills for Codex and Claude Code.

## Rules

Rules describe working principles and conventions that apply throughout a task.
Choose the topics you want to adopt:

| Rule | Covers |
| --- | --- |
| [Engineering principles](.agents/rules/engineering-principles.md) | Understand the problem, research proven approaches, keep changes simple and focused, and verify outcomes. |
| [GitHub workflow](.agents/rules/github-workflow.md) | Commit identity and cadence, PR creation and assignment, and REST-based PR edits. |
| [Stacked PRs](.agents/rules/stacked-prs.md) | Structure and manage dependent PRs with gh-stack. |
| [Git worktrees](.agents/rules/git-worktrees.md) | Copy ignored environment files before development in a worktree. |
| [Local services](.agents/rules/local-services.md) | Reuse existing services and clean up services started during a task. |

These files are a reusable library. Keeping them in `.agents/rules/` does not
install them into an agent or make every agent load them automatically.

### Codex

Copy the contents of selected rule files into your project's `AGENTS.md`, or into
`~/.codex/AGENTS.md` to apply them across projects. Append the selected rules to
existing instructions rather than replacing the whole file.

See the [official AGENTS.md documentation](https://developers.openai.com/codex/guides/agents-md).

### Claude Code

Copy selected rule files into `.claude/rules/` for one project, or into
`~/.claude/rules/` to apply them across projects.

Alternatively, if you copy this library's `.agents/rules/` into your project,
import selected rules from your root `CLAUDE.md`, for example:

```markdown
@.agents/rules/engineering-principles.md
@.agents/rules/git-worktrees.md
```

See the [official Claude Code instructions and rules documentation](https://code.claude.com/docs/en/memory).

### Prerequisites

- GitHub workflow rules assume Git and the authenticated `gh` CLI are available.
- Stacked PR rules use the `github/gh-stack` extension; setup is included in that rule.
- Worktree rules require `copy-worktree-env` on your `PATH`. The helper is not
  included in this repository.

## Skills

Skills provide reusable workflows for particular tasks. `.agents/skills/` is
reserved for future skills; no skills are included yet.

Each skill will live in `.agents/skills/<skill-name>/SKILL.md`, with supporting
resources only when needed. See the [official skill documentation](https://developers.openai.com/codex/skills).
