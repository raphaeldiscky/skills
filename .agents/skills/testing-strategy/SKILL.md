---
name: testing-strategy
description: Use when deciding which tests a change needs, writing them, or judging whether a test suite is strong enough, in any language. Triggers include a contract with several implementations (gateways, providers, adapters, a fake), a stored status that moves (order, invoice, job), a pure rule (round trip, money split, idempotency key), untrusted input reaching a parser, rendered output (templates, generated docs), an API other teams or apps consume, a protocol that crosses services, races writers or is delivered at least once or out of order, and your own distributed runtime. Also for flaky, mock-heavy, or high-coverage-but-weak suites.
---

# Testing strategy

Choose tests by the shape of the code. Start with the cheapest strategy that can catch the risk, and escalate
only when the code shows the trigger. Every strategy here holds the real code to something written down apart
from it: a list of cases, a table, a property, a spec. A test that only restates the code proves nothing.

## 0. Follow the project first

- Read the project's test conventions, ADRs, helpers and CI before adding anything. Use its runner, helpers,
  file names and build tags. A project rule beats this skill.
- If the project already has a helper or library for a strategy, call it. The code in these files shows how
  such a helper works; it is not code to copy into each service.
- A new test library or tool (property-based, Pact, Quint, a mutation tool) is a dependency: propose it and
  ask before adding it.

## 1. Strategy map

Each row names the trigger to look for in the code. "Skip when" names what is enough instead.

| Strategy | Use when | Typical use cases | Skip when | Read |
| --- | --- | --- | --- | --- |
| **Baseline** | Always | Behavior through the public surface, real database in a container, every error and refusal path | Never | [baseline.md](baseline.md) |
| **Case catalog** | One contract has ≥2 implementations (a fake counts), or flows need tracking toward production | Payment gateways behind one port; email or SMS providers plus a fake; LLM vendors behind one interface; storage backends | One implementation and no fake: plain tests | [case-catalog.md](case-catalog.md) |
| **State-machine model test** | A row stores a status that moves, and more than one writer can move it | Order, invoice, payment, delivery, subscription, job status | The status is derived, never stored; a two-value flag with one writer | [state-machine.md](state-machine.md) |
| **Property-based** | A pure function's rule fits in one sentence | Cursor or serialization round trip; splitting money; idempotency key derivation; a fast path that must agree with a slow one | The rule is a hand-fixed table (prices, tax bands, grade boundaries): examples | [property-based.md](property-based.md) |
| **Fuzzing** | Untrusted bytes reach a parser | Token or JWT parsing; webhook payload and signature checks; file upload decoders; query or filter parsers | Input is typed and validated before it reaches the code | [property-based.md](property-based.md#fuzzing) |
| **Golden files** | The code renders an artifact a reviewer should see whole | Email templates; generated docs; schema snapshots; CLI output | The output is small enough to assert inline | [baseline.md](baseline.md#golden-files) |
| **Provider conformance / consumer-driven contracts** | An API has consumers you do not deploy with | A public REST API with an OpenAPI spec; mobile app versions in the wild; another team's service or message consumer | Consumers ship in the same deploy: integration tests | [contract-testing.md](contract-testing.md) |
| **Formal spec + trace replay** | A protocol crosses services, races writers, is delivered at least once or out of order, or must survive a crash between steps | Outbox and inbox delivery; a workflow or saga engine with leases; usage to billing with corrections; refunds across provider and ledger; a credit reserve and release | CRUD around one status machine: the model test | [formal-spec.md](formal-spec.md) |
| **Deterministic simulation** | You own a runtime whose correctness depends on timing, network or disk faults | Replicated log or consensus; a custom queue, scheduler or storage engine; a multi-service flow run in one process | An app on a managed database and broker whose protocol has a spec | [simulation.md](simulation.md) |
| **Judging the suite** | You need to know if the tests would catch a change | Reviewing a PR's new tests; a critical module with high coverage and escaped bugs; before refactoring agent-written code | Generated code, glue, one-off scripts | [judging-tests.md](judging-tests.md) |

Tools for each strategy in Go, Python, TypeScript, Rust and Java: [tools.md](tools.md).

## 2. Escalation tiers

1. **Every project:** the baseline.
2. **When the shape appears:** the case catalog, model test, property, fuzz target, golden file or contract
   test that the trigger names. A service usually has several.
3. **Named protocols only:** formal spec + replay, or deterministic simulation. List the protocols that get
   this tier in an ADR, with a dated entry, before writing their code. Most services never need it.

Inference, not a measured result: the expensive tiers pay off only where orderings, crashes and racing writers
decide correctness, which example tests rarely reach.

## 3. Always

- **Red means disagreement.** A failing test means the code and what was written down (a case, a table, a
  property, a spec) disagree. Decide which is wrong and fix that. Never weaken the test, the generator or the
  invariant to get green.
- **A person reviews every model.** Tables, properties, invariants and specs are what the tests trust. A model
  can be internally consistent and still describe the wrong system.
- **Prove each new test can fail.** Break the code once on purpose (drop the guard, the dedupe, the
  transaction) and watch the test go red. Then restore the code.
- **Random tests replay.** Every randomized test prints its seed or saves a fail file. A failure it found becomes
  a fixed regression seed or example.
- **Generated runs show what they reached.** Assert that random runs reached the statuses and scenarios that
  matter. Otherwise a green run may have tested nothing.
- **CI enforces the pieces.** A check fails a service that lacks a required piece, and the check has its own
  test: [baseline.md](baseline.md#the-conformance-gate).

## 4. Evidence

Each claim's source and evidence type (peer-reviewed study, industry report, practitioner, or inference) is in
[sources.md](sources.md). Consumer-driven contracts and deterministic simulation come from the literature
and have not been exercised in the codebase this skill was distilled from.
