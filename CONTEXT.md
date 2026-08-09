# Todo App (Unstuck Dashboard)

Jennifer's personal task, shopping, and grocery manager. One person, one dataset — designed for calm, low-friction task management rather than productivity maximalism.

## Language

### The system

**Family**:
One kind of item the app manages, as a unit: Tasks, Shopping Items, Grocery Items, Recurring Items, or Settings. The first four are list families (many items); Settings is a single object. "Cross-family" behavior is anything linking two families, e.g. completing a shopping-sourced Task marks its Shopping Item bought.
_Avoid_: Entity, collection, resource (resource is the server module, not the concept)

### Tasks & the Board

**Task**:
A single actionable item on the Board, with a status, importance, effort, decision load, and area.
_Avoid_: Todo, item, card (card is the visual widget, not the concept)

**Board**:
The main three-column view of Tasks: This Week, This Month, and Done.
_Avoid_: Dashboard, kanban

**Status**:
Where a Task lives in its lifecycle — one of `this-week`, `this-month`, `future`, `done`, `trashed`.
_Avoid_: Column, stage

**Future**:
A parking lot for Tasks not yet scheduled. Lives in its own tab, off the Board.
_Avoid_: Backlog, someday, icebox

**Area**:
The life category a Task belongs to: Life Admin, Social, Health, Learning, Career, or Project.
_Avoid_: Tag, label, category

**Effort**:
How much work a Task takes: low, medium, or high.

**Decision Load**:
How much thinking and deciding a Task demands, independent of effort: low, medium, or high.
_Avoid_: Complexity, difficulty

### The Matrix

**Matrix**:
The Eisenhower view: a 2×2 grid mapping Board Tasks (This Week and This Month only) by importance and urgency. Future, Done, and Trashed tasks never appear on it.
_Avoid_: Eisenhower box, priority grid

**Importance**:
Whether a Task matters to Jennifer's goals — a binary judgment (important / not important), set explicitly. Replaces the old high/medium/low priority.
_Avoid_: Priority (retired term)

**Urgency**:
Whether a Task needs attention now — derived, never stored: urgent means due within 2 days or overdue. A Task with no due date is not urgent.
_Avoid_: Time pressure

**Quadrant**:
One of the four cells of the Matrix: Do (urgent + important), Schedule (important only), Quick-hit (urgent only), Reconsider (neither).
_Avoid_: Delegate, Eliminate (classic Eisenhower names; this is a one-person system)

**Unsorted**:
A Board Task whose importance hasn't been judged yet. Unsorted Tasks never appear on the Matrix grid — they are sorted through Triage.
_Avoid_: Inbox, unplaced, tray (retired — the side tray was removed)

**Triage**:
The flow that presents Unsorted Tasks one at a time, as a stack, for sorting into a Quadrant. Skipping a Task sends it to the back of the stack; leaving Triage keeps remaining Tasks Unsorted. Triage is the only way importance is first judged on the Matrix.
_Avoid_: Sorting wizard, review mode

### Deletion & history

**Trash**:
Where soft-deleted Tasks go (`trashed` status). Restorable; purged automatically after 30 days.
_Avoid_: Recycle bin, deleted items

**Archive**:
The permanent Markdown log of Done tasks and bought Shopping Items older than four weeks. Archiving removes them from live data.
_Avoid_: History, log. Do not confuse with Future (unscheduled) or Trash (deleted).

### Lists

**Shopping Item**:
A lightweight thing to buy, categorized as a want or a need, optionally with links. Can be archived.

**Grocery Item**:
The lightest-weight item type — just a title and a bought/unbought checkbox. Never archived, only cleared.

**Recurring Item**:
A repeating obligation or reference that surfaces in This Week. Weekly items reset every Monday; long-term items repeat on a custom interval.
_Avoid_: Habit, routine

**Reference**:
A Recurring Item that carries information (a link, a note) rather than something to complete.

### Cards

**Card**:
One of Jennifer's physical credit cards, identified by a short key (usbar, amex, savorone, bofa, freedom, autograph). Fixed facts about a Card include whether it charges an FTF and whether its points are Transferable.
_Avoid_: Credit card (in code), payment method

**Spend Category**:
A kind of purchase used to pick a Card: dining, groceries, drugstores, gas/transit, online shopping, flights, hotels/cars, streaming, entertainment, cell phone, Amazon/Walmart/Target, and Everything Else.
_Avoid_: Purchase type, merchant category

**Earn Rate**:
What one Card pays in one Spend Category — a nominal percentage plus any Strings. The atom of the rewards data; the cheat-sheet table is derived from Earn Rates, never hand-written.
_Avoid_: Multiplier, cashback rate

**Strings**:
Conditions attached to an Earn Rate: a spend cap, a merchant exclusion, mobile-wallet-required, or a user-set choice category. A rate with no Strings is "clean."
_Avoid_: Caveats, conditions, restrictions

**Pinned**:
An Earn Rate flagged to win its Spend Category outright, regardless of nominal rate — a judgment call that a non-rate perk beats the rate winner (Amex Plat's $800/claim phone protection over Autograph's 3x on cell phone). The one exception to "ranking uses nominal rate only."

**Wildcard**:
An Earn Rate that competes in every Spend Category rather than one (USBAR's mobile-wallet 3%). A Wildcard is suppressed in any category where a clean, equal-or-better on-hand Card exists.

**FTF**:
Foreign transaction fee — a ~3% surcharge some Cards add abroad (BofA CCR, Freedom Unlimited). FTF Cards are excluded from Recommendations when Abroad.
_Avoid_: Foreign fee, forex fee

**Transferable**:
A Card whose points can move to airline/hotel partners and thus may beat face value (Amex MR). Shown as a badge; never affects ranking — ranking uses nominal rate only.

**Wallet**:
The set of Cards Jennifer has on hand right now. Part of Settings — persisted, not per-visit. The Wallet is the filter every Recommendation is computed against.
_Avoid_: Selected cards, active cards

**Abroad**:
A toggle indicating Jennifer is traveling internationally. When on, FTF Cards are excluded from Recommendations entirely. Independent of the Wallet — an FTF Card stays in the Wallet, it's just never recommended.
_Avoid_: Travel mode

**Recommendation**:
The best on-hand Card for a Spend Category — computed from Earn Rates, the Wallet, and Abroad; never stored. A Pinned rate wins outright; otherwise highest nominal rate wins. Ties on nominal rate break by fewest Strings; the runner-up shows as tied-with-caveat. Only ties surface a second Card.
_Avoid_: Suggestion, best pick

**Everything Else**:
The catch-all pseudo-category for purchases matching no Spend Category. Its Recommendation always shows two picks: the mobile-wallet choice and the physical-card fallback, since mobile-wallet acceptance isn't known in advance.
_Avoid_: Default, non-category, other

### Reporting

**Report**:
A user-submitted observation about the app, written down for an agent to act on later. Every Report has a Kind, a note, Page Context, and zero or more Targets.
_Avoid_: Feedback (mass noun), issue (collides with GitHub issues), ticket

**Kind**:
What a Report is: a `bug` (something is wrong) or an `idea` (something could be better). Chosen at submit time.
_Avoid_: Type, category, severity

**Reporter**:
The in-app tool for composing and submitting a Report: Report Mode plus the compose form. Opened by keyboard shortcut on desktop and by shaking the device on mobile.
_Avoid_: Bug tool, feedback widget

**Report Mode**:
The state the Reporter puts the app in: the page stays visible but input is repurposed — tapping or clicking an element toggles it as a Target instead of operating the app. A floating report button opens the compose form; dismissing Report Mode discards any selection.
_Avoid_: Picker, inspector, highlighter

**Target**:
One selected element captured in a Report: a short ID (`t1`, `t2`, …, in selection order), a descriptor (where it is), and a Snippet (what it is). A Report may have many Targets or none.
_Avoid_: Element (too generic), selection

**Mention**:
An inline reference to a Target embedded in a Report's note. Stored in plain text as the Target's ID token; shown in the Reporter as a small label chip within the text. Inserted by tapping the Target's button in the compose form.
_Avoid_: Link, tag, reference (too generic)

**Snippet**:
The trimmed HTML of a Target, captured so an agent can identify the exact element without running the app. May contain personal data, which is why Reports are never committed.

**Page Context**:
What the Reporter captures automatically about the moment of the Report: which tab/view was open, viewport size, user agent, and timestamp.
_Avoid_: Metadata, environment

**Open / Resolved**:
A Report's lifecycle. Open means awaiting an agent; Resolved means acted on. Status is expressed by which folder the Report file lives in — moving the file is the state change.
_Avoid_: Done (collides with Task status), closed, fixed

### Time

**Week**:
Always Monday through Sunday. Weekly Recurring Items reset at the start of Monday.
