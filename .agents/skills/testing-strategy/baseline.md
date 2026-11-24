# Baseline: what every project has

## When to use

Always. Every other strategy builds on this one.

- **Typical use cases:** a new endpoint or handler, a repository method, a bug fix, and a refactor that must keep
  behavior.
- **Skip when:** never. Throwaway spikes and generated code can go lighter, but say so.

## Test through the public surface

- Assert outcomes: the returned value, the stored row, the message in the outbox. Don't assert which internal
  calls happened. A test that checks calls breaks on every refactor and passes on wrong results.
- Prefer, in order: the real implementation, then a **fake** (a working simplified one, such as an in-memory
  store or a local SMTP server), then a stub. Use a mock last. Mocks drift from the real thing.
- A fake that other tests rely on must pass the same contract suite as the real implementations
  ([case-catalog.md](case-catalog.md)). Otherwise every test built on it can be wrong together.

## Real infrastructure

- Code that reads or writes a database, queue or cache is tested on the same engine and major version, started in
  a container for the test run, with the real migrations. An in-memory substitute (SQLite for Postgres, a map for
  Redis) hides locking, constraints and isolation.
- Mark these tests (a build tag, a marker, a file suffix) so the fast run stays fast, and run both in CI.
- Concurrency tests need committed data. Give each test a fresh database or truncate between tests. Don't wrap a
  test in a transaction that rolls back.
- Live calls to a vendor's sandbox are marked, run on a schedule, and never block a PR.

## Error and refusal paths

Most catastrophic failures in a study of production distributed systems came from mishandled non-fatal
errors, and most of those reproduced with a unit test ([sources.md](sources.md)). For each error a function can
return and each refusal a guard can make, one test shows what the caller observes. Examples:

- nothing written;
- the right status;
- a retry is still safe.

Test these patterns first: empty handlers, catch-all handlers, log-and-continue, and "TODO" in a handler.

## Deterministic and hermetic

- Inject the clock, randomness (seeded) and id generation.
- Wait on a condition with a deadline, never a bare sleep.
- A flaky test is fixed or quarantined with an issue, never retried until green. Flakiness grows with test size.

## Golden files

**Use when** the code renders an artifact that a reviewer should see whole: email templates, generated docs, a
schema snapshot, CLI output. **Skip when** the output fits in an inline assertion.

- Keep the expected output in `testdata/golden/…`. The test compares against it, and one `-update` flag (or an
  environment variable) rewrites it. Go test flags are per package, so define the flag in each package that uses it.
- Scope an update with `-run`. Read the diff, run again without the flag, and commit both files.
- Replace timestamps and ids with fixed values before writing.
- A generated doc that is committed carries a content hash, so CI can tell a stale doc from a hand-edited one
  ([case-catalog.md](case-catalog.md#the-locked-doc)).

```go
var update = flag.Bool("update", false, "rewrite golden files")

func golden(t *testing.T, name string, got []byte) {
	t.Helper()
	path := filepath.Join("testdata", "golden", name)
	if *update {
		if err := os.WriteFile(path, got, 0o644); err != nil {
			t.Fatal(err)
		}
		return
	}
	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("%v (run with -update to create it)", err)
	}
	if !bytes.Equal(got, want) {
		t.Errorf("%s differs from the golden file; run with -update and read the diff", name)
	}
}
```

## The conformance gate

Once a project adopts the strategies in this skill, a check in CI fails any service that lacks a required piece:

- a catalog test that validates the catalog and checks the generated doc;
- a model test for every state machine;
- a replay test beside every spec, and the task that regenerates the spec's traces.

Write the check over files (a script or an AST query) and give it fixtures that should pass and fixtures that
should fail, so the gate is tested too. Back the code-level rules with lint rules:

- a status `UPDATE` without a `status = ANY(…)` guard;
- a test-only library imported by production code.
