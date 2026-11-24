# A formal spec with trace replay

A spec models a protocol: its actors, its messages in flight, and its crashes. A model checker or simulator
explores the orderings, and the invariants must hold in every state it reaches. The spec's traces are then
replayed against the real code, step by step, so the code is held to the same model.

## When to use

- **Trigger (any of these):**
  - the protocol crosses services;
  - several writers race on the same data;
  - messages are delivered at least once or out of order;
  - a crash between two steps must not lose or double anything;
  - leases or retries hand work between processes.
- **Typical use cases:**
  - outbox and inbox delivery;
  - a workflow or saga engine with leases;
  - usage → billing funding with late corrections;
  - refunds across a payment provider and a ledger;
  - a credit reserve, commit and release.
- **Skip when:**
  - CRUD around one status machine: [state-machine.md](state-machine.md);
  - a pure rule: [property-based.md](property-based.md);
  - one service with one writer: integration tests.
- **Gate:** record the protocol in an ADR's list of specified protocols, with a dated entry, before writing its
  code. Most services never need a spec.

**Why:** a spec finds design bugs that tests miss, because it tries the orderings and crash points nobody wrote
an example for. At AWS, specs found design bugs that no other technique they used found. A simulated run
samples, and a bounded check covers small sizes only. A spec never proves the code correct, and it can model
the wrong system.

## Recipe

1. **Put the spec beside the code**, for example `<module>/spec/<name>.qnt` (or `.tla`, `.p`). Model messages in
   flight as a set, so any message can be delivered, again, at any time. Model a crash as an action.
2. **Name each invariant** (conservation, at most once, never negative), and combine them into one `safe`.
3. **Add a ghost variable `did`** that every action sets to its name and arguments. Each trace state then says
   which action ran, including traces from named runs, which carry no simulator metadata.
4. **Write named runs** for paths that random runs rarely take, with `expect` checks on the outcome.
5. **Add a spec task in CI** that runs:
   - the typecheck;
   - the named runs;
   - a simulation that checks `safe`;
   - trace generation with a fixed seed, so the traces are reproducible.

   The test task depends on the spec task.
6. **Write a replay test beside the spec.** For each trace:
   - create fresh real state (a fresh database);
   - for each state, switch on `did.act` and call the real entry points (handlers, consumers, sweepers), not
     internals;
   - project the real state into the spec's shape and compare it with the trace state;
   - on a mismatch, fail and print both.
7. **Assert that the traces reached the named scenarios.** If none did, raise the trace count or add a named
   run.
8. **To force an interleaving inside the code,** gate its I/O. The store and broker calls block until the
   replay releases them in the order the trace chose.
9. **A person reviews the invariants.**

Lesson from MongoDB: generating test cases from the spec worked. Checking logs of the implementation against an
abstract spec was impractical. Replay the spec into the code, not the code's logs into the spec.

## Example (Quint + Go)

```quint
module credits {
  pure val CHARGES = Set(1, 2, 3) // charge c costs c credits
  pure val START = 2
  pure val TOPUP = 2

  type Did = { act: str, charge: int } // ghost: what produced this state
  var balance: int
  var shortfall: int
  var toppedUp: int
  var sent: Set[int]    // published; the broker may deliver any of these, again, at any time
  var applied: Set[int] // the consumer's inbox
  var did: Did

  action deliver(c: int): bool = {
    val debit = if (applied.contains(c)) 0 else c
    val paid = if (debit <= balance) debit else balance
    all {
      sent.contains(c),
      balance' = balance - paid,
      shortfall' = shortfall + debit - paid,
      applied' = applied.union(Set(c)),
      toppedUp' = toppedUp, sent' = sent,
      did' = { act: "deliver", charge: c },
    }
  }
  // init, publish(c) and topUp follow the same pattern (all fields assigned, did set)

  action step = any {
    nondet c = CHARGES.oneOf()
    any { publish(c), deliver(c) },
    topUp,
  }

  val conserved = START + toppedUp - applied.fold(0, (sum, c) => sum + c) == balance - shortfall
  val shortfallOnlyWhenEmpty = shortfall > 0 implies balance == 0
  val safe = and { conserved, shortfallOnlyWhenEmpty, balance >= 0 }

  run shortfallPaidByTopUpTest =
    init.then(publish(3)).then(deliver(3)).then(deliver(3))
      .expect(balance == 0 and shortfall == 1)
      .then(topUp).expect(balance == 1 and shortfall == 0)
}
```

```sh
quint typecheck spec/credits.qnt
quint test --out-itf "spec/testdata/runs/{test}_{seq}.itf.json" spec/credits.qnt
quint run --invariant safe --max-samples 20000 spec/credits.qnt
quint run --mbt --seed 1 --n-threads 1 --n-traces 300 --max-samples 300 \
  --out-itf "spec/testdata/traces/trace_{seq}.itf.json" spec/credits.qnt
```

```go
func TestSpec_TheLedgerReplaysEveryTrace(t *testing.T) {
	files, _ := filepath.Glob("testdata/traces/*.itf.json")
	runs, _ := filepath.Glob("testdata/runs/*.itf.json") // named runs reach the rare paths
	files = append(files, runs...)
	if len(files) == 0 {
		t.Fatal("no traces: run the spec task first")
	}
	reached := map[string]bool{}
	for _, file := range files {
		t.Run(filepath.Base(file), func(t *testing.T) {
			ledger := NewLedger(2) // fresh real state per trace; with a database, a fresh database
			for i, s := range readStates(t, file) {
				switch s.Did.Act { // drive the real code the way production does
				case "init", "publish":
				case "deliver":
					ledger.Apply(int(s.Did.Charge))
				case "topUp":
					ledger.TopUp(2)
				default:
					t.Fatalf("step %d: unknown action %q", i, s.Did.Act)
				}
				got := view{ledger.Balance, ledger.Shortfall}
				if want := (view{int(s.Balance), int(s.Shortfall)}); got != want {
					t.Fatalf("step %d after %s(%d):\n real %+v\n spec %+v", i, s.Did.Act, s.Did.Charge, got, want)
				}
				if s.Shortfall > 0 {
					reached["shortfall"] = true
				}
			}
		})
	}
	if !reached["shortfall"] {
		t.Error(`no trace reached "shortfall": raise the trace count or add a named run`)
	}
}
```

ITF is JSON: an integer is `{"#bigint": "5"}`, a set is `{"#set": [...]}`, a map is `{"#map": [[k, v], ...]}`. Decode
only the variables the replay compares. `readStates` unmarshals `states` into a struct whose integer fields use a
`#bigint` decoder.

**Prove the test can fail:** drop the inbox check in `Apply`. The replay should fail at the first redelivered
charge.

## Tools

| Tool | Notes |
| --- | --- |
| Quint | Same logic as TLA+ with a typed, programmer-friendly syntax. Runs on Node. Writes ITF traces (`--out-itf`, `--mbt`) |
| TLA+ (TLC, Apalache) | The most established. Apalache also writes ITF. Used at AWS and MongoDB |
| P | From AWS: communicating state machines with their own checker. Its traces aren't ITF, so replay into existing code needs your own glue |

Trace replay needs an ITF reader, either a library (see [tools.md](tools.md)) or a small decoder like the one
above.
