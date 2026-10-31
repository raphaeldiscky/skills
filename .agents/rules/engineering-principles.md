# Engineering Principles

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Research Established Approaches

**Research before reinventing the wheel. Show what others have learned.**

When our task has established solutions, research relevant company practices, scientific findings, industry standards, and technical articles before proposing an implementation.

- Present **2–4 relevant approaches** when meaningful alternatives exist. Use concrete examples: “Company X documents this approach…” or “This research proposes…”
- For each approach, briefly explain **how it works, its tradeoffs, and how it fits our task**, with a direct source link.
- Prefer primary sources: company engineering publications, official standards and documentation, and original research papers. Use credible technical articles for additional context.
- Verify what sources actually support. Distinguish a company’s documented practice, a formal standard, research findings, and your own inference.
- Check current guidance alongside established evidence. Recommend the approach that fits our requirements, scale, and constraints; explain why.
- Keep research proportional to the task. Do not force multiple options for trivial changes or copy a large company’s complexity without justification.

**We do not have to reinvent the wheel. Prefer a proven solution when it fits, and explain any reason to depart from it.**

## 3. Simple, Complete, Maintainable

**Choose the simplest design that fully meets the requirements and remains easy to understand, test, operate, and change.**

- Optimize for clarity and manageable complexity. Fewer lines or a smaller diff do not justify sacrificing correctness, security, reliability, or maintainability.
- Implement required behavior completely. Do not substitute stubs, hardcoded shortcuts, silent failures, or disabled checks for a working solution.
- Use established design patterns, **proven, actively maintained libraries**, and sound repository conventions where they fit the problem. Verify maintenance status before introducing a dependency. Explain significant design choices and their tradeoffs. Prefer straightforward code when an additional pattern would add complexity without a clear benefit.
- Use cohesive modules, clear responsibilities, and appropriate interfaces to reduce coupling. Abstractions are justified when they isolate dependencies, protect invariants, improve testability, or encapsulate likely changes—even with a single caller.
- Handle realistic failure modes and validate inputs at relevant boundaries. Base decisions to omit defensive handling on enforced contracts or verified invariants, not assumptions that failures are impossible.
- Design for stated workloads and agreed growth requirements. Identify relevant scaling limits without introducing speculative frameworks, extension points, or distributed infrastructure.
- Keep scope focused. Simplify unnecessary complexity while preserving the structure and safeguards needed for a maintainable solution.

Ask yourself: “Is this solution complete and easy for another engineer to maintain, or merely quick to write?”

## 4. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't make unrelated changes to adjacent code, comments, or formatting.
- Refactor nearby code when necessary to implement the requested change correctly and maintainably. Keep it focused and explain its purpose.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 5. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Verify required behavior, realistic failure cases, and relevant nonfunctional requirements using checks appropriate to the change. Report anything that remains unverified.

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
