# State-machine model tests

A stored status is a state machine whether or not anyone drew it. Write the machine down as one table, make
the database enforce it, and test the real store against the table with random sequences and races.

## When to use

- **Trigger:** a row stores a status that changes over time, especially when more than one writer can change it
  (webhooks, workers, schedulers, an admin UI).
- **Typical use cases:** order, invoice, payment, refund, delivery, subscription, job or run status; a review
  or approval workflow.
- **Skip when:** the status is computed from other data and never stored, or it is a two-value flag with one
  writer. Plain tests are enough there.

## 1. One table

Map each target status to the statuses it may come from. The SQL guard, the model and the docs all derive from
this one table. `AllowedFrom(target)` returns the sources, sorted, for the SQL parameter.

```go
func InvoiceMachine() machinetest.Machine[Status] {
	return machinetest.Machine[Status]{Initial: Draft, Table: map[Status][]Status{
		Open:          {Draft},
		Paid:          {Open, Uncollectible},
		Void:          {Open, Uncollectible},
		Uncollectible: {Open},
	}}
}
```

## 2. The guard lives in the database

Every update that moves the status names the statuses it may move from. Never read the status and then write it.

```sql
UPDATE invoices SET status = $2, updated_at = now()
 WHERE id = $1 AND status = ANY($3)   -- $3 = AllowedFrom($2)
RETURNING id;                         -- no row: the guard refused, or another writer won
```

- Under Postgres's default READ COMMITTED, a second concurrent `UPDATE` waits for the row lock and then re-checks
  its `WHERE` against the committed row. Exactly one of two racing writers wins.
- Side effects (an outbox row, an event) are written in the same transaction, and only when the update returned a
  row.
- A lint rule can refuse an `UPDATE … SET status = …` whose `WHERE` lacks `status = ANY(`.

## 3. Table test (unit, no database)

- Every source status is a known status. A source that is never a target and isn't the initial status is a typo.
- Every status is reachable from the initial one.
- If the SQL gets its list anywhere other than the table, assert that the list equals the table's for every target.
- For a small machine, also assert every from → to pair.

## 4. Model test against the real store (integration)

A driver adapts the repository on a real database:

- `New` inserts a row in the initial status;
- `Move(id, to)` returns whether the guard let the row move;
- `Status(id)` reads the row back.

Random sequences of three actions run against it:

| Action | Check |
| --- | --- |
| move | `moved` equals what the table allows from the model's status; if it moved, the model moves too |
| race | two concurrent moves to one target: winners = 0 if the move isn't allowed, 2 if the target may follow itself, otherwise 1 |
| observe (after every action) | the stored status equals the model's |

The tool shrinks a failure to the shortest sequence that still fails, and prints a seed to replay it.

```go
func Conform[S ~string](t *testing.T, m Machine[S], d Driver[S]) {
	targets := m.targets()
	rapid.Check(t, func(rt *rapid.T) {
		ctx := context.Background()
		id, err := d.New(ctx)
		if err != nil {
			rt.Fatal(err)
		}
		model := m.Initial
		rt.Repeat(map[string]func(*rapid.T){
			"move": func(rt *rapid.T) {
				to := rapid.SampledFrom(targets).Draw(rt, "to")
				moved, err := d.Move(ctx, id, to)
				if err != nil {
					rt.Fatal(err)
				}
				if want := m.CanMove(model, to); moved != want {
					rt.Fatalf("move %s -> %s: moved=%v, the table says %v", model, to, moved, want)
				}
				if moved {
					model = to
				}
			},
			"race": func(rt *rapid.T) {
				to := rapid.SampledFrom(targets).Draw(rt, "to")
				wins := moveTwiceConcurrently(rt, ctx, d, id, to) // counts moved == true; fails on any error
				if want := raceWins(m, model, to); wins != want {
					rt.Fatalf("race %s -> %s: %d winners, want %d", model, to, wins, want)
				}
				if wins > 0 {
					model = to
				}
			},
			"": func(rt *rapid.T) { // rapid runs this after every action
				if got, err := d.Status(ctx, id); err != nil || got != model {
					rt.Fatalf("stored %s (err %v), the model says %s", got, err, model)
				}
			},
		})
	})
}
```

```go
// raceWins is how many of two concurrent moves to the same target must succeed.
func raceWins[S ~string](m Machine[S], from, to S) int {
	switch {
	case !m.CanMove(from, to):
		return 0
	case m.CanMove(to, to): // a self-loop: both may move
		return 2
	default:
		return 1
	}
}
```

`moveTwiceConcurrently` starts two goroutines that call `d.Move`, collects both results over a channel, fails on
any error, and returns how many moved.

Each racer needs its own database connection, so give the driver a pool. A single client or session runs its
queries one at a time, so the race would never happen and the test would pass on unguarded code.

Mapping the repository onto `Move`:

- A repository with one method per transition (`Pay`, `Void`) gets a `Move` that switches on the target.
- A method that returns a sentinel error when the guard refuses maps that sentinel to `(false, nil)`. Any other
  error fails the test.

The same loop works in other languages: Hypothesis `RuleBasedStateMachine`, fast-check `fc.commands` with
`asyncModelRun`, proptest-state-machine, jqwik `ActionChain` ([tools.md](tools.md)).

## When it is red

A red run means the code and its table disagree. Decide which is wrong and fix that, never the test. The tests
trust the table, so a person reviews every change to it. Replay a failure from its seed or fail file before
changing anything.

**Prove the test can fail:** remove the `status = ANY(…)` guard once. The run should fail within a few actions
on a move that the table refuses.
