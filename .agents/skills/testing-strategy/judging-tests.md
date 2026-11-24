# Judging a test suite

## When to use

- **Trigger:** you need to know whether the tests would catch a change, not just whether they pass.
- **Typical use cases:**
  - reviewing a PR's new tests;
  - a critical module with high coverage and bugs that still escaped;
  - before refactoring code an agent wrote;
  - deciding where to add tests first.
- **Skip when:** the code is generated, glue, or a one-off script.

## Coverage finds gaps; it is not a target

When the number of tests is held constant, coverage correlates only weakly with how many faults a suite
detects. Use coverage to find untested code, starting with error handling and refusal branches. Don't set a
percentage as a goal: tests written to raise coverage execute code without checking it.

## Mutation testing on the diff

A mutation tool changes the code: it flips a condition, drops a statement, or changes a constant. A mutant that
no test kills shows a missing assertion.

- **Scope it to changed lines,** in review or in a PR job. A whole-repo run is slow and buries the useful mutants.
- **Cap the report:** a few mutants per file, picked from the operators that historically found real gaps.
- **Triage every survivor:** add a test, or mark it as equivalent or not worth a test. Most raw mutants are
  noise. Google's developers judged only a minority of unfiltered mutants useful.
- **Don't chase a mutation score.** A score is costly to compute and doesn't tell anyone which test to write.

## The cheapest mutation test

Break the code by hand once: remove the guard, the dedupe or the transaction. Run the tests and watch them go
red, then restore the code. If nothing goes red, the test is missing.

## Review checklist

- Each test can fail, and someone has seen it fail.
- Tests assert outcomes (rows, responses, messages), not which calls happened.
- Every error and refusal path has a test.
- Database code runs on the real engine.
- Randomized tests print their seed.
- No bare sleeps.
- Generated runs assert what they reached.
- A fake that other tests use passes the contract suite.
- No test was weakened to get green.
