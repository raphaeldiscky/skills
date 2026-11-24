# Sources

Evidence types:

- **Study:** peer-reviewed research.
- **Industry:** a report from engineers at a company about its own practice.
- **Practitioner:** an author's or vendor's write-up.
- **Inference:** this skill's own reasoning.

| Claim in this skill | Source | Type |
| --- | --- | --- |
| Generated inputs with shrinking find counterexamples that hand-picked examples miss | Claessen & Hughes, [QuickCheck](https://doi.org/10.1145/351240.351266), ICFP 2000 | Study |
| PBT pays off on high-leverage components where properties are easy to state; writing generators and judging effectiveness are the hard parts | Goldstein et al., [Property-Based Testing in Practice](https://doi.org/10.1145/3597503.3639581), ICSE 2024 (30 interviews at Jane Street) | Study |
| Agent-proposed properties find real bugs; about half of the hand-reviewed reports were valid | Maaz, DeVoe, Hatfield-Dodds & Carlini, [Agentic Property-Based Testing](https://arxiv.org/abs/2510.09907), NeurIPS 2025 DL4Code workshop | Study |
| Stateful, model-based testing of real systems finds bugs in industrial code (AUTOSAR, file synchronizers) | Hughes, [Experiences with QuickCheck](https://research.chalmers.se/en/publication/232550), 2016; Hughes et al., [Mysteries of Dropbox](https://www.cis.upenn.edu/~bcpierce/papers/mysteriesofdropbox.pdf), ICST | Study |
| Formal specs found design bugs at AWS that no other technique they used found | Newcombe et al., [How Amazon Web Services Uses Formal Methods](https://cacm.acm.org/magazines/2015/4/184701-how-amazon-web-services-uses-formal-methods/fulltext), CACM 2015 | Industry |
| AWS combines formal and lightweight methods (property-based testing, fuzzing, fault injection) | Brooker & Desai, [Systems Correctness Practices at AWS](https://queue.acm.org/detail.cfm?id=3712057), ACM Queue 2025 | Industry |
| Generating tests from a spec worked; checking implementation traces against an abstract spec was impractical | Davis, Hirschhorn & Schvimer, [eXtreme Modelling in Practice](https://arxiv.org/abs/2006.00915), VLDB 2020 | Industry |
| Replaying Quint traces through a driver over the implementation | [quint-connect](https://hexdocs.pm/quint_connect/readme.html) and its ports; the Quint CLI (`run --mbt`, `--out-itf`) | Practitioner |
| 92% of catastrophic failures came from mishandled non-fatal errors; 77% of failures reproduce with a unit test | Yuan et al., [Simple Testing Can Prevent Most Critical Failures](https://www.usenix.org/conference/osdi14/technical-sessions/presentation/yuan), OSDI 2014 | Study |
| Prefer real implementations, then fakes; heavy mocking drifts from the real code and hinders refactoring; test state over interactions | Winters, Manshreck & Wright, [Software Engineering at Google, ch. 13](https://abseil.io/resources/swe-book/html/ch13.html) | Industry |
| Flakiness grows with test size | Listfield, [Where do our flaky tests come from?](https://testing.googleblog.com/2017/04/where-do-our-flaky-tests-come-from.html), 2017 | Industry |
| One abstract suite runs against every implementation of an interface | Rainsberger, [Abstract test cases, 20 years later](https://blog.thecodewhisperer.com/permalink/abstract-test-cases-20-years-later) | Practitioner |
| Test-shape debates (pyramid, trophy, honeycomb) are mostly about definitions of "unit" | Fowler, [On the Diverse and Fantastical Shapes of Testing](https://martinfowler.com/articles/2021-test-shapes.html), 2021 | Practitioner |
| Coverage correlates weakly with fault detection once suite size is controlled; use it to find gaps, not as a target | Inozemtseva & Holmes, [Coverage Is Not Strongly Correlated with Test Suite Effectiveness](https://cs.ubc.ca/~rtholmes/papers/icse_2014_inozemtseva.pdf), ICSE 2014 | Study |
| Mutation testing works at scale when it is scoped to changed code, filtered, and shown in review; raw mutants are mostly unproductive | Petrović, Ivanković, Fraser & Just, [Practical Mutation Testing at Scale](https://arxiv.org/abs/2102.11378), TSE 2021 | Industry + study |
| Metamorphic relations help where exact expected outputs are unknown | Segura et al., [A Survey on Metamorphic Testing](https://eprints.whiterose.ac.uk/110335/1/segura16-tse.pdf), TSE 2016 | Study |
| Deterministic simulation: one seed, injected faults, exact replay | [FoundationDB testing](https://apple.github.io/foundationdb/testing.html); [TigerBeetle VOPR](https://docs.tigerbeetle.com/about/vopr) | Industry |
| Golden files with one `-update` path, a reviewed diff, and a rerun | [gotest.tools golden](https://pkg.go.dev/gotest.tools/v3/golden) and similar libraries | Practitioner |
| Consumer-driven contracts, provider states, `can-i-deploy` | [Pact documentation](https://docs.pact.io/) | Practitioner |
| Start with the cheapest strategy that catches the risk, and escalate on an observable trigger | This skill; the codebase it was distilled from applies it as a two-tier policy (catalog and model tests everywhere, specs for named protocols) | Inference |
| Generated runs should assert what they reached, or a green run may have tested nothing | This skill, from trace-replay practice | Inference |
