---
name: untangle-codebase
description: Runs a gated, whole-codebase refactor that finds code which changes together but isn't kept together (or the reverse), logs every finding with a proposed fix, and applies the fixes the user approves as small behavior-preserving commits. Use when asked to untangle, restructure or reduce coupling across a codebase or one area of it.
disable-model-invocation: true
argument-hint: "[optional area or concern to focus on]"
---

Refactor this codebase so a typical change lands in one place, and carry it through to the end. Focus: $ARGUMENTS (if empty, the whole codebase, starting where leverage is highest).

The payoff is for agents and people alike: less to read per change, fewer silent breaks, faster debugging.

**Ground rules**

- The project's own instructions, ADRs and lint rules override this skill. A documented decision is not a finding: if it looks wrong, propose changing it to the user and leave the code alone.
- Keep a **decision log** in a file (the scratchpad, or a path the user picks), not only in context. It is what survives compaction. Each entry has a status: proposed, approved, done, or skipped (with why).
- Follow the project's branch, commit and PR conventions. Don't create branches or worktrees unless the project allows it.

**1. Explore and baseline**

Don't change anything yet.

- Read the project's instructions and decision records, and find the entrypoints beyond imports: routing, schedulers, handlers, queue and event consumers, build and deploy config.
- Record a baseline you can compare against at the end: build, lint and the full test run (note which suites skipped and why), the dependency graph and its cycles, and the cost proxies the project can measure (query counts, bundle size, benchmarks).
- List the **outward contracts**: whatever outside this repo depends on it, such as persisted data and schemas, applied migrations, public APIs, wire and event formats, a library's exports, CLI flags and output, URLs and routes, env and config names, storage keys, analytics events, and log and metric names. Callers also depend on what isn't documented: error text, ordering, timing (Hyrum's Law).

**2. Ask**

Ask the user once, with what you found:

| Choice | What it does |
| --- | --- |
| **Comments** | Remove comments that only restate the code. |
| **Tests** | Remove tests that wouldn't catch a real bug, and fix the ones that fail without one. |
| **Budget** | How much to do: the areas in scope and how many passes, so the loop in step 7 has an end. |

Do only the ones chosen. Also confirm the contract list. Changing a contract needs the user's approval, one change at a time. Never edit an applied migration. Change a contract by expanding, migrating, then contracting (parallel change).

**3. List every problem**

Go through the codebase asking one thing: **should these pieces change together?** Write down every place the code gets the answer wrong, as in the [decision log example](#decision-log-example). There are only three ways to get it wrong.

**Hidden links:** pieces that must change together, where the code doesn't show it.

- Copies of logic or values: change one and the others must change too, but nothing says so. Copies in separately released units (services, apps, packages) can be deliberate, because sharing them ties their releases together. Ask whether they must change together at release time. Code that looks alike but changes for different reasons is not a copy: leave it, because the wrong abstraction costs more than duplication.
- A module that reads a global or file set by another module: change that module and this one breaks, but nothing shows it (self-contained code).
- Pieces in different processes or repos that share a payload, table or storage key without a shared definition: change one side and the other breaks, but nothing shows it.
- A feature split across folders by layer, or related code in different folders: one change needs all of them, but the layout hides that (domain-driven code, colocation). Skip this when the project chose that layering (controller/service/repo, MVC, framework folder conventions), and ask before moving folders.
- A call order or convention callers just have to know: change it and callers break, but nothing warns them (explicit over implicit).

**Needless links:** pieces tied together that change for different reasons.

- Callers that depend on internals: the internals change for their own reasons, and the callers break anyway (encapsulation).
- Stable code that imports something more volatile: the stable code has to change whenever the volatile code does (stable dependencies).
- A general function with a parameter only one workflow understands: the function has to change whenever that workflow does (caller vocabulary).
- A shallow module: its interface changes whenever its internals do, so its callers change with it (deep modules).

**Surplus:** pieces with no reason of their own to change.

- Wrappers: they only change when the thing they wrap does (pass-through wrappers). An adapter at a vendor or framework edge is not one: it changes when the vendor does, which is its own reason.
- Extension points and config for things that never vary: nothing will ever change them (speculative generality). Check per-environment config, feature flags and user settings first, because they can vary outside the code. An interface with one implementation is surplus unless a test seam really uses it.
- Dead code: nothing uses it, so nothing will ever need it to change. Take the language's unused-code tool (such as `deadcode`, `knip`, `vulture`) as the candidate list, not the verdict. Then check what the import graph can't see: framework file conventions, routes and jobs registered by config, queue and event handlers, webhooks, plugins or DI registered by name, strings in templates and markup, build and deploy config, scripts, and a library's public exports. Where access logs or telemetry exist, check route usage before deleting a route.

Also write down every **special case**: code that exists for one situation instead of following from how the system works. Each one is a requirement the design never accounted for, so use them to work out what the system needs to be.

- An `if` for one value
- A parameter for a specific caller
- A swallowed exception
- A retry or sleep
- A disabled test

Some special cases are real requirements: retries with backoff at network boundaries (which need idempotency), best-effort side effects, auth, permission and validation checks, and workarounds for a bug in a browser, platform, vendor or proxy. Keep them, in one place. The ones to remove are sleeps and retries that hide a race inside the code. Flag security-relevant checks for the user's review before moving or removing them.

**4. Redesign from first principles**

Work out the fixes as if the system had known today's requirements from the start. This describes the target, not a rewrite: reach it in steps, with the old and new shapes running side by side where needed (parallel change, strangler fig). Look for the one fix behind several problems, which often looks nothing like them. Don't fix special cases one by one.

Ask the same thing of every fix, even one that looks better in the code: pieces that change together end up together, pieces that don't aren't tied, and everything depends on what changes less.

Keep observable behavior and cost the same. Moving code can change initialization order, transaction and lock boundaries, concurrency, re-renders, lazy loading, round trips and query counts.

Write each fix above the problems it solves, as in the [decision log example](#decision-log-example). Rank the fixes by how many problems each removes and how risky it is.

**5. Approval gate**

Show the user the ranked decision log and wait. They approve, prune or reorder it, and may change the budget. Edit only what is approved. Anything that touches a contract, a security check or folder layout is approved one item at a time. A big refactor is cheap to redirect here and expensive after.

**6. Fix what was approved**

Wherever coverage is thin, first pin current behavior at the boundaries with characterization tests that fail on a regression. Do this whether or not the user chose Tests. Then fix in small steps, each one behavior-preserving, with the tests green and its own commit, so any step can be released or rolled back alone. Keep structure changes and behavior changes in separate commits. Prefer automated refactors (LSP or IDE rename and move, `ast-grep`, codemods) over hand edits for mechanical moves.

Remove the special cases the redesign makes unnecessary, and keep the ones the system still needs. Don't go looking for bugs separately. When a bug turns up, log it and fix it in its own commit with a test that failed first.

If the user chose Comments, remove a comment only when the code already says what it says, or when a restructure makes it say so:

- Comments that restate the implementation, like `// increment the counter`, only change when it does, so they have no reason of their own to change. Remove them, even if they're phrased as a why.
- A comment that guards a hidden link, like `// sort first so the binary search works`, is a finding, not clutter. Make the code show the link (a sorted type, or a `sortedIndex()` that sorts), then delete the comment.
- Comments about something outside the code, like `// the proxy drops websockets, so we poll`, change when that does, and the code can't show it. Keep them.
- Comments that explain a workaround in the codebase, like `// wait 100ms because the cache isn't ready yet`, only change when the problem behind the workaround does. They go when the redesign removes that problem.

If the user chose Tests, do this last, because tests are your regression safety net. A test should fail on a regression, and only then:

- Tests that repeat the implementation only change when it does, so they have no reason of their own to change. They check the same interpretation against itself, so remove them.
- Tests tied to internals break when the code changes but behavior doesn't, so they change for the wrong reason. Rewrite them to depend on behavior, which changes less, and do it before deleting the old test.
- Tests that can't fail pass whatever the code does, so no change ever affects them. Where a mutation-testing tool exists (such as Stryker, `mutmut`, `go-mutesting`), use surviving mutants as the evidence. Otherwise break the code on purpose and see whether the test notices. Remove the ones that never fail.

**7. Check, and repeat until done**

Have subagents, one area each, search for special cases, hidden links, needless links and surplus, and compare against the log. Fix what is new and worth fixing, then sweep again. A sweep that finds nothing new worth fixing ends the loop. So does the budget from step 2: when it runs out, report what remains, ranked, and stop. The loop has to end somewhere, and a big repo never reaches zero.

You're done when:

- **As few special cases are left in the system as possible.** How many remain is the best measure of how close you are.
- A typical change lands in one place.
- Every import is reasonable, and nothing imports anything more volatile than itself (stable dependencies).
- Subagents have no issues left that are worth fixing.
- Intended behavior is the same as the baseline, apart from the bugs you logged and fixed. Judge it at what users and other systems can see: UI behavior, API responses including errors, payloads, exports, CLI output, persisted formats, and cost (queries, round trips, bundle size, renders, latency). Rerun the baseline, and confirm that suites needing a database, network or env files actually ran instead of skipping.

**Tips**

- **Start from a skeleton:** script away the function bodies, so the whole codebase fits in context.
- **Summarize with subagents:** have them summarize parts of the codebase, so you can reason across all of it at once.
- **Check the dependency graph often:** script one that shows what imports what, and rerun it as you go.
- **Enter where leverage is highest:** hotspots first, meaning files with both high churn and high complexity.
- **Use Git as evidence:** `git log` for how often pieces change, and change coupling (files that change in the same commits, as `code-maat` reports) for hidden links. It can't see consumers in other repos.

<a id="decision-log-example"></a>**Decision log example**

The list of problems:

```md
- `ui/logout-dialog.tsx:30` waits 100ms after closing and hopes the message input can take focus by then.
- `ui/toolbar.tsx:40` and `ui/menu.tsx:22` call the same actions, each with its own check for when they're disabled.
- `checkout/submit.ts:9` depends directly on `payments/stripe.ts`.
- `shortcuts/keymap.ts:18` has a switch with one case per action, separate from the menu's list.
- `ui/command-palette.tsx:55` keeps its own list of actions, and it's missing the newer ones.
- `ui/settings-dialog.tsx:61` sets a global `skipRefocus` flag to stop the logout dialog it opens from sending focus to the message input.
- `history/undo.ts:30` has a special case for every action that can be undone.
- `refunds/refund.ts:22` wraps every Stripe call in `if (order.provider === "paypal")`.
- Every action handler has to call `track()` by hand, and some don't.
- `ui/toolbar.test.tsx` and `ui/menu.test.tsx` test the same actions separately.
```

Then with the fixes:

```md
- [approved] Make the general `Dialog` give focus back to whatever had it before it opened, so the wait and the flag can both go.
  - `ui/logout-dialog.tsx:30` waits 100ms after closing and hopes the message input can take focus by then.
  - `ui/settings-dialog.tsx:61` sets a global `skipRefocus` flag to stop the logout dialog it opens from sending focus to the message input.
- [proposed] Define a `PaymentProvider` interface that Stripe and PayPal both implement, so checkout and refunds no longer know which one they're using.
  - `checkout/submit.ts:9` depends directly on `payments/stripe.ts`.
  - `refunds/refund.ts:22` wraps every Stripe call in `if (order.provider === "paypal")`.
- [proposed] Make every user action a command with a name, a handler and an undo, so the toolbar, menu, shortcuts, palette and undo history all run from one list.
  - `ui/toolbar.tsx:40` and `ui/menu.tsx:22` call the same actions, each with its own check for when they're disabled.
  - `shortcuts/keymap.ts:18` has a switch with one case per action, separate from the menu's list.
  - `ui/command-palette.tsx:55` keeps its own list of actions, and it's missing the newer ones.
  - `history/undo.ts:30` has a special case for every action that can be undone.
  - Every action handler has to call `track()` by hand, and some don't.
  - `ui/toolbar.test.tsx` and `ui/menu.test.tsx` test the same actions separately.
```

The same format in a Go backend:

```md
- [proposed] Wire dependencies in one composition root (`cmd/serve.go`) and pass config and the database pool through constructors, so the env read and the global both go. The env var name stays the same.
  - `internal/service/export.go:12` calls `os.Getenv("EXPORT_BUCKET")` inside the export job.
  - `internal/repository/db.go:9` keeps the pool in a package-level variable that `main.go` must set before anything else runs.
- [proposed] Move per-brand discounts into brand data looked up from a registry, so shared code stops branching on the brand.
  - `internal/service/pricing.go:44` has `if brandID == "acme"` for a custom discount.
- [proposed, contract] Make `order-service` the only owner of orders and publish order changes as events into local read models, so the other services stop reading its schema. The new event is an outward contract, so it needs the user's approval.
  - `billing-service/internal/repository/invoice_pg.go:18` and `report-service/internal/repository/revenue_pg.go:30` both query `orders.orders`, each with its own filter for cancelled orders.
- [proposed] Let the queue consumer own retries: each task handler returns an error marked retriable or not, and sends are deduplicated by message ID, so the loops and sleeps go.
  - `internal/task/send_email.go:40`, `send_sms.go:35` and `send_push.go:28` each retry three times with `time.Sleep`, and only the email send is safe to repeat.
- [proposed] Use the concrete S3 client until a second store exists, so the interface goes.
  - `internal/storage/blob.go:8` defines a `BlobStore` interface with one implementation and no second in sight.
```
