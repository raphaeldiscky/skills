# Deterministic simulation testing

Deterministic simulation testing (DST) runs the real system with every source of nondeterminism under one seed:
time, randomness, network, disk and scheduling. Faults are injected at random, invariants are checked
throughout, and a failing seed replays exactly.

This technique has not been exercised in the codebase this skill was distilled from. The recipe follows public
write-ups from FoundationDB and TigerBeetle.

## When to use

- **Trigger:** you own a runtime whose correctness depends on timing, network or disk faults, or you can run a
  multi-service flow in one process with the broker and clock under your control.
- **Typical use cases:**
  - a replicated log or consensus;
  - a custom queue, scheduler or lease manager;
  - an embedded storage engine;
  - a money flow across services, run in-process against a fake broker.
- **Skip when:**
  - an app on a managed database and broker whose protocol already has a spec and replay
    ([formal-spec.md](formal-spec.md));
  - concurrency inside one process only: a race detector plus a stateful property with races
    ([state-machine.md](state-machine.md)).

## Spec or simulation?

A spec explores the **design**: every small interleaving, cheaply, before code exists. A simulation explores the
**implementation**: real code under random faults, at the cost of designing for it up front. FoundationDB built
its simulator before the database. Start with the spec when the protocol is the risk. Add simulation when the
runtime itself is the risk.

## Recipe

1. **Put every source of nondeterminism behind an interface:** the clock, randomness, the network, disk I/O and
   the scheduler or message delivery order. One seed drives them all. Production wires the real ones.
2. **Run deterministically.** Use a single-threaded executor, or a controlled scheduler that decides which
   ready task runs next. In Go the runtime scheduler is not controllable, so run the services in one process,
   give the simulator control over the broker, the clock and the delivery order, and keep each handler
   synchronous.
3. **Inject faults** from the seed: drop, duplicate, reorder and delay messages; crash and restart a node at
   named failpoints; fail or corrupt disk writes. Failpoint hooks are no-ops in production, like FoundationDB's
   `BUGGIFY`.
4. **Check invariants** after every step, and once more when the system is quiet (no messages in flight).
5. **Log the seed and commit** of every run, and replay a failing seed exactly. Keep it as a regression seed.
6. **Count what happened.** Report how often each fault and scenario fired, and fail when one never fired.
7. **Run many seeds** in a scheduled job, and a fixed handful on every PR.

**Prove the test can fail:** remove the dedupe or split one transaction in two. Some seed should fail, and
replaying that seed should fail the same way.

## Alternatives

- **Antithesis** (commercial): a deterministic hypervisor that runs unmodified services.
- **Jepsen:** black-box tests on a real cluster with fault injection and a history checker. It is not
  deterministic, but it needs no changes to the code.
