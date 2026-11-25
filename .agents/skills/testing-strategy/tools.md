# Tools by language

Use what the project already has first. A new tool is a dependency, so propose it before adding it. The names
below were checked in November 2026. Confirm the current version and API in each tool's docs before relying on a
flag.

| Strategy | Go | Python | TypeScript / JS | Rust | Java / Kotlin |
| --- | --- | --- | --- | --- | --- |
| Real database in a container | testcontainers-go | testcontainers-python | testcontainers (node) | testcontainers | Testcontainers |
| Property-based | rapid (`pgregory.net/rapid`) | Hypothesis | fast-check | proptest | jqwik |
| Stateful / model-based | rapid `T.Repeat` | Hypothesis `RuleBasedStateMachine` | fast-check `fc.commands` + `modelRun` / `asyncModelRun` | proptest-state-machine | jqwik `ActionChain` |
| Fuzzing | `go test -fuzz` (built in) | Atheris | Jazzer.js (open-source maintenance stopped; check its status) | cargo-fuzz | Jazzer |
| Golden / snapshot | gotest.tools `golden`, goldie | syrupy | Vitest / Jest snapshots, `toMatchFileSnapshot` | insta | ApprovalTests.Java |
| Mutation | gremlins (check diff support in your version) | mutmut, Cosmic Ray | StrykerJS | cargo-mutants (`--in-diff`) | PIT (pitest) |
| Consumer-driven contracts | pact-go | pact-python | pact-js | pact_consumer (pact-rust) | pact-jvm |
| Deterministic simulation | no standard library: in-process services with a controlled broker and clock, or Antithesis | — | — | turmoil, madsim | — |

These tools don't depend on the code's language:

| Need | Tool |
| --- | --- |
| OpenAPI conformance from the spec | Schemathesis (property-based, built on Hypothesis). Dredd is archived |
| Breaking-change diff of an OpenAPI spec | oasdiff |
| Formal spec + traces | Quint (writes ITF), TLA+ with TLC or Apalache (Apalache writes ITF), P |
| Reading ITF traces | itf-go (Go); quint-connect (Rust, with TypeScript and Elixir ports); or a small JSON decoder |
| Black-box fault injection on a cluster | Jepsen |
