# Tools for Go

Use what the project already has first. A new tool is a dependency, so propose it before adding it. The names
below were checked in November 2026. Confirm the current version and API in each tool's docs before relying on a
flag.

| Strategy | Tool | Notes |
| --- | --- | --- |
| Unit and integration tests | `testing`, testify | Integration tests behind a build tag (`-tags integration`) so the fast run needs no Docker |
| Real database in a container | testcontainers-go | One shared fixtures package (Postgres and the other backing services) that every service imports |
| Property-based | rapid (`pgregory.net/rapid`) | Keep it in `_test.go` files; a failure is saved under `testdata/rapid/`, replay with `-rapid.failfile=<path>` |
| Stateful / model-based | rapid `T.Repeat` | Wrap the loop in one shared helper ([state-machine.md](state-machine.md)) and call it from each service |
| Fuzzing | `go test -fuzz` (built in) | The corpus lives in `testdata/fuzz/<FuzzName>/`; commit the inputs that found bugs |
| Golden files | a `-update` flag and `testdata/golden/` | No library needed ([baseline.md](baseline.md#golden-files)) |
| Formal spec + traces | Quint (npm `@informalsystems/quint`), writes ITF | Run it from a task: typecheck, test, run with invariants, then `--mbt` traces |
| Reading ITF traces | a small decoder package, or itf-go | Replay each trace step by step against the real code |
| Mutation | gremlins (check diff support in your version) | Not a CI gate; scope it to changed lines ([judging-tests.md](judging-tests.md)) |
| Consumer-driven contracts | pact-go | Only when consumers ship apart from the provider ([contract-testing.md](contract-testing.md)) |
| OpenAPI conformance and breaking changes | Schemathesis (runs against the server), oasdiff | Language-neutral; they read the spec |
| Deterministic simulation | no standard library: in-process services with a controlled broker and clock, or Antithesis | [simulation.md](simulation.md) |
| Black-box fault injection on a cluster | Jepsen | Not deterministic; needs no code changes |
