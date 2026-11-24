# Property-based tests and fuzzing

A property-based test (PBT) states a rule that must hold for every input. The tool generates many inputs,
looks for one that breaks the rule, and shrinks a failure to the smallest input that still fails. Fuzzing
mutates bytes, guided by code coverage, looking for crashes or a failed check.

## When to use

- **Property trigger:** a pure function whose rule fits in one sentence.
- **Property use cases:**
  - a pagination cursor or serialization round trip;
  - money split across lines that must add up to the total;
  - rounding that moves a value by at most half a step;
  - an idempotency key, where the same request gives the same key and a different request gives a different key;
  - a fast path that must agree with a slow, obvious one;
  - a normalizer where applying it twice equals applying it once.
- **Fuzz trigger:** untrusted bytes reach a parser.
- **Fuzz use cases:** token or JWT parsing; webhook payload decoding and signature checks; file upload decoders;
  query and filter parsers.
- **Skip when:** the rule is a table the business fixes by hand (prices, tax bands, grade boundaries). Use
  examples there. Keep example tests too for the cases a reader should see.
- **A stored status that moves** gets the stateful form instead: [state-machine.md](state-machine.md).

## Names

| Term | Meaning |
| --- | --- |
| Example test | One chosen input, one expected output |
| Property-based test | A rule over generated inputs, with shrinking. A person writes the rule; the tool searches for a counterexample |
| Stateful (model-based) | Random sequences of actions against a model, checking after each step ([state-machine.md](state-machine.md)) |
| Fuzzing | Coverage-guided mutated bytes looking for a crash or failed check. It needs no understanding of what the code should do |
| Agentic PBT | An agent reads code and docs, proposes properties, writes and runs the tests, and triages failures. It is still PBT. Its properties get the same review as a person's |

## Five property shapes

- **Round trip:** `decode(encode(x)) == x`.
- **Conservation:** the parts add up to the whole.
- **Bounds and ordering:** a result lies between known limits; sorting is ordered and keeps every element.
- **Oracle:** a fast or clever implementation agrees with a slow, obvious one.
- **Idempotence:** applying twice equals applying once.

## Writing one

```go
// The last second encoding/json can write: it refuses years after 9999.
const lastJSONSecond = 253402300799 // 9999-12-31T23:59:59Z

func TestCursor_RoundTrips(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		in := Cursor{
			ID:        rapid.String().Draw(t, "id"),
			CreatedAt: time.Unix(rapid.Int64Range(0, lastJSONSecond).Draw(t, "sec"), 0).UTC(),
		}
		out, ok := Decode(in.Encode())
		if !ok || out.ID != in.ID || !out.CreatedAt.Equal(in.CreatedAt) {
			t.Fatalf("round trip: got %+v, ok=%v", out, ok)
		}
	})
}
```

With a wider range, this property fails at once and shrinks to `sec = 253402300800`, the first second of the
year 10000. `json.Marshal` refuses that year, so `Encode` returns an empty cursor. No stored row reaches that
date, so the named bound states the real input domain. Finding an edge that nobody had written down is the
point of a property.

- **Label every draw** so a failure prints its inputs by name.
- **Constrain the generator** to the input the code accepts (ranges, `SampledFrom`). Don't return early inside
  the property: that silently skips inputs. A real domain limit goes in a named constant with its reason.
- **Replay:** the tool prints a seed or saves a fail file (`testdata/rapid/`, gitignored). Replay it before
  changing code. Raise the input count for one local run (`-rapid.checks=N`) when hunting.

A failing property means the code has a bug or the rule is wrong. Fix whichever is wrong, and never weaken the
generator to make it pass.

## Fuzzing

```go
func FuzzDecode(f *testing.F) {
	f.Add(Cursor{ID: "a", CreatedAt: time.Unix(0, 0).UTC()}.Encode())
	f.Add("")
	f.Add("not base64!")
	f.Fuzz(func(t *testing.T, s string) {
		c, ok := Decode(s) // must never panic
		if !ok {
			return
		}
		again, ok := Decode(c.Encode())
		if !ok || again.ID != c.ID || !again.CreatedAt.Equal(c.CreatedAt) {
			t.Fatalf("%q decoded to %+v, which does not round-trip", s, c)
		}
	})
}
```

- **Check more than "no panic":** whatever parses must re-encode, verify, or satisfy an invariant.
- **Seeds:** add real samples with `f.Add` (valid, empty and malformed). Plain `go test` runs only the seeds, so
  they double as regression tests.
- **Where it runs:** `go test -run '^$' -fuzz FuzzDecode -fuzztime 10m` runs in a scheduled CI job, not on every
  PR.
- **A crasher** lands in `testdata/fuzz/FuzzDecode/`. Commit it, and it becomes a permanent seed.
- `rapid.MakeFuzz` turns a property into a fuzz target when coverage guidance would help.

## Agent-written properties

An agent can propose properties from types, docstrings and comments. In one study, about half of the
agent's bug reports that were reviewed by hand were real bugs ([sources.md](sources.md)). Review each property like
code: a wrong property either passes on a bug or fails on correct code.
