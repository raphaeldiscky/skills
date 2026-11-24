# The case catalog

A case catalog is one list of named rules. It holds every implementation of a contract to those rules, and
every flow through a service. A rendered doc shows reviewers which rule holds where.

## Contents

- [When to use](#when-to-use)
- [The model](#the-model)
- [Validation and the production gate](#validation-and-the-production-gate)
- [Harnesses and the run](#harnesses-and-the-run)
- [The locked doc](#the-locked-doc)
- [Adding a case](#adding-a-case)

## When to use

- **Trigger:** one contract has two or more implementations (count the fake), or a service's flows need a
  tracked list of what is built and what is planned before production.
- **Typical use cases:**
  - payment gateways behind one port;
  - email, SMS or push providers plus an in-memory fake;
  - several LLM vendors behind one interface;
  - storage backends (object store, local disk);
  - the end-to-end flows a service must support before launch.
- **Skip when:** there is one implementation and no fake, so write ordinary tests. A rule that only one
  implementation has belongs in that implementation's own tests.

A parametrized suite over the implementations is the core. The catalog adds four things a parametrized suite
lacks:

- a recorded reason for every case that doesn't apply;
- what is still planned;
- a gate that keeps a subject with planned cases out of production;
- a doc that reviewers can read.

## The model

- **Case:** a stable id, a title, the capabilities it requires, n/a reasons per subject, a planned marker, and a
  check that drives a harness.
- **Ids:** `conformance.<area>.<rule>` or `flow.<area>.<rule>`, lowercase, with a kebab-case rule. An id never
  changes, so docs, PRs and issues can cite it.
- **Kinds:**
  - A **conformance** case holds every implementation to one rule through its harness.
  - A **flow** case is a path through the service on the real database.
- **Subjects:** each implementation, the fake included, with its capabilities and whether it is live in
  production.
- **Verdicts** are computed, never written by hand:
  - ✅ **holds**: the check runs.
  - ➖ **n/a**: needs a real reason, either a capability the subject lacks or a limitation named on the case.
  - 🟡 **planned**: the work is tracked somewhere.

  "Not yet" means planned, never n/a. There is no "deviates" verdict: an applicable case that fails is a red
  build.

```go
type Case[H any] struct {
	ID       string            // conformance.<area>.<rule> or flow.<area>.<rule>; never changes
	Title    string
	Requires []string          // capabilities; a subject without one is n/a
	NA       map[string]string // subject -> why the rule cannot apply to it
	Planned  string            // where the work is tracked; empty once built
	Check    func(t *testing.T, h H)
}

func VerdictOf[H any](c Case[H], s Subject) (Verdict, string) {
	if c.Planned != "" {
		return Planned, c.Planned
	}
	for _, need := range c.Requires {
		if !s.Capabilities[need] {
			return NA, "lacks " + need
		}
	}
	if why, ok := c.NA[s.Name]; ok {
		return NA, why
	}
	return Holds, ""
}
```

## Validation and the production gate

A test validates the catalog, so a malformed catalog fails CI. The test checks that:

- ids are unique and match the grammar;
- a conformance case is never planned and always has a check. A rule every implementation shares is built now
  or left out;
- every n/a names a known subject and gives a reason. Reasons that say "not yet", "todo" or "later" are refused,
  because those cases are planned.

The **production gate** lists every planned case for each subject that is live in production, and its test
requires that list to be empty. So a new provider can't go live while one of its rules is unbuilt.

```go
var notReason = regexp.MustCompile(`(?i)\b(not yet|todo|later|wip)\b`)

for name, why := range c.NA {
	if !known[name] {
		errs = append(errs, fmt.Errorf("%s: n/a for unknown subject %s", c.ID, name))
	}
	if strings.TrimSpace(why) == "" || notReason.MatchString(why) {
		errs = append(errs, fmt.Errorf("%s: n/a for %s needs a reason it cannot apply; \"not yet\" is planned", c.ID, name))
	}
}
```

## Harnesses and the run

- A **harness** is the small adapter that the cases drive. It builds one implementation against a recorded
  or local vendor (an `httptest` server, a local SMTP server, an SDK stubber), sends, and reads back what the
  vendor received. Keep one harness file per implementation.
- **The run:** for each subject in parallel, run every conformance case whose verdict is "holds", as a subtest
  named `<subject>/<case id>`.
- **The fake is a subject.** It proves the catalog itself: a case the fake can't pass is a broken case. Running
  it also keeps the fake honest for every other test that uses it.
- **Flow cases** run on the real database in a container. Every built flow needs a check, and a built flow
  without one fails.

```go
func TestConformance(t *testing.T) {
	for _, s := range subjects() {
		t.Run(s.Subject.Name, func(t *testing.T) {
			t.Parallel()
			catalog.Run(t, conformanceCases(), s.Subject, s.harness(t))
		})
	}
}
```

## The locked doc

The catalog renders to `docs/cases.md`. It holds:

- a summary of holds, n/a and planned for each subject;
- a conformance matrix and a flow matrix (case × subject, ✅ ➖ 🟡);
- every n/a reason.

The doc is generated and never edited by hand.

- The first line is a `<!-- GENERATED … sha256: <hex> -->` comment. The hash covers the content without that
  line.
- A test compares the committed doc with a freshly rendered one. The failure says which fix applies:
  - **missing**: regenerate;
  - **stale**: the catalog changed (the recorded hash matches the file), so regenerate;
  - **hand-edited**: the recorded hash doesn't match the file, so change the catalog, then regenerate.
- There is one way to regenerate, for example `go test ./internal/cases -run TestDoc -update`. Read the diff and
  commit both.

```go
func Compare(committed []byte, body string) error {
	if len(committed) == 0 {
		return ErrMissing
	}
	if string(committed) == Stamp(body) {
		return nil
	}
	first, rest, _ := strings.Cut(string(committed), "\n")
	recorded, ok := strings.CutPrefix(first, header)
	sum := sha256.Sum256([]byte(rest))
	if !ok || strings.TrimSuffix(recorded, " -->") != hex.EncodeToString(sum[:]) {
		return ErrHandEdited
	}
	return ErrStale
}
```

## Adding a case

1. Add the case with its area, rule, required capabilities and any n/a reasons.
2. Implement the check in each harness, or give the n/a reason.
3. Regenerate the doc, read its diff, and commit both.

Adding a subject (a new provider): write its harness, run the catalog, and read which cases fail. Fix each
failure, or give it a real n/a reason. A conformance case can't be planned, so "later" isn't an option. Mark the
subject live in production only when the production gate passes for it.
