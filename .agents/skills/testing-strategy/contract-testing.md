# Contract tests

"Contract test" names three different things. Pick the right one first.

## When to use

| Kind | Use when | Typical use cases | Skip when |
| --- | --- | --- | --- |
| **Interface contract** (one suite, every implementation) | Your code has ≥2 implementations of one interface | Gateways, providers, storage backends, a fake | One implementation. This kind is the [case catalog](case-catalog.md) |
| **Provider spec conformance** | You publish an API spec (OpenAPI, AsyncAPI, protobuf) that clients code against | A public REST API; partner integrations; checking that every operation enforces the auth its spec declares | No published spec, and every client ships with you |
| **Consumer-driven contracts** | Consumers you don't deploy with rely on specific fields and behavior, and each side deploys on its own | Mobile app versions in the wild; another team's service; a message consumer in another repo | Consumers ship in the same deploy (integration tests are enough); a public API with unknown consumers (use provider conformance) |

Consumer-driven contracts have not been exercised in the codebase this skill was distilled from. The recipe
below follows Pact's documentation, so check the current docs before adopting it.

## Provider spec conformance

The spec is the source of truth. The code is held to it.

- **Every operation is exercised.** A test enumerates the spec's operations and fails when one has no test
  request. A new endpoint then can't ship untested.
- **Auth as declared:** for each operation, a request without credentials gets 401, and the wrong permission
  gets 403, as the spec states. A public operation is marked public in the spec, not by omission.
- **Shapes:** generate requests from the spec and validate responses against it (Schemathesis does this for
  OpenAPI with property-based generation). Dredd's repository was archived in 2024, so don't adopt it.
- **Breaking changes:** diff the spec against the main branch in CI (`oasdiff breaking`). A removed field or a
  narrowed type fails unless it is versioned.

## Consumer-driven contracts (Pact)

1. **Consumer test:** the consumer's client runs against Pact's mock provider. It records only the interactions
   it actually uses, as a pact file.
2. **Publish** the pact to a broker (Pact Broker or PactFlow), tagged with the consumer's version and branch.
3. **Provider verification:** the provider's CI replays every consumer's pact against the real provider.
   **Provider states** set up the data each interaction needs.
4. **`can-i-deploy`:** before a deploy, ask the broker whether this version is verified against the versions
   running in the target environment.
5. **Messages:** message pacts cover the same flow for events on a queue.

**Choosing between them:** provider conformance covers the whole published surface. Consumer-driven contracts
cover what known consumers use, and tell you when a change breaks one of them. Teams with both external clients
and internal consumers often run both.
