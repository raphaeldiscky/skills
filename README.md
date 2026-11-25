# Agent Rules and Skills

My collection of rules and skills for AI coding agents.

Choose the rules and workflows that fit your project, then load them through your
agent's supported instruction or skill mechanism.

## Rules

Rules describe working principles and conventions that apply throughout a task.
Choose the topics you want to adopt:

| Rule | Covers |
| --- | --- |
| [Engineering principles](.agents/rules/engineering-principles.md) | Research, complete and maintainable design, appropriate patterns, dependency usage, and verification. |
| [GitHub workflow](.agents/rules/github-workflow.md) | Commit identity and cadence, branch and main-sync rules, PR creation and assignment, and PR edits with `gh pr edit`. |
| [Stacked PRs](.agents/rules/stacked-prs.md) | Structure and manage dependent PRs with gh-stack. |
| [Git worktrees](.agents/rules/git-worktrees.md) | Create worktrees only when approved (branches need no approval), and copy ignored environment files into a worktree. |
| [Local services](.agents/rules/local-services.md) | Reuse existing services, pick free ports, and clean up services started during a task. |
| [Waiting](.agents/rules/waiting.md) | Estimate how long a wait should take, cap every polling loop, and stop and report when the estimate passes. |

These files are a reusable library. Keeping them in `.agents/rules/` does not
install them into an agent or make every agent load them automatically.

## Skills

Skills provide reusable workflows for particular tasks.

| Skill | Covers | Use when |
| --- | --- | --- |
| [Architecture decision records](.agents/skills/adr/SKILL.md) | Create, update, and explain ADRs using project conventions. | You ask to record a decision, ask why an architectural choice was made, or make a significant architecture, dependency, data, contract, infrastructure, or security choice worth recording. |
| [Testing strategy](.agents/skills/testing-strategy/SKILL.md) | Choose tests by the shape of the code, then build them. The baseline every project has (real dependencies, error paths, golden files, a CI gate) and, as the code calls for them: a case catalog holding every implementation and the fake to named rules, with a locked coverage doc and a production gate; state-machine model tests against the real store; property-based tests and fuzzing; provider and consumer-driven contract tests; formal specs with trace replay; deterministic simulation; and mutation testing to judge a suite. Each strategy says when to use it and when to skip it. It is language-agnostic, with verified Go examples, a tool table for five languages, and sources. | You decide which tests a change needs, write them, or judge whether a suite is strong enough: several implementations of one contract, a stored status, a pure rule, untrusted input, rendered output, an API others consume, or a protocol across services. |
| [Untangle codebase](.agents/skills/untangle-codebase/SKILL.md) | Whole-codebase structural refactor that removes hidden links, needless links, surplus and special cases, and asks before changing anything outside the repo depends on. | You explicitly invoke it. It never runs on its own (`disable-model-invocation: true`). |
| [Work from issue](.agents/skills/work-from-issue/SKILL.md) | Claim an issue checklist item by its code (`D3`) under the session id, check it is not already built, ask before database or backend design, design in the Claude Design canvas and design system artifacts before frontend code, then link the PR and mark the item completed or cancelled. Includes one layout for checklist issues (lettered sections, grouped and coded items) and a `gh` helper that lists, adds and claims items in short lines, so a session never reads the whole issue and parallel sessions never take one item twice, plus an optional Claude Code hook that blocks issue edits outside the helper. | You implement, pick up, or update an item from an issue checklist, especially with several agent sessions running. | You implement, pick up, or update an item from an issue checklist, especially with several agent sessions running. |

Each skill lives in `.agents/skills/<skill-name>/SKILL.md`, with supporting
resources only when needed. Add a row to this table when you add a skill.

## Installing the skills

Install them with the [`skills` CLI](https://github.com/vercel-labs/skills). It finds every skill under
`.agents/skills/` in this repository. Install per project, so each repository pins the skills it uses:

```bash
# List the skills in this repository
npx skills add raphaeldiscky/skills --list

# From your project's root: install one skill into this project, for Claude Code
npx skills add raphaeldiscky/skills --skill work-from-issue --agent claude-code

# Update the project's skills later
npx skills update
```

- The CLI copies the skill into the agent's skills folder (`.claude/skills/<name>` for Claude Code) and records
  its source and commit in `skills-lock.json` at the project root. Commit both, so everyone working on the
  repository gets the same version, and change the skill here rather than in the copy.
- Optional, for every project on your machine: add `--global`, for example
  `npx skills add raphaeldiscky/skills --skill '*' --global`.
- Pin a release tag or a commit with `raphaeldiscky/skills@<ref>`.
- Install from `main`. The CLI can't read a branch name that contains a slash (`feat/…`) in a GitHub URL, so to try
  an unmerged skill, install it from a local clone: `npx skills add ./skills --skill <name>`.
- Other agents can read the skill folders directly; see, for example, the
  [Codex skill documentation](https://developers.openai.com/codex/skills).
- The rules aren't skills. Copy them as described in [Using the rules](#using-the-rules).

## Using the rules

Follow your agent's instructions for loading project-level or user-level rules.
Append selected rules to existing instructions rather than replacing the whole
configuration. The following are setup examples for two agents.

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

## Prerequisites

- Installing with the `skills` CLI needs Node.js (`npx`); the `work-from-issue` helper needs Node.js and the authenticated `gh` CLI.
- GitHub workflow rules assume Git and the authenticated `gh` CLI are available.
- Stacked PR rules use the `github/gh-stack` extension; setup is included in that rule.
- Worktree rules work with any way of copying ignored files; a helper such as
  `copy-worktree-env` is optional and not included in this collection.
