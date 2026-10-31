---
name: adr
description: Create, update, and explain architecture decision records (ADRs) when users request decision documentation, ask why an architectural choice was made, or discuss a significant decision worth recording.
---

# Architecture Decision Records

Record architectural choices, their context, alternatives, and consequences so future contributors understand why the project works this way.

## When to Use

- Create or update an ADR when the user requests decision documentation.
- Read existing ADRs when the user asks why an architectural choice was made.
- Suggest recording significant choices about architecture, dependencies, data, contracts, infrastructure, or security. Discussion alone does not authorize writing an ADR.
- Skip routine implementation, naming, and formatting decisions.

## Follow Project Conventions

Find existing ADRs, templates, indexes, and project instructions before choosing a location or format. Follow their numbering, status, and history conventions.

When none exist, use `docs/adr/`, four-digit filenames such as `0001-decision-title.md`, the template below, and a `README.md` index. Create the directory, index, and reusable `template.md` with the first authorized ADR.

Preserve existing identifiers, filenames, and links. Do not renumber records or reuse numbers. For numeric schemes, increment the highest existing number while respecting project reservations.

## Capture or Update a Decision

1. Identify the decision, problem, constraints, and actual participants. Separate an agreed decision from a proposal still under discussion.
2. Record alternatives actually considered, their tradeoffs, and the rationale. Label suggested alternatives that have not been evaluated; do not invent past deliberations.
3. Verify factual claims against project files or other evidence. Distinguish historical context from current behavior. State unknown dates, participants, and rationale rather than guessing.
4. Draft a concise record. Write when the user's request or approval authorizes it; do not ask again for the same authorization. If only discussing a possible ADR or presenting a plan, present the draft without creating files.
5. Update the index and directly affected existing documentation using project conventions. Link to detailed specifications or procedures rather than duplicating them.

For a past decision, mark the record as retrospective and distinguish its recording date from the original decision date. Use history as evidence when available; leave the original date unknown when it cannot be established.

## Default Template

Use this lightweight format only when the project has no existing template. Include as many alternatives as were actually considered.

```markdown
# ADR-NNNN: Decision title

**Date**: YYYY-MM-DD
**Status**: proposed | accepted | deprecated | superseded by ADR-NNNN
**Deciders**: Actual participants, or unknown

## Context

Problem, constraints, and relevant evidence.

## Decision

Chosen approach and rationale, or the proposal awaiting a decision.

## Alternatives Considered

### Alternative name

- Benefits:
- Drawbacks:
- Reason not chosen:

## Consequences

- Benefits:
- Costs and limitations:
- Risks and mitigations:
```

Default index:

```markdown
# Architecture Decision Records

| ADR | Title | Status | Date |
| --- | --- | --- | --- |
```

Add relative links to actual records when writing index entries.

## Read Existing Decisions

Search the project's ADR location and index for the relevant decision. Summarize its context, decision, rationale, and current status with links to the records. Follow supersession links when present.

If no relevant record exists, say so. Any explanation inferred from code or history must be labeled as an inference; do not create a retrospective ADR without authorization.

## Maintain Decision History

Follow existing lifecycle conventions. The default is:

```text
proposed → accepted → deprecated or superseded
```

- Mark a decision accepted only when agreement or project evidence supports it.
- Correct factual errors with a dated history note while preserving the original decision's context.
- When a decision is replaced, create a new record and link both records; mark the old one superseded.
- Mark a decision deprecated when it no longer applies and has no replacement.
