---
name: untangle-codebase
description: Untangle a whole codebase in one pass, so agents working in it read less per change, break less without noticing, and debug faster.
disable-model-invocation: true
argument-hint: "[optional area or concern to focus on]"
---

Start a thorough refactor of this codebase and complete it to the end. Pause only where this skill asks for the user's approval.

Treat this as a goal. If an area or concern was passed in, start there.

**Why do this at all?**

- **Better output:** agents write better code in a well-structured codebase.
- **Cheaper & faster changes:** agents spend fewer tokens searching and more on the problem.
- **Fewer silent breaks:** agents break less without noticing.
- **Faster debugging:** agents find root causes faster.

**1. Ask**

Besides untangling the codebase, there are two other things you may do:

| Addition | What it does |
| --- | --- |
| **Comments** | Remove comments that only restate the code. |
| **Tests** | Remove tests that wouldn't catch a real bug, and fix the ones that fail without one. |

List these (with their exact descriptions) for the user and ask which ones to do. Then do only those.

Also list the **outward contracts**: whatever outside this repo depends on it, such as persisted data and schemas, applied migrations, public APIs, wire and event formats, a library's exports, CLI flags and output, URLs and routes, env and config names, storage keys, analytics events, and log and metric names. Changing one needs the user's approval, one change at a time. Never edit an applied migration. Change a contract by expanding, migrating, then contracting.

**2. List every problem**

Don't change anything yet.

Go through the codebase asking one thing: **should these pieces change together?** Write down every place the code gets the answer wrong, as in the [decision log example](#decision-log-example). There are only three ways to get it wrong.

**Hidden links:** pieces that must change together, where the code doesn't show it.

- Copies of logic or values: change one and the others must change too, but nothing says so. Copies in separately released units (services, apps, packages) can be deliberate, because sharing them ties their releases together. Ask whether they must change together at release time.
- A module that reads a global or file set by another module: change that module and this one breaks, but nothing shows it (self-contained code).
- Pieces in different processes or repos that share a payload, table or storage key without a shared definition: change one side and the other breaks, but nothing shows it.
- A feature split across folders by layer, or related code in different folders: one change needs all of them, but the layout hides that (domain-driven code, colocation). Skip this when the project chose that layering (controller/service/repo, MVC, framework folder conventions), and ask before moving folders.
- A call order or convention callers just have to know: change it and callers break, but nothing warns them (explicit over implicit).

**Needless links:** pieces tied together that change for different reasons.

- Callers that depend on internals: the internals change for their own reasons, and the callers break anyway (encapsulation).
- Stable code that imports something more volatile: the stable code has to change whenever the volatile code does (dependency direction).
- A general function with a parameter only one workflow understands: the function has to change whenever that workflow does (caller vocabulary).
- A shallow module: its interface changes whenever its internals do, so its callers change with it (deep modules).

**Surplus:** pieces with no reason of their own to change.

- Wrappers: they only change when the thing they wrap does (pass-through wrappers).
- Extension points and config for things that never vary: nothing will ever change them (speculative generality). Check per-environment config, feature flags and user settings first, because they can vary outside the code.
- Dead code: nothing uses it, so nothing will ever need it to change. Before calling code dead, check what the import graph can't see: framework file conventions, routes and jobs registered by config, queue and event handlers, webhooks, plugins or DI registered by name, strings in templates and markup, build and deploy config, scripts, and a library's public exports.

Also write down every **special case**: code that exists for one situation instead of following from how the system works. Each one is a requirement the design never accounted for, so use them to work out what the system needs to be.

- An `if` for one value
- A parameter for a specific caller
- A swallowed exception
- A retry or sleep
- A disabled test

Some special cases are real requirements: retries with backoff at network boundaries (which need idempotency), best-effort side effects, auth, permission and validation checks, and workarounds for a bug in a browser, platform, vendor or proxy. Keep them, in one place. The ones to remove are sleeps and retries that hide a race inside the code. Flag security-relevant checks for the user's review before moving or removing them.

**3. Redesign from first principles**

Work out the fixes as if the system had known today's requirements from the start. Look for the one fix behind several problems, which often looks nothing like them. Don't fix special cases one by one.

Ask the same thing of every fix, even one that looks better in the code: pieces that change together end up together, pieces that don't aren't tied, and everything depends on what changes less.

Keep observable behavior and cost the same. Moving code can change initialization order, transaction and lock boundaries, concurrency, re-renders, lazy loading, round trips and query counts.

Write each fix above the problems it solves, as in the [decision log example](#decision-log-example).

**4. Fix everything on the list**

Wherever coverage is thin, first pin current behavior at the boundaries with tests that fail on a regression. Do this whether or not the user chose Tests. Then fix in small steps that can each be released and rolled back on their own.

Remove the special cases the redesign makes unnecessary, and keep the ones the system still needs. Don't go looking for bugs separately. A structural fix may fix some along the way, which is fine.

If the user chose Comments:

- Comments that restate the implementation, like `// sort first so the binary search works`, only change when it does, so they have no reason of their own to change. Remove them, even if they're phrased as a why.
- Comments about something outside the code, like `// the proxy drops websockets, so we poll`, change when that does, and the code can't show it. Keep them.
- Comments that explain a workaround in the codebase, like `// wait 100ms because the cache isn't ready yet`, only change when the problem behind the workaround does. They go when the redesign removes that problem.

If the user chose Tests, do this last, because tests are your regression safety net. A test should fail on a regression, and only then:

- Tests that repeat the implementation only change when it does, so they have no reason of their own to change. They check the same interpretation against itself, so remove them.
- Tests tied to internals break when the code changes but behavior doesn't, so they change for the wrong reason. Rewrite them to depend on behavior, which changes less.
- Tests that can't fail pass whatever the code does, so no change ever affects them. They aren't checking anything, so remove them.

**5. Check, and repeat until done**

Have subagents search for special cases, hidden links, needless links and surplus. **Do not stop until there is nothing worth fixing left.**

You're done when:

- **As few special cases are left in the system as possible.** How many remain is the best measure of how close you are.
- A typical change lands in one place.
- Every import is reasonable, and nothing imports anything more volatile than itself.
- Subagents have no issues left that are worth fixing.
- Intended behavior is the same as when you started, apart from bugs the refactor fixed. Judge it at what users and other systems can see: UI behavior, API responses including errors, payloads, exports, CLI output, persisted formats, and cost (queries, round trips, bundle size, renders, latency). Test this at the end, and confirm that suites needing a database, network or env files actually ran instead of skipping.

**Tips**

- **Start from a skeleton:** script away the function bodies, so the whole codebase fits in context.
- **Summarize with subagents:** have them summarize parts of the codebase, so you can reason across all of it at once.
- **Check the dependency graph often:** script one that shows what imports what, and rerun it as you go.
- **Enter where leverage is highest:** start looking there first.
- **Keep a decision log:** compaction is less of a problem that way.
- **Find entrypoints beyond imports:** read routing, scheduler, handler, build and deploy config.
- **Use Git as evidence:** for how often pieces change, and what changes together. It can't see consumers in other repos.

<a id="decision-log-example"></a>**Decision log example**

The list of problems:

```md
- `ui/LogoutDialog.tsx:30` waits 100ms after closing and hopes the message input can take focus by then.
- `ui/Toolbar.tsx:40` and `ui/Menu.tsx:22` call the same actions, each with its own check for when they're disabled.
- `checkout/submit.ts:9` depends directly on `payments/stripe.ts`.
- `shortcuts/keymap.ts:18` has a switch with one case per action, separate from the menu's list.
- `ui/CommandPalette.tsx:55` keeps its own list of actions, and it's missing the newer ones.
- `ui/SettingsDialog.tsx:61` sets a global `skipRefocus` flag to stop the logout dialog it opens from sending focus to the message input.
- `history/undo.ts:30` has a special case for every action that can be undone.
- `refunds/refund.ts:22` wraps every Stripe call in `if (order.provider === "paypal")`.
- Every action handler has to call `track()` by hand, and some don't.
- `ui/Toolbar.test.tsx` and `ui/Menu.test.tsx` test the same actions separately.
```

Then with the fixes:

```md
- Make the general `Dialog` give focus back to whatever had it before it opened, so the wait and the flag can both go.
  - `ui/LogoutDialog.tsx:30` waits 100ms after closing and hopes the message input can take focus by then.
  - `ui/SettingsDialog.tsx:61` sets a global `skipRefocus` flag to stop the logout dialog it opens from sending focus to the message input.
- Define a `PaymentProvider` interface that Stripe and PayPal both implement, so checkout and refunds no longer know which one they're using.
  - `checkout/submit.ts:9` depends directly on `payments/stripe.ts`.
  - `refunds/refund.ts:22` wraps every Stripe call in `if (order.provider === "paypal")`.
- Make every user action a command with a name, a handler and an undo, so the toolbar, menu, shortcuts, palette and undo history all run from one list.
  - `ui/Toolbar.tsx:40` and `ui/Menu.tsx:22` call the same actions, each with its own check for when they're disabled.
  - `shortcuts/keymap.ts:18` has a switch with one case per action, separate from the menu's list.
  - `ui/CommandPalette.tsx:55` keeps its own list of actions, and it's missing the newer ones.
  - `history/undo.ts:30` has a special case for every action that can be undone.
  - Every action handler has to call `track()` by hand, and some don't.
  - `ui/Toolbar.test.tsx` and `ui/Menu.test.tsx` test the same actions separately.
```

The same format outside the UI:

```md
- Move per-tenant discounts into tenant settings that pricing reads, so the tenant branch goes. This adds persisted data, so it needs the user's approval.
  - `api/orders.ts:44` has `if (tenant === "acme")` for a custom discount.
- Give `orders` one owner module that exposes the active orders, so billing and reports stop repeating the cancelled-order filter.
  - `billing/invoice.ts:18` and `reports/revenue.ts:30` both read the `orders` table, each with its own filter for cancelled orders.
- Send email, SMS and push through one `Notifier` that owns retries, and retry only sends that are safe to repeat.
  - `email/send.ts`, `sms/send.ts` and `push/send.ts` call sites each wrap the send in their own retry, and only some are safe to repeat.
- Read config once at startup into a typed settings object and pass it in, keeping the env var name unchanged.
  - `jobs/export.ts:12` reads `process.env.EXPORT_BUCKET` deep inside the job.
```
